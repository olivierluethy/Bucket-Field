/* Shared square-grid component. State is driven by CSS classes, never inline colors. */
class Grid {
  constructor(el, size, opts = {}) {
    const { cell = 44, onClick } = opts;
    this.el = el;
    this.size = size;
    this.cells = [];
    el.classList.add("grid");
    el.style.setProperty("--cell", cell + "px");
    el.style.gridTemplateColumns = `repeat(${size}, var(--cell))`;
    el.innerHTML = "";
    for (let i = 0; i < size * size; i++) {
      const c = document.createElement("div");
      c.className = "cell";
      c.dataset.i = i;
      el.appendChild(c);
      this.cells.push(c);
    }
    if (onClick) {
      el.addEventListener("click", (e) => {
        const c = e.target.closest(".cell");
        if (!c || !el.contains(c) || el.classList.contains("locked")) return;
        onClick(Number(c.dataset.i), c);
      });
    }
  }

  cell(i) { return this.cells[i]; }
  rc(i) { return [Math.floor(i / this.size), i % this.size]; }
  idx(r, c) { return r * this.size + c; }
  inBounds(r, c) { return r >= 0 && c >= 0 && r < this.size && c < this.size; }

  clearState() { this.cells.forEach((c) => (c.className = "cell")); }
  add(i, cls) { this.cell(i).classList.add(cls); }
  remove(i, cls) { this.cell(i).classList.remove(cls); }
  has(i, cls) { return this.cell(i).classList.contains(cls); }
  reset(i) { this.cell(i).className = "cell"; }
  text(i, t) { this.cell(i).textContent = t; }

  lock() { this.el.classList.add("locked"); }
  unlock() { this.el.classList.remove("locked"); }

  pop(i) {
    const c = this.cell(i);
    c.classList.remove("pop");
    void c.offsetWidth; // reflow to restart animation
    c.classList.add("pop");
  }

  neighbors(i) {
    const [r, c] = this.rc(i);
    const out = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        if (this.inBounds(r + dr, c + dc)) out.push(this.idx(r + dr, c + dc));
      }
    return out;
  }
}

/* ---- geometry: rotate / mirror a cell index within an S×S grid ---- */
const Transform = {
  rotate(i, size, deg) {
    const r = Math.floor(i / size), c = i % size, S = size - 1;
    let nr, nc;
    if (deg === 90) { nr = c; nc = S - r; }
    else if (deg === 180) { nr = S - r; nc = S - c; }
    else if (deg === 270) { nr = S - c; nc = r; }
    else { nr = r; nc = c; }
    return nr * size + nc;
  },
  mirror(i, size, axis) {
    const r = Math.floor(i / size), c = i % size, S = size - 1;
    let nr = r, nc = c;
    if (axis === "h") nc = S - c;        // left-right flip
    else if (axis === "v") nr = S - r;   // top-bottom flip
    else if (axis === "d") { nr = c; nc = r; } // transpose (main diagonal)
    return nr * size + nc;
  },
};
