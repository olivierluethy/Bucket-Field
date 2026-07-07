# GRID// — Developer Documentation

This is the complete guide to the GRID// codebase: how it is put together, how the games work,
the multiplayer protocol, and how to extend it. If you are an AI assistant, start with
[`../AGENTS.md`](../AGENTS.md) for a compressed map, then come here for depth.

---

## 1. Overview

GRID// is a suite of grid-based selection/deduction games sharing one theme: *place cells on a
grid, then reproduce or deduce a pattern under a challenge.*

- **Stack:** Node.js, Express, Socket.IO (server) + vanilla HTML/CSS/JavaScript (client).
- **No build step, no framework, no bundler.** Scripts are plain `<script>` tags that expose
  globals. Fonts come from Google Fonts over CDN; everything else is local.
- **Two categories of mode:**
  - **Single-player** (`memory.js`, `bot.js`) — entirely in the browser, no network.
  - **Multiplayer** (`multiplayer.js` + `server.js`) — real-time, server-authoritative.

### Design goals (why the code looks the way it does)

1. **Impossible to desync.** The multiplayer server is the single source of truth and re-sends a
   full snapshot after every change, so the two clients cannot drift apart.
2. **Reconnection is free.** Because state lives on the server and players are keyed by a stable
   token, a returning player is just handed the latest snapshot.
3. **State via CSS classes, not inline styles.** Rendering is idempotent — a board can be redrawn
   from a snapshot at any moment.
4. **Shared primitives.** Grid construction, geometry, and UI chrome are written once and reused.

---

## 2. Repository layout

```
Bucket-Field/
├── server.js                 # Express + Socket.IO; authoritative multiplayer; static host
├── index.html                # Immersive menu (served at "/")
├── package.json              # deps + "npm start"
├── README.md                 # player-facing readme
├── AGENTS.md                 # AI quick-reference
├── docs/
│   └── DEVELOPER.md          # this file
├── public/                   # served at the ROOT by express.static
│   ├── css/
│   │   ├── app.css           # shared design system (theme, board, buttons, overlay, toast)
│   │   └── menu.css          # menu-only styles (screens, cards, live previews)
│   ├── js/
│   │   ├── grid.js           # Grid class + Transform (rotate/mirror geometry)
│   │   ├── ui.js             # toast / overlay / banner / $ / shuffle / sample  (no alert!)
│   │   ├── menu.js           # menu screen navigation + preview builder
│   │   ├── memory.js         # Rotation & Mirror Memory engine (mode via ?mode=)
│   │   ├── bot.js            # Deduction Duel vs bot + the bot solver
│   │   └── multiplayer.js    # Deduction Duel online client (snapshot renderer)
│   └── modes/
│       ├── memory.html       # page for rotation/mirror
│       ├── bot.html          # page for vs-bot
│       └── multiplayer.html  # lobby + game for online play
└── diagram/                  # LEGACY flow chart from the pre-rebuild design (out of date)
```

### Static hosting model (important)

`express.static(path.join(__dirname, 'public'))` serves the **contents of `public/` at the URL
root**:

- `public/css/app.css`   → `GET /css/app.css`
- `public/modes/bot.html` → `GET /modes/bot.html`

`index.html` is at the repo root (not in `public/`) and is served by an explicit
`app.get('/')` route. Consequently:

- Pages reference assets with root-absolute paths: `/css/app.css`, `/js/grid.js`.
- "Back to menu" links target **`/`** (a link to `../../index.html` resolves to `/index.html`,
  which is *not* served and 404s).

---

## 3. Getting started

```bash
npm install
npm start            # http://localhost:3000
PORT=4000 npm start  # custom port
```

Open the site, press **Enter** on the boot screen. To try multiplayer on one machine, create a
session and open the copied invite link in a second browser tab or window.

> `node_modules/` is committed to this repo and there is no `.gitignore`. Keep that convention in
> mind: any package you install locally will show up in `git status`. Test-only packages must be
> removed before committing (see §8).

