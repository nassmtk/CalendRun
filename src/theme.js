/* =========================================================
   Bouton jour / nuit
   - thème sombre par défaut (direction artistique), clair sur demande
   - choix mémorisé dans localStorage (appliqué avant l'affichage par le
     script inline du <head>, voir scripts/lib/theme-init.mjs)
   - bascule animée : cercle qui s'ouvre depuis le bouton (View Transitions),
     instantanée si l'animation est désactivée ou non prise en charge
   - événement « calendrun:theme » pour le hero 3D / SVG
   ========================================================= */
const KEY = "calendrun:theme";
const root = document.documentElement;
const META_COLOR = { dark: "#0A0A0B", light: "#F6F4F0" };

export const currentTheme = () => (root.dataset.theme === "light" ? "light" : "dark");

function sync() {
  const t = currentTheme();
  document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
    b.setAttribute("aria-label", t === "light" ? "Activer le mode nuit" : "Activer le mode jour");
    b.setAttribute("aria-pressed", String(t === "light"));
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_COLOR[t]);
}

function apply(t) {
  if (t === "light") root.dataset.theme = "light";
  else delete root.dataset.theme;
  try { localStorage.setItem(KEY, t); } catch { /* navigation privée */ }
  sync();
  document.dispatchEvent(new CustomEvent("calendrun:theme", { detail: { theme: t } }));
}

function toggle(btn) {
  const next = currentTheme() === "light" ? "dark" : "light";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return apply(next);
  const r = btn.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add("theme-vt");
  const vt = document.startViewTransition(() => apply(next));
  vt.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 560, easing: "cubic-bezier(.22, 1, .36, 1)", pseudoElement: "::view-transition-new(root)" }
    );
  }).catch(() => {});
  vt.finished.finally(() => root.classList.remove("theme-vt"));
}

document.addEventListener("click", (e) => {
  const btn = e.target instanceof Element ? e.target.closest("[data-theme-toggle]") : null;
  if (btn) toggle(btn);
});
sync();
