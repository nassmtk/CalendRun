/* Couche motion (GSAP, Flip, Lenis…) : chargée APRÈS le premier affichage, hors chemin critique */
import { initCardTilt, initKudos } from "./cards.js";
import { initSmoothScroll, initStats, initNextUp, initNavTimer, initRegisteredFx, initViewSwap, initGridFlow, initFiltersFab, initPills, initMagnetic, initSheetTransition } from "./flow.js";
import { initMapDrawer } from "../ui/drawer.js";
import { initTurnstile } from "../turnstile.js";

export function start(A) {
  // hooks à enregistrer AVANT le rendu du catalogue
  initSmoothScroll(A);
  initNextUp(A);
  initNavTimer(A);
  initRegisteredFx(A);
  initViewSwap(A);
  initGridFlow(A);
  initFiltersFab(A);
  initMapDrawer(A);
  if (window.SITE_CONFIG.ALERTS_ENABLED) initTurnstile(A);
  initPills(A);
  initSheetTransition(A);
  // le hero a été rendu avant le chargement de ce module : on rejoue ses hooks
  if (A.heroNext) A.hooks.afterHero.forEach((f) => f(A.heroNext));
  A.hooks.navUpdate.forEach((f) => f(A.nextRegistered()));
  initStats();
  initKudos();
  initMagnetic();
  initCardTilt(document.getElementById("results"));
}
