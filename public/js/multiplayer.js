/* ============================================================
   GRID// Multiplayer client.
   Rendering is 100% driven by authoritative "state" snapshots from
   the server — the client never decides hits/turns, it only draws
   what the server reports, so the two players can never desync.
   Reconnection: a per-tab token is stored; on any (re)connect we
   re-emit join with it and the server replays the full snapshot.
   ============================================================ */
(() => {
  const socket = io({ reconnection: true, reconnectionDelay: 600 });
  const K = 10;

  // per-tab identity for reconnection
  let token = sessionStorage.getItem("grid.token");
  if (!token) {
    token = (crypto.randomUUID && crypto.randomUUID()) || String(Math.random()).slice(2) + Date.now();
    sessionStorage.setItem("grid.token", token);
  }
  const session = {
    code: sessionStorage.getItem("grid.code") || null,
    joined: false,
    placement: new Set(),
    sentReady: false,
    lastPhase: null,
  };

  const el = {
    conn: $("#connPill"), lobby: $("#lobby"), share: $("#share"), game: $("#game"),
    lobbyError: $("#lobbyError"), shareCode: $("#shareCode"), shareStatus: $("#shareStatus"),
    banner: $("#banner"), youFound: $("#youFound"), oppFound: $("#oppFound"),
    youName: $("#youName"), oppName: $("#oppName"),
    setup: $("#setupControls"), ready: $("#readyBtn"), random: $("#randomBtn"),
    name: $("#nameInput"), code: $("#codeInput"),
  };

  const myGrid = new Grid($("#myBoard"), 8, { cell: 44, onClick: onMyClick });
  const enemyGrid = new Grid($("#enemyBoard"), 8, { cell: 44, onClick: onEnemyClick });

  const linkFor = (code) => `${location.origin}${location.pathname}?room=${code}`;

  /* ---------------- connection ---------------- */
  socket.on("connect", () => {
    el.conn.textContent = "Online";
    el.conn.className = "pill on";
    // auto-(re)join if we already have a session
    if (session.code) {
      socket.emit("join", { code: session.code, token, name: nameValue() }, (res) => {
        if (!res || !res.ok) { // stale room — reset to lobby
          sessionStorage.removeItem("grid.code");
          session.code = null; session.joined = false;
          showLobby();
        } else {
          session.joined = true;
        }
      });
    }
  });
  socket.on("disconnect", () => { el.conn.textContent = "Reconnecting…"; el.conn.className = "pill"; });

  socket.on("event", (e) => {
    if (e.kind === "opponentLeft") toast(`Opponent disconnected — ${e.grace}s to reconnect`);
    else if (e.kind === "opponentReturned") toast("Opponent reconnected");
  });

  /* ---------------- lobby actions ---------------- */
  const nameValue = () => (el.name.value.trim() || "Player");

  $("#createBtn").addEventListener("click", () => {
    socket.emit("create", { name: nameValue(), token }, (res) => {
      if (!res || !res.ok) return (el.lobbyError.textContent = "Could not create session");
      startSession(res.code);
    });
  });

  $("#joinBtn").addEventListener("click", doJoin);
  el.code.addEventListener("keydown", (e) => { if (e.key === "Enter") doJoin(); });
  function doJoin() {
    const code = el.code.value.trim().toUpperCase();
    if (code.length < 4) return (el.lobbyError.textContent = "Enter the 4-character code");
    socket.emit("join", { code, name: nameValue(), token }, (res) => {
      if (!res || !res.ok) return (el.lobbyError.textContent = res?.error || "Could not join");
      startSession(res.code);
    });
  }

  function startSession(code) {
    session.code = code;
    session.joined = true;
    sessionStorage.setItem("grid.code", code);
    el.lobbyError.textContent = "";
  }

  $("#copyLinkBtn").addEventListener("click", () => {
    const link = linkFor(session.code);
    navigator.clipboard?.writeText(link).then(() => toast("Invite link copied"), () => toast(link));
  });

  /* ---------------- placement ---------------- */
  function onMyClick(i) {
    if (currentPhase() !== "placing" || session.sentReady) return;
    if (session.placement.has(i)) { session.placement.delete(i); myGrid.reset(i); }
    else if (session.placement.size < K) { session.placement.add(i); myGrid.add(i, "sel"); myGrid.pop(i); }
    el.ready.disabled = session.placement.size !== K;
    banner(el.banner, session.placement.size === K ? "Ready when you are" : `Place ${K - session.placement.size} more treasures`, "info");
  }
  el.random.addEventListener("click", () => {
    if (currentPhase() !== "placing" || session.sentReady) return;
    session.placement.forEach((i) => myGrid.reset(i));
    session.placement = new Set(sample(64, K));
    session.placement.forEach((i) => myGrid.add(i, "sel"));
    el.ready.disabled = false;
  });
  el.ready.addEventListener("click", () => {
    if (session.placement.size !== K) return;
    socket.emit("place", { treasures: [...session.placement] }, (res) => {
      if (!res || !res.ok) return toast(res?.error || "Placement rejected");
      session.sentReady = true;
      el.ready.disabled = true;
      el.ready.textContent = "Waiting…";
      myGrid.lock();
    });
  });

  /* ---------------- probing ---------------- */
  function onEnemyClick(i) {
    if (currentPhase() !== "playing" || !session.yourTurn) return;
    if (enemyGrid.has(i, "hit") || enemyGrid.has(i, "miss")) return;
    socket.emit("fire", { index: i }, (res) => {
      if (!res || !res.ok) toast(res?.error || "Invalid move");
    });
  }

  /* ---------------- authoritative render ---------------- */
  let phase = null;
  const currentPhase = () => phase;

  socket.on("state", (s) => {
    phase = s.phase;
    session.yourTurn = s.yourTurn;

    // which screen?
    if (!s.opponent.joined && s.phase === "lobby") showShare(s);
    else showGame(s);

    // reset local placement flags when a fresh placing round starts (e.g. rematch)
    if (s.phase === "placing" && s.me.placed === 0 && s.me.ready === false && session.lastPhase === "over") {
      session.placement = new Set(); session.sentReady = false;
      el.ready.textContent = "Ready ►"; el.ready.disabled = true; myGrid.unlock();
    }
    session.lastPhase = s.phase;

    el.youName.textContent = s.me.name;
    el.oppName.textContent = s.opponent.joined ? s.opponent.name : "Opponent";
    el.youFound.textContent = s.me.found;
    el.oppFound.textContent = s.opponent.joined ? s.opponent.found : 0;

    renderBoards(s);
    renderPhase(s);
  });

  function renderBoards(s) {
    // MY grid: my treasures + opponent's probes on me
    myGrid.clearState();
    const myTreasures = s.me.treasures.length ? s.me.treasures : [...session.placement];
    const hitOnMe = new Set(s.myGrid.filter((p) => p.hit).map((p) => p.index));
    myTreasures.forEach((i) => { if (!hitOnMe.has(i)) myGrid.add(i, "sel"); });
    s.myGrid.forEach((p) => {
      if (p.hit) { myGrid.add(p.index, "enemy"); myGrid.text(p.index, "★"); }
      else { myGrid.add(p.index, "miss"); if (p.prox > 0) myGrid.text(p.index, p.prox); }
    });

    // ENEMY grid: my probes
    enemyGrid.clearState();
    s.enemyGrid.forEach((p) => {
      if (p.hit) { enemyGrid.add(p.index, "hit"); enemyGrid.text(p.index, "★"); }
      else { enemyGrid.add(p.index, "miss"); if (p.prox > 0) enemyGrid.text(p.index, p.prox); }
    });
    if (s.phase === "playing" && s.yourTurn) enemyGrid.unlock(); else enemyGrid.lock();
  }

  function renderPhase(s) {
    if (s.phase === "placing") {
      el.setup.classList.remove("hidden");
      if (!session.sentReady) myGrid.unlock();
      const oppState = !s.opponent.joined ? "opponent not here" : s.opponent.ready ? "opponent ready" : "opponent placing…";
      banner(el.banner, session.sentReady ? `Waiting — ${oppState}` : `Place your ${K} treasures (${oppState})`, "info");
    } else if (s.phase === "playing") {
      el.setup.classList.add("hidden");
      banner(el.banner, s.yourTurn ? "Your turn — probe the enemy grid" : `${s.opponent.name}'s turn…`, s.yourTurn ? "good" : "info");
    } else if (s.phase === "over") {
      el.setup.classList.add("hidden");
      const youWon = s.winner === s.you;
      banner(el.banner, youWon ? "You win!" : "You lose.", youWon ? "good" : "bad");
      overlay(youWon ? "Victory" : "Defeat",
        youWon ? `You found all ${K} first.` : `${s.opponent.joined ? s.opponent.name : "Opponent"} found all ${K} first.`,
        [
          { label: "Rematch", kind: "primary", onClick: () => socket.emit("rematch") },
          { label: "Menu", kind: "ghost", onClick: () => (location.href = "/") },
        ]);
    }
  }

  /* ---------------- screen switching ---------------- */
  function showLobby() {
    el.lobby.classList.remove("hidden");
    el.share.classList.add("hidden");
    el.game.classList.add("hidden");
  }
  function showShare(s) {
    el.lobby.classList.add("hidden");
    el.share.classList.remove("hidden");
    el.game.classList.add("hidden");
    el.shareCode.textContent = s.code;
    el.shareStatus.textContent = "Waiting for opponent to join…";
  }
  function showGame() {
    el.lobby.classList.add("hidden");
    el.share.classList.add("hidden");
    el.game.classList.remove("hidden");
  }

  /* ---------------- boot ---------------- */
  const params = new URLSearchParams(location.search);
  if (params.get("room")) {
    el.code.value = params.get("room").toUpperCase().slice(0, 4);
    session.code = null; // let user hit join (name first) — prefilled
  }
  showLobby();
})();
