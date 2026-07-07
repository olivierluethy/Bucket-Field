# CLAUDE.md

GRID// — grid selection/deduction games on Node.js + Express + Socket.IO with a vanilla JS/CSS
frontend (no build step).

**Start with [`AGENTS.md`](AGENTS.md)** for the fast orientation map (architecture, invariants,
where-to-change-what, and traps). For the full guide see [`docs/DEVELOPER.md`](docs/DEVELOPER.md).

Quick facts:
- Run: `npm install && npm start` → http://localhost:3000 (override with `PORT`).
- `public/` is served at the URL **root**; `index.html` is served at `/`. In-app menu links use `/`.
- Multiplayer is **server-authoritative** (`server.js`): clients render snapshots, never compute
  outcomes. Player identity is a per-tab `token`, not `socket.id`.
- Invariants: no `alert()` (use `toast`/`overlay`/`banner`); cell state via CSS classes, not inline
  colours; reuse `Grid`/`Transform` (`public/js/grid.js`).
- `node_modules/` is committed and there is no `.gitignore` — don't commit ad-hoc test installs.