---

## 4. Frontend primitives

### 4.1 `Grid` (`public/js/grid.js`)

Builds and manipulates a square grid of `<div class="cell">` elements. State is always a CSS
class; the class never carries an inline colour.

```js
const grid = new Grid(document.getElementById('board'), 8, {
  cell: 44,                       // px size of each cell
  onClick: (index, cellEl) => {}  // fired for left-clicks on a cell, unless the grid is locked
});

grid.rc(i);        // -> [row, col]
grid.idx(r, c);    // -> index
grid.neighbors(i); // -> array of the up-to-8 neighbour indices (used for proximity)
grid.add(i, cls);  // add a state class
grid.remove(i,cls);
grid.has(i, cls);
grid.reset(i);     // back to a blank cell
grid.clearState(); // blank the whole board (keeps DOM)
grid.text(i, t);   // set the cell's label (e.g. a proximity number or ★)
grid.lock();       // ignore clicks
grid.unlock();
grid.pop(i);       // one-shot "pop" animation
```

**Cell state classes** (defined in `app.css`): `sel` (your selection/treasure), `hit` (you found
an enemy treasure), `miss` (empty probe, may show a proximity number), `enemy` (an enemy probe
that hit *your* treasure), `wrong` / `correct` (memory-mode guess feedback), `ghost` (a revealed
answer you missed).

### 4.2 `Transform` (`public/js/grid.js`)

Pure geometry over grid indices — the heart of the memory modes.

```js
Transform.rotate(i, size, deg);   // deg ∈ {90, 180, 270} clockwise
Transform.mirror(i, size, axis);  // axis ∈ 'h' (left-right), 'v' (top-bottom), 'd' (transpose)
```

Both are **bijections** over `0 … size*size-1`, so applying one to a set of N distinct cells
yields N distinct cells. Rotation formulas (with `S = size - 1`):

| deg | (r, c) → |
|-----|----------|
| 90  | (c, S − r) |
| 180 | (S − r, S − c) |
| 270 | (S − c, r) |

### 4.3 `ui.js`

`$` / `$$` (query helpers), `banner(el, msg, kind)` where kind ∈ `good|bad|info`, `toast(msg)`
(auto-dismiss), `overlay(title, subtitle, buttons[])` where each button is
`{label, kind, onClick}`, plus `shuffle(array)` and `sample(n, count)` (random distinct indices).
**There is no `alert()` in this project by design** — use these.

---

## 5. The games

### 5.1 Rotation Memory & Mirror Memory (`memory.js`)

One engine, selected by the query string: `?mode=rotate` (default) or `?mode=mirror`.

**Round flow:** `select → memorise → transform → guess → review`.

1. **select** — click to choose `need` cells (`sel`). Ready enables at exactly `need`.
2. **memorise** — the pattern stays visible for a short countdown; the round's transform is chosen
   from the level's pool and the **target set** = `selected.map(transform)` is computed.
3. **transform** — the pattern is hidden, the board plays a rotate/flip flourish, then settles
   upright. (The flourish is a hint; the *puzzle* is applying the transform mentally.)
4. **guess** — click `need` cells. Each is checked against the target set: `correct` or `wrong`.
5. **review** — missed targets are revealed as `ghost`. A **perfect** round advances the level and
   grows the streak multiplier; an imperfect one costs a life. Score persists as
   `localStorage['grid.best.<mode>']`.

**Difficulty** is `configForLevel(level)` — grid `size` (4→8), `need` (grows with level, capped at
45% of cells), the transform `pool` (widens at higher levels), and a shrinking `memoriseMs`. Tune
the game here.

### 5.2 Deduction Duel vs Bot (`bot.js`)

8×8, both sides hide 10 treasures. Phases: **place → battle → over**. You place your treasures
(or use *Random*), then you and the bot alternate probing. Probes reveal `hit`/`miss` plus a
proximity number. First to 10 wins.

