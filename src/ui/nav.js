/* =========================================================
   Barre du haut — départements et menu compact (chemin critique)
   ≥ 1100 px : segmented control dans la barre
   768–1099 px : bouton « Départements » + menu déroulant
   < 768 px  : bouton « Départements » + tiroir du bas (#dept-sheet),
               Favoris / Inscrites / Contact / thème dans le menu (#menu-sheet)
   ========================================================= */
import { createSheet, isMobile } from "./sheet.js";

const $ = (s) => document.querySelector(s);

export function initNav() {
  const btn = $("#dept-toggle");
  const pop = $("#dept-pop");
  const deptSheetEl = $("#dept-sheet");
  const menuBtn = $("#menu-toggle");
  const menuEl = $("#menu-sheet");
  if (!btn || !deptSheetEl) return;

  const deptSheet = createSheet(deptSheetEl);
  const menu = menuEl ? createSheet(menuEl) : null;

  /* ---- menu déroulant (tablette) ---- */
  const popOpen = (on) => {
    pop.hidden = !on;
    btn.setAttribute("aria-expanded", String(on));
    if (on) (pop.querySelector("[aria-pressed=true]") || pop.querySelector("button"))?.focus({ preventScroll: true });
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isMobile()) { popOpen(false); deptSheet.open(btn); }
    else popOpen(pop.hidden);
  });
  document.addEventListener("click", (e) => {
    if (pop.hidden || pop.contains(e.target) || btn.contains(e.target)) return;
    popOpen(false);
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { popOpen(false); btn.focus(); } });

  /* « Voir les X courses » : ferme puis descend jusqu'aux résultats */
  $("#dept-see")?.addEventListener("click", () => {
    deptSheet.close({ restoreFocus: false });
    const target = $("#results-count");
    requestAnimationFrame(() => (window.CALENDRUN?.scrollTo || ((el) => el.scrollIntoView()))(target));
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  });

  /* ---- menu compact ---- */
  if (menu) {
    menuBtn.addEventListener("click", () => menu.open(menuBtn));
    // un choix dans le menu (liste, lien) ferme le menu ; le thème reste ouvert pour voir le changement
    menuEl.addEventListener("click", (e) => {
      const row = e.target.closest("a, button");
      if (row && !row.hasAttribute("data-theme-toggle")) menu.close({ restoreFocus: !row.matches("a[href^='/'], [data-list]") });
    });
  }

  /* passage desktop ↔ mobile pendant qu'un panneau est ouvert : on ferme proprement */
  matchMedia("(max-width: 767.98px)").addEventListener("change", () => {
    deptSheet.close({ restoreFocus: false });
    menu?.close({ restoreFocus: false });
    popOpen(false);
  });
}
