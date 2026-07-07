/* ============================================================
   GRID// server — authoritative real-time multiplayer.

   The server owns ALL game state. Clients never trust each other:
   every probe is validated here, hits/proximity are computed here,
   and after each change every connected player is sent a full
   per-player snapshot. That makes the two clients impossible to
   desync and makes reconnection trivial (just re-send the snapshot).

   Game: Deduction Duel — each player hides K treasures on an S×S
   grid; players alternate probing; each probe returns hit + a
   proximity clue (treasures among the 8 neighbours). First to find
   all K wins.
   ============================================================ */
const express = require("express");
const http = require("http");
const crypto = require("crypto");
const path = require("path");
const socketIO = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 3000;
const SIZE = 8;
const K = 10;
const RECONNECT_GRACE_MS = 45000;

/** @type {Map<string, Room>} */
const rooms = new Map();

/* ---------- grid helpers (authoritative) ---------- */
function neighbors(i) {
  const r = Math.floor(i / SIZE), c = i % SIZE, out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < SIZE && nc < SIZE) out.push(nr * SIZE + nc);
    }
  return out;
}
function proximity(treasureSet, i) {
  return neighbors(i).filter((n) => treasureSet.has(n)).length;
}
function validTreasures(list) {
  if (!Array.isArray(list) || list.length !== K) return null;
  const set = new Set();
  for (const v of list) {
    const i = Number(v);
    if (!Number.isInteger(i) || i < 0 || i >= SIZE * SIZE || set.has(i)) return null;
    set.add(i);
  }
  return set;
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code;
  do {
    code = Array.from(crypto.randomBytes(4))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  } while (rooms.has(code));
  return code;
}

/* ---------- room model ---------- */
function newPlayer(pid, name) {
  return {
    pid,
    name: (name || "Player").toString().slice(0, 16),
    socketId: null,
    connected: false,
    treasures: null,      // Set<number> once placed
    ready: false,
    guesses: new Map(),   // index -> {hit, prox}  (probes this player made on the opponent)
    found: 0,
  };
}

function opponentOf(room, pid) {
  const other = room.order.find((p) => p !== pid);
  return other ? room.players[other] : null;
}

function snapshotFor(room, pid) {
  const me = room.players[pid];
  const opp = opponentOf(room, pid);
  const mapProbes = (g) => [...g.entries()].map(([index, v]) => ({ index, hit: v.hit, prox: v.prox }));
  return {
    code: room.code,
    size: SIZE,
    K,
    phase: room.phase,
    winner: room.winner,
    you: pid,
    yourTurn: room.turn === pid,
    me: {
      name: me.name,
      ready: me.ready,
      found: me.found,
      placed: me.treasures ? me.treasures.size : 0,
      treasures: me.treasures ? [...me.treasures] : [],
    },
    opponent: opp
      ? { name: opp.name, connected: opp.connected, ready: opp.ready, found: opp.found, joined: true }
      : { joined: false },
    // probes the OPPONENT made against me -> render on my grid
    myGrid: opp ? mapProbes(opp.guesses) : [],
    // probes I made against the opponent -> render on the enemy grid
    enemyGrid: mapProbes(me.guesses),
  };
}

function pushState(room) {
  for (const pid of room.order) {
    const p = room.players[pid];
    if (p.connected && p.socketId) io.to(p.socketId).emit("state", snapshotFor(room, pid));
  }
}

function maybeStart(room) {
  if (room.order.length === 2 && room.order.every((pid) => room.players[pid].ready)) {
    room.phase = "playing";
    room.turn = room.order[Math.floor(Math.random() * 2)];
  }
}

function cleanupRoom(room) {
  if (room.destroyTimer) clearTimeout(room.destroyTimer);
  rooms.delete(room.code);
}

