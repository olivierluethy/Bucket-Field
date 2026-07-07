/* GRID// menu — screen navigation + live mode previews. */
(() => {
  const screens = [...document.querySelectorAll(".screen")];
  function goto(name) {
    screens.forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
  }

  // navigation
  document.querySelectorAll("[data-goto]").forEach((el) =>
    el.addEventListener("click", () => goto(el.dataset.goto))
  );
  document.querySelectorAll("[data-play]").forEach((el) =>
    el.addEventListener("click", () => (location.href = el.dataset.play))
  );

  // keyboard: Enter advances from boot; Esc steps back
  document.addEventListener("keydown", (e) => {
    const active = document.querySelector(".screen.active");
    if (e.key === "Enter" && active?.id === "screen-boot") goto("path");
    if (e.key === "Escape") {
      const map = { path: "boot", single: "path", multi: "path" };
      const cur = active?.id.replace("screen-", "");
      if (map[cur]) goto(map[cur]);
    }
  });

  // build the little animated preview grids inside each mode card
  document.querySelectorAll(".preview").forEach((pv) => {
    const on = (pv.dataset.cells || "").split(",").filter(Boolean).map(Number);
    const nums = {};
    (pv.dataset.nums || "").split(",").filter(Boolean).forEach((pair) => {
      const [idx, n] = pair.split(":").map(Number);
      nums[idx] = n;
    });
    for (let i = 0; i < 9; i++) {
      const c = document.createElement("div");
      c.className = "pcell";
      if (on.includes(i)) c.classList.add("on");
      if (nums[i] != null) { c.classList.add("num"); c.textContent = nums[i]; }
      pv.appendChild(c);
    }
  });
})();
