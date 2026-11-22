/* =========================================================
   Tiroirs (bottom sheets) glissables + menu déroulant des départements
   - même composant pour le choix des départements (mobile) et la liste
     de la vue Carte (mobile)
   ========================================================= */
import { gsap } from "gsap";
import { reduced } from "../motion/env.js";

const mq = (q) => matchMedia(q).matches;
const isPhone = () => mq("(max-width: 640px)");

/**
 * Rend un .drawer glissable par sa poignée.
 * snaps : positions en % de la hauteur du tiroir (0 = ouvert en entier)
 */
export function makeDraggable(drawer, { snaps = [0, 1], onSnap } = {}) {
  const handle = drawer.querySelector(".drawer-handle") || drawer;
  let startY = 0, startP = 0, p = snaps[snaps.length - 1], h = 1, dragging = false;
  const apply = (v, anim) => {
    p = v;
    const y = () => `${(p * 100).toFixed(2)}%`;
    if (anim && !reduced()) gsap.to(drawer, { y: y(), duration: 0.35, ease: "expo.out" });
    else gsap.set(drawer, { y: y() });
  };
  const nearest = (v) => snaps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  handle.addEventListener("pointerdown", (e) => {
    dragging = true; startY = e.clientY; startP = p; h = drawer.offsetHeight || 1;
    handle.setPointerCapture(e.pointerId);
    gsap.killTweensOf(drawer);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    apply(Math.min(1, Math.max(0, startP + (e.clientY - startY) / h)), false);
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    const moved = Math.abs(e.clientY - startY) > 6;
    const target = moved ? nearest(p) : (p === snaps[0] ? snaps[snaps.length - 1] : snaps[0]); // un tap bascule
    apply(target, true);
    onSnap && onSnap(target);
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
  return { snap: (v) => { apply(v, true); onSnap && onSnap(v); }, reset: () => gsap.set(drawer, { clearProps: "transform" }) };
}

/* ---------- départements : menu déroulant (< 1100 px) / tiroir (mobile) ---------- */
export function initDeptMenu() {
  const btn = document.getElementById("dept-toggle");
  const pop = document.getElementById("dept-pop");
  const scrim = document.getElementById("scrim");
  let drag = null;
  const open = (on) => {
    pop.hidden = !on;
    btn.setAttribute("aria-expanded", String(on));
    const phone = isPhone();
    scrim.hidden = !(on && phone);
    pop.classList.toggle("is-drawer", phone);
    if (on && phone) {
      drag = drag || makeDraggable(pop, { snaps: [0, 1], onSnap: (v) => v === 1 && open(false) });
      gsap.set(pop, { y: "100%" });
      drag.snap(0);
    } else if (drag) drag.reset();
    if (on) (pop.querySelector("[aria-pressed=true]") || pop.querySelector("button"))?.focus({ preventScroll: true });
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); open(pop.hidden); });
  scrim.addEventListener("click", () => open(false));
  document.addEventListener("click", (e) => {
    if (pop.hidden || pop.contains(e.target) || btn.contains(e.target)) return;
    if (!isPhone()) open(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { open(false); btn.focus(); } });
  addEventListener("resize", () => { if (!pop.hidden && !isPhone() && pop.classList.contains("is-drawer")) open(false); });
}

/* ---------- vue Carte (mobile) : la liste est un tiroir glissable ---------- */
export function initMapDrawer(A) {
  A.hooks.afterRender.push((state) => {
    if (state.view !== "map") return;
    const list = document.getElementById("map-list");
    if (!list || list.dataset.drawer) return;
    list.dataset.drawer = "1";
    if (!isPhone()) return;
    // positions : replié (seule la poignée + le titre dépassent), mi-hauteur, ouvert
    const d = makeDraggable(list, { snaps: [0, 0.45, 0.86] });
    d.snap(0.86);
  });
}
