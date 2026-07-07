/* ============================================================
   Deduction Duel — single-player vs a deducing bot.
   Both sides hide K treasures on an S×S grid. Players alternate
   probing the enemy grid. Every probe reveals hit/miss AND a
   proximity number (treasures among the 8 neighbours) — the clue
   both sides use to DEDUCE treasure locations. First to find all
   K wins. The bot runs a constraint/probability solver.
   ============================================================ */
(() => {
  const SIZE = 8;
  const K = 10;

  const el = {
    banner: $("#banner"), you: $("#statYou"), bot: $("#statBot"), target: $("#statTarget"),
    turn: $("#turnPill"), start: $("#startBtn"), random: $("#randomBtn"),
  };
  el.target.textContent = K;

  const state = {
    phase: "place", // place | battle | over
    myTreasures: new Set(),      // your treasures (bot hunts these)
    enemyTreasures: new Set(),   // bot's treasures (you hunt these)
    youFound: 0, botFound: 0,
    botKnowledge: new Map(),     // index -> {treasure, prox} — what the bot has learned about YOUR grid
    yourTurn: true, busy: false,
  };

  function proximity(treasures, i, gridForNb) {
    return gridForNb.neighbors(i).filter((n) => treasures.has(n)).length;
  }

  const myGrid = new Grid($("#myBoard"), SIZE, { cell: 44, onClick: onMyClick });
  const enemyGrid = new Grid($("#enemyBoard"), SIZE, { cell: 44, onClick: onEnemyClick });
  enemyGrid.lock();

  /* ---------------- placement phase ---------------- */
  function onMyClick(i) {
    if (state.phase !== "place") return;
    if (state.myTreasures.has(i)) {
      state.myTreasures.delete(i);
      myGrid.remove(i, "sel");
    } else if (state.myTreasures.size < K) {
      state.myTreasures.add(i);
      myGrid.add(i, "sel");
      myGrid.pop(i);
    }
    const done = state.myTreasures.size === K;
    el.start.disabled = !done;
    banner(el.banner, done ? "Ready — start the duel" : `Place ${K - state.myTreasures.size} more treasures`,
      done ? "good" : "info");
  }

  el.random.addEventListener("click", () => {
    if (state.phase !== "place") return;
    myGrid.clearState();
    state.myTreasures = new Set(sample(SIZE * SIZE, K));
    state.myTreasures.forEach((i) => myGrid.add(i, "sel"));
    el.start.disabled = false;
    banner(el.banner, "Ready — start the duel", "good");
  });

  el.start.addEventListener("click", startBattle);

  function startBattle() {
    if (state.myTreasures.size !== K) return;
    state.phase = "battle";
    state.enemyTreasures = new Set(sample(SIZE * SIZE, K));
    myGrid.lock();
    enemyGrid.unlock();
    el.start.classList.add("hidden");
    el.random.classList.add("hidden");
    state.yourTurn = true;
    setTurn();
    banner(el.banner, "Your move — probe the enemy grid", "info");
  }

  function setTurn() {
    el.turn.textContent = state.yourTurn ? "Your turn" : "Bot thinking…";
    el.turn.className = "pill turn";
  }

  /* ---------------- your probes ---------------- */
  function onEnemyClick(i) {
    if (state.phase !== "battle" || !state.yourTurn || state.busy) return;
    if (enemyGrid.has(i, "hit") || enemyGrid.has(i, "miss")) return;
    const isT = state.enemyTreasures.has(i);
    const prox = proximity(state.enemyTreasures, i, enemyGrid);
    if (isT) {
      enemyGrid.add(i, "hit");
      enemyGrid.text(i, "★");
      state.youFound++;
      el.you.textContent = state.youFound;
    } else {
      enemyGrid.add(i, "miss");
      if (prox > 0) enemyGrid.text(i, prox);
    }
    enemyGrid.pop(i);
    if (state.youFound >= K) return finish(true);

    state.yourTurn = false;
    setTurn();
    state.busy = true;
    setTimeout(botMove, 620);
  }

  /* ---------------- bot probes (deduction) ---------------- */
  function botMove() {
    const i = botChoose();
    const isT = state.myTreasures.has(i);
    const prox = proximity(state.myTreasures, i, myGrid);
    state.botKnowledge.set(i, { treasure: isT, prox });
    if (isT) {
      myGrid.remove(i, "sel");
      myGrid.add(i, "enemy");
      myGrid.text(i, "★");
      state.botFound++;
      el.bot.textContent = state.botFound;
    } else {
      myGrid.add(i, "miss");
      if (prox > 0) myGrid.text(i, prox);
    }
    myGrid.pop(i);
    state.busy = false;
    if (state.botFound >= K) return finish(false);

    state.yourTurn = true;
    setTurn();
    banner(el.banner, "Your move — probe the enemy grid", "info");
  }

  // Constraint + probability solver over what the bot knows about YOUR grid.
  function botChoose() {
    const N = SIZE * SIZE;
    const known = state.botKnowledge;
    const nb = (i) => myGrid.neighbors(i);
    const unknown = [];
    for (let i = 0; i < N; i++) if (!known.has(i)) unknown.push(i);
    if (unknown.length === 1) return unknown[0];

    const safe = new Set();
    const forced = [];
    for (const [c, info] of known) {
      const neigh = nb(c);
      const unk = neigh.filter((n) => !known.has(n));
      if (!unk.length) continue;
      const knownT = neigh.filter((n) => known.get(n)?.treasure).length;
      const remain = info.prox - knownT;
      if (remain <= 0) unk.forEach((u) => safe.add(u));
      else if (remain >= unk.length) unk.forEach((u) => forced.push(u));
    }
    // certain treasures first
    const sureHit = forced.filter((u) => !safe.has(u));
    if (sureHit.length) return pick(sureHit);

    const remainingTreasures = K - state.botFound;
    const prior = remainingTreasures / unknown.length;
    let best = [], bestScore = -1;
    for (const u of unknown) {
      if (safe.has(u)) continue;
      let score = prior;
      for (const c of nb(u)) {
        const info = known.get(c);
        if (!info) continue;
        const neigh = nb(c);
        const unk = neigh.filter((n) => !known.has(n));
        if (!unk.length) continue;
        const knownT = neigh.filter((n) => known.get(n)?.treasure).length;
        const remain = info.prox - knownT;
        score = Math.max(score, remain / unk.length);
      }
      if (score > bestScore) { bestScore = score; best = [u]; }
      else if (score === bestScore) best.push(u);
    }
    if (!best.length) best = unknown.filter((u) => !safe.has(u));
    if (!best.length) best = unknown; // everything looked safe; fall back
    return pick(best);
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ---------------- end ---------------- */
  function finish(youWon) {
    state.phase = "over";
    enemyGrid.lock();
    // reveal remaining enemy treasures
    state.enemyTreasures.forEach((i) => {
      if (!enemyGrid.has(i, "hit")) { enemyGrid.add(i, "ghost"); enemyGrid.text(i, "◆"); }
    });
    banner(el.banner, youWon ? "You cracked the grid!" : "The bot out-deduced you.", youWon ? "good" : "bad");
    overlay(youWon ? "Victory" : "Defeat",
      youWon ? `You found all ${K} first (${state.botFound} to the bot).`
             : `The bot found all ${K} first (${state.youFound} to you).`,
      [
        { label: "Rematch", kind: "primary", onClick: () => location.reload() },
        { label: "Menu", kind: "ghost", onClick: () => (location.href = "/") },
      ]);
  }

  $("#howBtn").addEventListener("click", () =>
    overlay("Deduction Duel",
      "You and the bot each hide 10 treasures. Take turns probing the enemy grid. Every probe shows a hit (★) or a number = treasures touching that cell (its 8 neighbours). Use the numbers to deduce where treasures hide. First to find all 10 wins — the bot deduces too, so be quick.",
      [{ label: "Got it", kind: "primary" }]));

  banner(el.banner, `Place your ${K} treasures on your grid (or use Random).`, "info");
})();
