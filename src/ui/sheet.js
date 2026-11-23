/* =========================================================
   Tiroir du bas (bottom sheet) accessible — chemin critique, sans GSAP
   Utilisé sur mobile (< 768 px) pour les départements et le menu.
   - placé directement sous <body> : jamais piégé par le transform / le
     backdrop-filter de la barre du haut (cause du bug des départements)
   - fermeture : glisser vers le bas, tap sur le fond, Échap
   - focus piégé dans le tiroir puis rendu au bouton d'origine
   - défilement de la page bloqué pendant l'ouverture (iOS compris)
   ========================================================= */
export const MOBILE_MQ = "(max-width: 767.98px)";
export const isMobile = () => matchMedia(MOBILE_MQ).matches;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let current = null; // un seul tiroir ouvert à la fois
let scrollY = 0;

/* ---------- blocage du défilement ---------- */
function lockScroll() {
  const A = window.CALENDRUN;
  A?.lenis?.stop();
  scrollY = window.scrollY;
  const html = document.documentElement;
  html.classList.add("scroll-locked");
  // iOS Safari ignore overflow:hidden sur body : on fige le body à sa position
  document.body.style.top = `-${scrollY}px`;
}
function unlockScroll() {
  const html = document.documentElement;
  html.classList.remove("scroll-locked");
  document.body.style.top = "";
  // retour instantané à la position d'origine (sans animation de défilement)
  const prev = html.style.scrollBehavior;
  html.style.scrollBehavior = "auto";
  window.scrollTo(0, scrollY);
  html.style.scrollBehavior = prev;
  // Lenis a vu la page à 0 pendant le blocage : on le recale sur la vraie position
  const lenis = window.CALENDRUN?.lenis;
  if (lenis) { lenis.start(); lenis.resize?.(); lenis.scrollTo(scrollY, { immediate: true, force: true }); }
}

/**
 * Prépare un tiroir. `el` = élément .bsheet (hidden par défaut).
 * Renvoie { open(trigger), close(), isOpen() }.
 */
export function createSheet(el, { onOpen, onClose } = {}) {
  const scrim = document.getElementById("sheet-scrim");
  const handle = el.querySelector("[data-sheet-drag]") || el;
  let trigger = null;

  const focusables = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);

  function open(from) {
    if (current && current !== api) current.close({ restoreFocus: false });
    current = api;
    trigger = from || document.activeElement;
    el.hidden = false;
    scrim.hidden = false;
    lockScroll();
    trigger?.setAttribute?.("aria-expanded", "true");
    onOpen && onOpen();
    // double rAF : la transition part bien de l'état fermé
    requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add("is-open"); scrim.classList.add("is-open"); }));
    const first = el.querySelector("[data-sheet-autofocus]") || el.querySelector("[data-dept][aria-pressed=true]") || focusables()[0];
    first?.focus({ preventScroll: true });
    document.addEventListener("keydown", onKey, true);
  }

  function close({ restoreFocus = true } = {}) {
    if (el.hidden) return;
    el.classList.remove("is-open");
    scrim.classList.remove("is-open");
    el.style.transform = "";
    document.removeEventListener("keydown", onKey, true);
    trigger?.setAttribute?.("aria-expanded", "false");
    const done = () => { if (!el.classList.contains("is-open")) { el.hidden = true; if (current === null) scrim.hidden = true; } };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    reduce ? done() : setTimeout(done, 280);
    if (current === api) current = null;
    unlockScroll();
    if (restoreFocus && trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    onClose && onClose();
  }

  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== "Tab") return;
    const f = focusables();
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- glisser vers le bas pour fermer ---------- */
  let startY = 0, dy = 0, t0 = 0, dragging = false;
  handle.addEventListener("pointerdown", (e) => {
    if (e.button > 0 || e.target.closest("button:not([data-sheet-drag]), a, input")) return;
    dragging = true; startY = e.clientY; dy = 0; t0 = performance.now();
    el.classList.add("is-dragging");
    handle.setPointerCapture?.(e.pointerId);
  });
  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dy = Math.max(0, e.clientY - startY);
    el.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove("is-dragging");
    const v = dy / Math.max(1, performance.now() - t0); // px/ms
    if (dy > Math.min(120, el.offsetHeight * 0.3) || (dy > 30 && v > 0.5)) close();
    else el.style.transform = "";
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);

  scrim.addEventListener("click", () => { if (current === api) close(); });
  el.addEventListener("click", (e) => { if (e.target.closest("[data-sheet-close]")) close(); });

  const api = { open, close, isOpen: () => !el.hidden && el.classList.contains("is-open") || (!el.hidden && current === api), el };
  return api;
}
