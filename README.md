# GRID//

A neon arcade of grid selection, transformation and deduction games — built on the
original "Bucket Field" idea (pick cells on a grid, then reproduce the pattern under a
challenge). Single-player puzzles, a deducing bot, and real-time head-to-head multiplayer.

## Modes

- **Rotation Memory** *(star mode)* — memorise a pattern, watch the grid rotate, then click
  where the cells land in their **rotated** positions. Perfect rounds escalate the difficulty
  (bigger grids, more cells, larger rotations), with lives, a streak multiplier and a saved best score.
- **Mirror Memory** — the same engine with a mirror/flip transform across an axis.
- **Deduction Duel (vs Bot)** — you and the bot each hide 10 treasures on an 8×8 grid and
  alternate probing. Every probe reveals a hit (★) or a **proximity number** (treasures among
  the 8 neighbours). Read the clues to deduce locations — the bot runs a constraint/probability
  solver and deduces too. First to find all 10 wins.
- **Multiplayer (Deduction Duel online)** — create a session to get a shareable **code + link**;
  a friend joins and you play the duel head-to-head. The server is authoritative (it validates
  every probe, computes hits/proximity, enforces turns and pushes a full state snapshot to both
  clients), so the two sides can never desync. Dropped players **reconnect** within a grace window.

## Installation

```bash
git clone https://github.com/olivierluethy/Bucket-Field/
cd Bucket-Field
npm install
```

## Run

```bash
npm start
```

Then open `http://localhost:3000` and hit **Enter** to start. (Set `PORT` to use another port.)

To play multiplayer on one machine, open the invite link in a second browser tab/window.

## Architecture

- **`server.js`** — Express + Socket.IO. Owns all multiplayer state in per-room objects;
  validates moves, computes results, and broadcasts per-player snapshots. Serves `public/`.
- **`public/css/`** — `app.css` (shared arcade design system) and `menu.css`.
- **`public/js/`** — `grid.js` (reusable grid + rotate/mirror geometry), `ui.js` (toast/overlay,
  no `alert()`), and one script per mode (`memory.js`, `bot.js`, `multiplayer.js`, `menu.js`).
- **`public/modes/`** — the game pages. `index.html` is the immersive menu.

## Technologies

HTML · CSS · JavaScript · Node.js · Express · Socket.IO

## Authors

- [Olivier Lüthy](https://github.com/olivierluethy)

## License

Licensed under the [MIT License](https://opensource.org/licenses/MIT).