/* ---------- socket wiring ---------- */
io.on("connection", (socket) => {
  let boundCode = null;
  let boundPid = null;

  function bind(room, pid) {
    boundCode = room.code;
    boundPid = pid;
    const p = room.players[pid];
    p.socketId = socket.id;
    p.connected = true;
    if (p.disconnectTimer) { clearTimeout(p.disconnectTimer); p.disconnectTimer = null; }
  }

  socket.on("create", ({ name, token } = {}, ack) => {
    const pid = (token || crypto.randomUUID()).toString();
    const code = makeCode();
    const room = {
      code, phase: "lobby", turn: null, winner: null,
      order: [pid], players: { [pid]: newPlayer(pid, name) },
    };
    rooms.set(code, room);
    bind(room, pid);
    ack && ack({ ok: true, code, pid });
    pushState(room);
  });

  socket.on("join", ({ code, name, token } = {}, ack) => {
    code = (code || "").toString().toUpperCase().trim();
    const room = rooms.get(code);
    const pid = (token || crypto.randomUUID()).toString();
    if (!room) return ack && ack({ ok: false, error: "Room not found" });

    // rejoin (same token already in room)
    if (room.players[pid]) {
      bind(room, pid);
      ack && ack({ ok: true, code, pid, rejoined: true });
      pushState(room);
      io.to(room.code).emit("event", { kind: "opponentReturned" });
      return;
    }
    if (room.order.length >= 2) return ack && ack({ ok: false, error: "Room is full" });

    room.players[pid] = newPlayer(pid, name);
    room.order.push(pid);
    if (room.phase === "lobby") room.phase = "placing";
    bind(room, pid);
    ack && ack({ ok: true, code, pid });
    pushState(room);
  });

  socket.on("place", ({ treasures } = {}, ack) => {
    const room = rooms.get(boundCode);
    if (!room || !boundPid) return;
    if (room.phase !== "placing" && room.phase !== "lobby") return ack && ack({ ok: false, error: "Not in setup" });
    const set = validTreasures(treasures);
    if (!set) return ack && ack({ ok: false, error: "Place exactly " + K + " distinct treasures" });
    const p = room.players[boundPid];
    p.treasures = set;
    p.ready = true;
    ack && ack({ ok: true });
    maybeStart(room);
    pushState(room);
  });

  socket.on("fire", ({ index } = {}, ack) => {
    const room = rooms.get(boundCode);
    if (!room || room.phase !== "playing") return ack && ack({ ok: false, error: "Not playing" });
    if (room.turn !== boundPid) return ack && ack({ ok: false, error: "Not your turn" });
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= SIZE * SIZE) return ack && ack({ ok: false, error: "Bad cell" });
    const me = room.players[boundPid];
    if (me.guesses.has(i)) return ack && ack({ ok: false, error: "Already probed" });
    const opp = opponentOf(room, boundPid);
    if (!opp || !opp.treasures) return ack && ack({ ok: false, error: "Opponent not ready" });

    const hit = opp.treasures.has(i);
    const prox = proximity(opp.treasures, i);
    me.guesses.set(i, { hit, prox });
    if (hit) me.found++;

    if (me.found >= K) { room.phase = "over"; room.winner = boundPid; }
    else room.turn = opp.pid;

    ack && ack({ ok: true });
    pushState(room);
  });

  socket.on("rematch", () => {
    const room = rooms.get(boundCode);
    if (!room) return;
    room.players[boundPid].rematch = true;
    if (room.order.length === 2 && room.order.every((pid) => room.players[pid].rematch)) {
      for (const pid of room.order) {
        const p = room.players[pid];
        p.treasures = null; p.ready = false; p.guesses = new Map(); p.found = 0; p.rematch = false;
      }
      room.phase = "placing"; room.turn = null; room.winner = null;
    }
    pushState(room);
  });

  socket.on("leave", () => handleGone(true));
  socket.on("disconnect", () => handleGone(false));

  function handleGone(intentional) {
    const room = rooms.get(boundCode);
    if (!room || !boundPid) return;
    const p = room.players[boundPid];
    if (!p) return;
    p.connected = false;
    p.socketId = null;

    io.to(room.code).emit("event", { kind: "opponentLeft", grace: Math.round(RECONNECT_GRACE_MS / 1000) });
    pushState(room);

    const finalize = () => {
      // if opponent already left too, destroy the room
      const anyConnected = room.order.some((pid) => room.players[pid].connected);
      if (!anyConnected) return cleanupRoom(room);
      if (room.phase === "playing") { room.phase = "over"; room.winner = opponentOf(room, boundPid)?.pid || null; }
      pushState(room);
    };

    if (intentional) finalize();
    else p.disconnectTimer = setTimeout(finalize, RECONNECT_GRACE_MS);
  }
});

/* ---------- static hosting ---------- */
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

server.listen(PORT, () => console.log(`GRID// server listening on http://localhost:${PORT}`));