**The bot solver — `botChoose()`** — is a lightweight constraint + probability engine over what
the bot has learned about *your* grid (`state.botKnowledge`: `index → {treasure, prox}`):

1. **Certain deductions first.** For each revealed clue cell, look at its unknown neighbours and
   the remaining treasure count implied by its proximity number. If a clue's remaining count
   equals its number of unknown neighbours, those are **guaranteed treasures** → probe one. If the
   remaining count is 0, those neighbours are **guaranteed safe** → never probe them.
2. **Otherwise, score every unknown cell** = max of (global prior treasure density, and each
   adjacent clue's local density `remaining / unknownNeighbours`). Probe the highest-scoring cell,
   ties broken randomly for variety.

Empirically it finds all 10 in ~24 probes vs ~59 for random guessing — strong but beatable. Make
it easier by injecting more randomness, harder by deepening the constraint propagation.

### 5.3 Deduction Duel online (`multiplayer.js` + `server.js`)

Same rules as vs-Bot, played between two humans with the **server as referee**. See §6.

---

## 6. Multiplayer architecture

### 6.1 Authority model

The server holds one object per room and is the **only** place game outcomes are decided. On every
state change it calls `pushState(room)`, which sends each *connected* player a snapshot tailored to
their point of view (`snapshotFor(room, pid)`). Clients render snapshots and emit intents; they
compute nothing themselves. This is why the two boards can never disagree and why reconnection is
just "send the snapshot again."

### 6.2 Room & player model (`server.js`)

```
room = {
  code,                       // 4-char share code (unambiguous alphabet)
  phase,                      // 'lobby' | 'placing' | 'playing' | 'over'
  turn,                       // pid whose move it is
  winner,                     // pid | null
  order: [pidA, pidB],        // seating; also who started
  players: {
    [pid]: {
      pid, name, socketId, connected,
      treasures,              // Set<index> (their hidden 10)
      ready,                  // has placed
      guesses,                // Map<index, {hit, prox}>  probes THEY made on the opponent
      found,                  // hit count
      disconnectTimer,        // grace timer handle
    }
  }
}
```

**Constants:** `SIZE = 8`, `K = 10`, `RECONNECT_GRACE_MS = 45000`.

### 6.3 Identity & reconnection

- Each browser **tab** generates a `token` (stored in `sessionStorage['grid.token']`) and reuses
  it for the session. `pid === token`.
- On any socket `connect`/reconnect, the client re-emits `join {code, token}`; the server finds the
  existing player slot by token, re-binds the new `socketId`, clears the grace timer, and pushes
  the snapshot. The client also caches `grid.code` so a full page reload rejoins automatically.
- On `disconnect`, the player is marked offline and a `RECONNECT_GRACE_MS` timer starts. If it
  expires while a game is in `playing`, the remaining player is declared the winner; if nobody is
  connected, the room is destroyed. An intentional `leave` finalises immediately.

### 6.4 Protocol

**Client → server** (all use an acknowledgement callback `ack(result)`):

| Event | Payload | Ack result | Notes |
|-------|---------|-----------|-------|
| `create` | `{name, token}` | `{ok, code, pid}` | opens a room in `lobby` |
| `join` | `{code, name, token}` | `{ok, code, pid, rejoined?}` or `{ok:false, error}` | rejoin if the token is already in the room; else fill the 2nd seat |
| `place` | `{treasures:[10 indices]}` | `{ok}` or `{ok:false, error}` | validated: exactly 10 distinct in-bounds cells |
| `fire` | `{index}` | `{ok}` or `{ok:false, error}` | rejected if not your turn / already probed / not playing |
| `rematch` | — | — | when both request it, the room resets to `placing` |
| `leave` | — | — | finalise immediately |

**Server → client:**

| Event | Payload |
|-------|---------|
| `state` | the per-player snapshot (below) |
| `event` | `{kind: 'opponentLeft', grace}` or `{kind: 'opponentReturned'}` |

**Snapshot** (`snapshotFor`) — everything a client needs to fully redraw its view:

```js
{
  code, size, K, phase, winner,
  you,                 // this player's pid
  yourTurn,            // boolean
  me:  { name, ready, found, placed, treasures:[...] },        // treasures only for the owner
  opponent: { joined, name?, connected?, ready?, found? },
  myGrid:   [ {index, hit, prox}, ... ],  // the OPPONENT's probes on me -> draw on my board
  enemyGrid:[ {index, hit, prox}, ... ],  // MY probes -> draw on the enemy board
}
```

### 6.5 Client rendering (`multiplayer.js`)

The `socket.on('state', …)` handler is the whole game loop: pick the right screen
(lobby / share / game), update the HUD, then `renderBoards(snapshot)` rebuilds both grids from
scratch (clear + re-apply classes) and `renderPhase(snapshot)` updates controls/banner/overlay.
Local placement is kept client-side until `place` is acknowledged, after which the server echoes it
back in `me.treasures`.

---

## 7. Styling & theming

- **`app.css`** is the design system: CSS custom properties (`--cyan`, `--magenta`, `--panel`, …),
  the animated scan-grid backdrop, buttons (`.btn`, `.btn.primary|magenta|ghost|lg`), panels, HUD
  stats, the board/`.cell` and its state classes, `.toast`, and `.overlay`. Restyle the whole app
  from the `:root` variables.
- **`menu.css`** covers only the menu: `.screen` transitions, `.pathcard` / `.modecard`, and the
  little animated `.preview` grids.

---

## 8. Testing & verification

There is **no test runner**. Verify changes with:

- **Syntax:** `node --check public/js/<file>.js` (and `server.js`).
- **Pure logic:** small Node simulations. The rotation geometry and the bot solver were both
  validated this way (e.g. asserting `Transform.rotate` is a bijection, and Monte-Carlo comparing
  the bot's probe count against a random baseline).
- **Routes:** boot the server and `curl -o /dev/null -w '%{http_code}'` each page/asset.
- **Multiplayer end-to-end:** temporarily `npm install --no-save socket.io-client`, drive two
  clients through create → join → place → fire → win and a disconnect/rejoin, then **delete the
  installed folders** (`node_modules/socket.io-client`, `engine.io-client`, `xmlhttprequest-ssl`)
  and `git checkout -- node_modules/.package-lock.json` so test-only deps aren't committed.

---

## 9. Extending the project

**Add a single-player mode**

1. Create `public/modes/<mode>.html` (copy `bot.html` for structure; link `/css/app.css` and the
   shared scripts) and `public/js/<mode>.js`.
2. Reuse `Grid`, `Transform`, and `ui.js`. Keep state in CSS classes; no `alert()`.
3. Add a `.modecard` with a `data-play="/modes/<mode>.html"` in `index.html`; `menu.js` wires it up
   automatically and builds its preview from `data-cells` / `data-nums`.

**Change multiplayer rules**

Edit the constants and handlers in `server.js` and mirror any new snapshot fields in
`multiplayer.js`'s render. Never move outcome logic to the client.

**Adjust game feel**

- Memory difficulty/scoring → `configForLevel()` / `endRound()` in `memory.js`.
- Bot strength → `botChoose()` in `bot.js`.
- Reconnect window / board size / treasure count → constants in `server.js`.

---

## 10. Gotchas & conventions

- **Never call `alert`/`confirm`.** The original server crashed because `alert()` was invoked in
  Node; the client used blocking dialogs. Use `toast`/`overlay`/`banner`.
- **No inline colours for state.** Use the documented cell classes.
- **`socket.id` is not identity.** Use the per-tab `token`.
- **Links go to `/`,** not `../../index.html`.
- **`diagram/` is stale.** It documents the pre-rebuild (broken) design; update or ignore it.
- **`node_modules/` is committed.** Don't let ad-hoc installs sneak into commits.
