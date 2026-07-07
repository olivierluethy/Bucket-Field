# AGENTS.md — AI orientation for GRID//

> Read this first. It is a compact map of the project written for AI assistants so you can
> orient in seconds, make correct changes, and avoid the traps. Humans: see
> [`docs/DEVELOPER.md`](docs/DEVELOPER.md) for the full guide.

## What this is

**GRID//** is a small browser game suite on a **Node.js + Express + Socket.IO** stack with a
**vanilla JS/CSS** frontend (no build step, no framework). One core idea runs through every
mode: *select cells on a grid, then reproduce/deduce a pattern under a challenge.*

Four modes:

| Mode | Kind | Entry page | Script |
|------|------|-----------|--------|
| Rotation Memory *(star)* | single-player | `/modes/memory.html?mode=rotate` | `public/js/memory.js` |
| Mirror Memory | single-player | `/modes/memory.html?mode=mirror` | `public/js/memory.js` (same engine) |
| Deduction Duel (vs Bot) | single-player | `/modes/bot.html` | `public/js/bot.js` |
| Deduction Duel (online) | multiplayer | `/modes/multiplayer.html` | `public/js/multiplayer.js` + `server.js` |

The landing page `index.html` is an immersive menu (`public/js/menu.js`).

## Run & verify

```bash
npm install
npm start                 # serves http://localhost:3000 (override with PORT=xxxx)
```

- **Static hosting model:** `express.static('public')` serves `public/` at the **root**
  (`/css/app.css`, `/modes/bot.html`, …). `index.html` lives at the repo root and is served at
  `/` by an explicit route. Therefore in-app "back to menu" links point to `/`, **not**
  `../../index.html` (which would 404).
- **Quick smoke test:** boot the server and `curl -o /dev/null -w '%{http_code}'` the routes above.
- **No test framework is installed.** Verify by (a) `node --check <file>` for syntax, (b) running
  small `node -e` simulations for pure logic (see how the bot solver and rotation math were
  validated), and (c) the manual/integration approach in `docs/DEVELOPER.md`.
- **Do not commit test-only deps.** `node_modules/` **is committed** (no `.gitignore`). If you
  `npm install --no-save socket.io-client` to integration-test the server, delete those folders
  and `git checkout -- node_modules/.package-lock.json` before committing.

## Architecture in one breath

- **Server is authoritative for multiplayer.** It owns all room state, validates every move,
  computes hits + proximity clues, enforces turns, detects the winner, and after *every* change
  sends each connected player a **full per-player snapshot** (`state` event). Clients render the
  snapshot; they never decide game outcomes. This is what makes desync impossible and
  reconnection trivial.
- **Single-player modes are 100% client-side.** `memory.js` and `bot.js` never touch the server.
- **Shared frontend primitives:** `public/js/grid.js` (the `Grid` class + `Transform` rotate/mirror
  geometry) and `public/js/ui.js` (`toast`, `overlay`, `banner`, `sample`, `shuffle`, `$`). These
  are loaded as plain `<script>`s (globals), not modules.

## The shared game mechanic (both Deduction Duel modes)

8×8 grid, each side hides **10 treasures**. Players alternate probing the enemy grid. Every probe
returns **hit (★)** or a **proximity number** = count of treasures among the cell's 8 neighbours.
First to find all 10 wins. Constants live at the top of `server.js` (`SIZE`, `K`) and `bot.js`.

## Invariants — do not break these

1. **No `alert()` / `confirm()` anywhere** (the original bug called `alert` server-side, which
   throws in Node). Use `toast()` / `overlay()` / `banner()` from `ui.js` on the client.
2. **Cell state is expressed with CSS classes** (`sel`, `hit`, `miss`, `wrong`, `correct`,
   `ghost`, `enemy`), **never inline colours**. The old code compared `style.backgroundColor`
   strings — do not reintroduce that.
3. **Multiplayer clients are dumb renderers.** Never compute a hit, turn change, or win on the
   client. If you need new game logic, add it to `server.js` and surface it through the snapshot.
4. **Player identity = a per-tab `token`** (sessionStorage `grid.token`), *not* `socket.id`.
   Socket ids change on reconnect; the token is how a returning player re-binds to their room slot.
5. **Rotation/mirror geometry lives only in `Transform`** (`grid.js`). It is a bijection over grid
   indices; reuse it, don't hand-roll coordinate math.

## Socket.IO protocol (client → server, all ack-based)

`create {name, token}` · `join {code, name, token}` · `place {treasures:[10 idx]}` ·
`fire {index}` · `rematch` · `leave`. Server → client: `state` (snapshot) and
`event {kind: 'opponentLeft'|'opponentReturned', grace?}`. Full snapshot shape and room model:
see `snapshotFor()` in `server.js` and the protocol table in `docs/DEVELOPER.md`.

## Where to change what

| I want to… | Touch |
|---|---|
| Tweak difficulty curve / scoring of memory modes | `configForLevel()` / `endRound()` in `memory.js` |
| Make the bot smarter/weaker | `botChoose()` in `bot.js` |
| Change multiplayer rules, board size, treasure count, grace window | constants + handlers in `server.js` |
| Restyle anything | `public/css/app.css` (design system) or `menu.css` (menu only) |
| Add a menu entry / mode card | `index.html` + `public/js/menu.js` |
| Add a new single-player mode | new `public/modes/*.html` + `public/js/*.js`, reuse `Grid`/`ui.js`, link from the menu |

## Diagram

`diagram/GRID Architecture and Flow.drawio` is the **current** architecture & flow chart
(open at [app.diagrams.net](https://app.diagrams.net)): the menu, both single-player loops, and
the server-authoritative multiplayer exchange incl. reconnection. Keep it in sync with `server.js`
if you change the protocol.
