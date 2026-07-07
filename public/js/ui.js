/* Tiny UI utilities shared across game modes (no alert() anywhere). */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function banner(el, msg, kind = "") {
  el.className = "banner" + (kind ? " " + kind : "");
  el.textContent = msg;
}

let _toastTimer;
function toast(msg) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* overlay(title, subtitle, buttons[]) — buttons: {label, kind, onClick} */
function overlay(title, subtitle, buttons = []) {
  let o = $("#overlay");
  if (!o) {
    o = document.createElement("div");
    o.id = "overlay";
    o.className = "overlay";
    o.innerHTML = `<div class="panel card"><h2></h2><p></p><div class="controls"></div></div>`;
    document.body.appendChild(o);
  }
  $("h2", o).textContent = title;
  $("h2", o).style.color = "var(--cyan)";
  $("p", o).textContent = subtitle;
  const bwrap = $(".controls", o);
  bwrap.innerHTML = "";
  buttons.forEach((b) => {
    const el = document.createElement("button");
    el.className = "btn " + (b.kind || "primary");
    el.textContent = b.label;
    el.onclick = () => { hideOverlay(); b.onClick && b.onClick(); };
    bwrap.appendChild(el);
  });
  o.classList.add("show");
  return o;
}
function hideOverlay() { const o = $("#overlay"); if (o) o.classList.remove("show"); }

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(n, count) {
  const pool = shuffle([...Array(n).keys()]);
  return pool.slice(0, count);
}
