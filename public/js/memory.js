/* ============================================================
   Memory engine — powers "Rotation Memory" and "Mirror Memory".
   Flow: SELECT n cells -> Ready -> memorise -> pattern hides &
   board plays the transform -> re-select the TRANSFORMED positions
   -> score. Difficulty escalates each perfect round.
   Mode chosen via ?mode=rotate (default) or ?mode=mirror.
   ============================================================ */
(() => {
  const mode = new URLSearchParams(location.search).get("mode") === "mirror" ? "mirror" : "rotate";
  const isRotate = mode === "rotate";

  document.getElementById("modeName").innerHTML = isRotate
    ? 'GRID<b>//</b> ROTATION'
    : 'GRID<b>//</b> MIRROR';
  document.title = isRotate ? "GRID// Rotation Memory" : "GRID// Mirror Memory";

  const bestKey = "grid.best." + mode;
  const el = {
    board: $("#board"), banner: $("#banner"), ready: $("#readyBtn"),
    level: $("#statLevel"), score: $("#statScore"), streak: $("#statStreak"),
    lives: $("#statLives"), best: $("#statBest"), phase: $("#phasePill"),
    tlabel: $("#transformLabel"),
  };

  const state = {
    level: 1, score: 0, streak: 1, lives: 3,
    best: Number(localStorage.getItem(bestKey) || 0),
    phase: "select", size: 4, need: 3,
    selected: [], target: [], guesses: 0, correct: 0,
    transform: null, // {type:'rotate',deg} | {type:'mirror',axis}
    grid: null,
  };

  /* ---- difficulty curve ---- */
  function configForLevel(lvl) {
    const size = Math.min(4 + Math.floor((lvl - 1) / 3), 8);
    const need = Math.min(3 + Math.floor(lvl / 2), Math.floor(size * size * 0.45));
    let pool;
    if (isRotate) pool = lvl >= 3 ? [90, 180, 270] : [90, 270];
    else pool = lvl >= 4 ? ["h", "v", "d"] : ["h", "v"];
    const memoriseMs = Math.max(900, 2600 - lvl * 130);
    return { size, need, pool, memoriseMs };
  }

  function transformIndex(i) {
    return state.transform.type === "rotate"
      ? Transform.rotate(i, state.size, state.transform.deg)
      : Transform.mirror(i, state.size, state.transform.axis);
  }

  function transformText() {
    if (state.transform.type === "rotate") return `ROTATE ${state.transform.deg}° ⟳`;
    return { h: "MIRROR ⇄ (left–right)", v: "MIRROR ⇅ (top–bottom)", d: "MIRROR ⤢ (diagonal)" }[state.transform.axis];
  }

  function renderHud() {
    el.level.textContent = state.level;
    el.score.textContent = state.score;
    el.streak.textContent = "×" + state.streak;
    el.lives.textContent = "♥".repeat(state.lives) || "—";
    el.best.textContent = state.best;
    el.phase.textContent = state.phase[0].toUpperCase() + state.phase.slice(1);
  }

  /* ---- round lifecycle ---- */
  function newRound() {
    const cfg = configForLevel(state.level);
    state.size = cfg.size;
    state.need = cfg.need;
    state.cfg = cfg;
    state.selected = [];
    state.target = [];
    state.guesses = 0;
    state.correct = 0;
    state.phase = "select";
    state.transform = null;
    el.tlabel.innerHTML = "&nbsp;";
    el.ready.disabled = true;
    el.ready.textContent = "Ready ►";

    const cellPx = state.size <= 5 ? 52 : state.size <= 6 ? 46 : 40;
    state.grid = new Grid(el.board, state.size, { cell: cellPx, onClick });
    el.board.style.setProperty("--spin", "0deg");
    el.board.classList.remove("flip-h", "flip-v");

    banner(el.banner, `Select ${state.need} cells to memorise`, "info");
    renderHud();
  }

  function onClick(i) {
    if (state.phase === "select") {
      const pos = state.selected.indexOf(i);
      if (pos >= 0) {
        state.selected.splice(pos, 1);
        state.grid.remove(i, "sel");
      } else if (state.selected.length < state.need) {
        state.selected.push(i);
        state.grid.add(i, "sel");
        state.grid.pop(i);
      }
      const done = state.selected.length === state.need;
      el.ready.disabled = !done;
      banner(el.banner,
        done ? "Locked in — hit Ready" : `Select ${state.need - state.selected.length} more`,
        done ? "good" : "info");
    } else if (state.phase === "guess") {
      guess(i);
    }
  }

  function onReady() {
    if (state.phase !== "select" || state.selected.length !== state.need) return;
    state.phase = "memorise";
    el.ready.disabled = true;
    state.grid.lock();
    renderHud();

    // pick the transform for this round
    const pool = state.cfg.pool;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    state.transform = isRotate ? { type: "rotate", deg: pick } : { type: "mirror", axis: pick };
    state.target = state.selected.map(transformIndex);

    // memorise countdown while the pattern is still shown
    let t = Math.ceil(state.cfg.memoriseMs / 1000);
    banner(el.banner, `Memorise… ${t}`, "info");
    const iv = setInterval(() => {
      t--;
      if (t > 0) banner(el.banner, `Memorise… ${t}`, "info");
      else { clearInterval(iv); hideAndTransform(); }
    }, 1000);
  }

  function hideAndTransform() {
    state.grid.clearState(); // hide the pattern
    el.tlabel.textContent = transformText();
    state.phase = "transform";
    renderHud();

    // flourish that communicates the transform, then settle upright for guessing
    if (state.transform.type === "rotate") {
      el.board.style.setProperty("--spin", state.transform.deg + "deg");
      setTimeout(() => el.board.style.setProperty("--spin", "0deg"), 950);
    } else {
      el.board.classList.add(state.transform.axis === "v" ? "flip-v" : "flip-h");
      setTimeout(() => el.board.classList.remove("flip-h", "flip-v"), 950);
    }

    setTimeout(() => {
      state.phase = "guess";
      state.grid.unlock();
      banner(el.banner, `Now click the ${state.need} TRANSFORMED positions`, "info");
      renderHud();
    }, 1750);
  }

  function guess(i) {
    if (state.grid.has(i, "correct") || state.grid.has(i, "wrong")) return;
    state.guesses++;
    if (state.target.includes(i)) {
      state.grid.add(i, "correct");
      state.correct++;
    } else {
      state.grid.add(i, "wrong");
    }
    state.grid.pop(i);
    if (state.guesses >= state.need) endRound();
  }

  function endRound() {
    state.phase = "review";
    state.grid.lock();
    // reveal any missed correct positions as ghosts
    state.target.forEach((i) => { if (!state.grid.has(i, "correct")) state.grid.add(i, "ghost"); });

    const perfect = state.correct === state.need;
    const gained = state.correct * 100 * state.level * (perfect ? state.streak : 1);
    state.score += gained;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem(bestKey, String(state.best));
    }
    renderHud();

    if (perfect) {
      state.streak++;
      state.level++;
      banner(el.banner, `PERFECT!  +${gained}`, "good");
      overlay("Perfect Round", `+${gained} points · advancing to level ${state.level}`,
        [{ label: "Next ►", kind: "primary", onClick: newRound }]);
    } else {
      state.streak = 1;
      state.lives--;
      banner(el.banner, `${state.correct}/${state.need} correct  ·  +${gained}`, "bad");
      renderHud();
      if (state.lives <= 0) return gameOver();
      overlay("Round Missed", `${state.correct}/${state.need} correct · ${state.lives} ♥ left`,
        [{ label: "Retry ►", kind: "magenta", onClick: newRound }]);
    }
  }

  function gameOver() {
    banner(el.banner, "Game over", "bad");
    overlay("Game Over", `Final score ${state.score} · best ${state.best}`, [
      { label: "Play again", kind: "primary", onClick: () => { Object.assign(state, { level: 1, score: 0, streak: 1, lives: 3 }); newRound(); } },
      { label: "Menu", kind: "ghost", onClick: () => (location.href = "../../index.html") },
    ]);
  }

  el.ready.addEventListener("click", onReady);
  $("#howBtn").addEventListener("click", () =>
    overlay(isRotate ? "Rotation Memory" : "Mirror Memory",
      isRotate
        ? "Memorise the highlighted cells. The grid then rotates — click where those cells LAND after the rotation. Perfect rounds level you up; larger grids, more cells and bigger rotations follow."
        : "Memorise the highlighted cells. The grid then mirrors — click where those cells LAND after the flip. Perfect rounds level you up and add tougher mirror axes.",
      [{ label: "Got it", kind: "primary" }]));

  newRound();
})();
