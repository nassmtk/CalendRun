/* =========================================================
   ALLURE — point d'entrée Vite
   ========================================================= */
import "./styles/tokens.css";
import "./styles/main.css";

import "./brand-global.js";
import "../config.js";
import "../data/races.js";
import "./app.js";

import { initCardTilt, initKudos } from "./motion/cards.js";
import { initSmoothScroll, initHeroIntro, initStats, initNextUp, initNavTimer, initRegisteredFx, initViewSwap, initGridFlow, initFiltersFab, initPills, initMagnetic, initSheetTransition } from "./motion/flow.js";
import { initDeptMenu, initMapDrawer } from "./ui/drawer.js";
import { canHover, reduced } from "./motion/env.js";

const A = window.ALLURE;
// Leaflet : chargé seulement à l'ouverture de la vue Carte
A.loadLeaflet = () => import("./vendor-leaflet.js").then((m) => m.ready);

if (canHover() && !reduced()) document.documentElement.classList.add("tilt-on");

// hooks à enregistrer AVANT le premier rendu
initSmoothScroll(A);
initNextUp(A);
initNavTimer(A);
initRegisteredFx(A);
initViewSwap(A);
initGridFlow(A);
initFiltersFab(A);
initMapDrawer(A);
initPills(A);
initSheetTransition(A);

A.boot();

// après le premier rendu
initCardTilt(document.getElementById("results"));
initDeptMenu();
initKudos();
initMagnetic();
initHeroIntro();
initStats();

/* scène 3D : chargée à la demande (code-split), seulement si le hero est visible */
const host = document.getElementById("hero-3d");
if (host) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    import("./hero/index.js").then((m) => m.mountHero(host)).catch((err) => console.warn("[site] 3D indisponible", err));
  });
  io.observe(host);
}
