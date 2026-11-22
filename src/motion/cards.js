/* =========================================================
   Cartes : inclinaison 3D (ressort GSAP), reflet, bordure
   lumineuse, favori façon « kudos ».
   GSAP est le SEUL propriétaire du transform de .card.
   ========================================================= */
import { gsap } from "gsap";
import { canHover, reduced } from "./env.js";

const MAX = 6;        // ° max
const SCALE = 1.02;   // agrandissement max

export function initCardTilt(root = document) {
  if (!canHover() || reduced()) return;

  const state = new WeakMap(); // wrap → setters quickTo
  let current = null;

  const setup = (wrap) => {
    let s = state.get(wrap);
    if (s) return s;
    const card = wrap.firstElementChild;
    gsap.set(card, { transformPerspective: 0, force3D: true }); // la perspective vient du wrapper
    const opts = { duration: 0.6, ease: "power3.out" };
    s = {
      card,
      rx: gsap.quickTo(card, "rotationX", opts),
      ry: gsap.quickTo(card, "rotationY", opts),
      sc: gsap.quickTo(card, "scale", opts),
      glow: gsap.quickTo(card, "--glow", { duration: 0.4, ease: "power2.out" })
    };
    state.set(wrap, s);
    return s;
  };

  const leave = (wrap) => {
    const s = state.get(wrap);
    if (!s) return;
    s.rx(0); s.ry(0); s.sc(1); s.glow(0);
    wrap.classList.remove("is-hover");
  };

  root.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const wrap = e.target.closest?.(".card-wrap");
    if (wrap !== current) { if (current) leave(current); current = wrap; }
    if (!wrap) return;
    const s = setup(wrap);
    const b = wrap.getBoundingClientRect(); // on mesure le wrapper (fixe), pas la carte transformée
    const x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
    s.card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    s.card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
    s.ry((x - 0.5) * 2 * MAX);
    s.rx((0.5 - y) * 2 * MAX);
    s.sc(SCALE);
    s.glow(1);
    wrap.classList.add("is-hover");
  }, { passive: true });

  root.addEventListener("pointerout", (e) => {
    if (!current) return;
    if (e.relatedTarget && current.contains(e.relatedTarget)) return;
    if (e.target.closest?.(".card-wrap") !== current) return;
    leave(current); current = null;
  });

  // re-rendu de la grille : on oublie la carte survolée
  return { reset() { current = null; } };
}

/* ---------- favori façon kudos ---------- */
export function initKudos() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest?.("[data-fav]");
    if (!btn) return;
    // app.js met à jour aria-pressed dans le même tick : on lit l'état juste après
    requestAnimationFrame(() => {
      const on = btn.getAttribute("aria-pressed") === "true";
      const all = document.querySelectorAll(`[data-fav="${btn.dataset.fav}"]`);
      all.forEach((b) => {
        if (reduced()) return;
        gsap.fromTo(b, { scale: on ? 0.7 : 1.15 }, { scale: 1, duration: 0.5, ease: "back.out(3)", clearProps: "scale" });
      });
      if (on && !reduced()) burst(btn);
      rollBadge(on ? 1 : -1);
    });
  });
}

function burst(btn) {
  const wrap = document.createElement("span");
  wrap.className = "burst";
  const N = 10;
  for (let i = 0; i < N; i++) wrap.appendChild(document.createElement("i"));
  btn.appendChild(wrap);
  [...wrap.children].forEach((p, i) => {
    const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
    const d = 18 + Math.random() * 14;
    gsap.fromTo(p, { x: 0, y: 0, scale: 1, opacity: 1 }, {
      x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0, opacity: 0,
      duration: 0.6 + Math.random() * 0.2, ease: "power3.out"
    });
  });
  setTimeout(() => wrap.remove(), 900);
}

function rollBadge(dir) {
  const badge = document.getElementById("fav-count");
  if (!badge || reduced()) return;
  gsap.fromTo(badge, { y: dir * 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out", clearProps: "transform,opacity" });
}
