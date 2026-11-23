/* =========================================================
   CALENDRUN — point d'entrée Vite
   Chemin critique minimal : styles, données, logique, hero.
   La couche motion (GSAP, Lenis…) est chargée juste après le premier affichage.
   ========================================================= */
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/main.css";
import "./styles/pages.css";

import "./brand-global.js";
import "./analytics.js";
import "./mail.js";
import "./theme.js";
import "../config.js";
import "../data/races.js";
import "./app.js";
import { initNav } from "./ui/nav.js";
import { initAccount } from "./account/core.js";
import { canHover, reduced } from "./motion/env.js";

const A = window.CALENDRUN;
// Leaflet : chargé seulement à l'ouverture de la vue Carte
A.loadLeaflet = () => import("./vendor-leaflet.js").then((m) => m.ready);

if (canHover() && !reduced()) document.documentElement.classList.add("tilt-on");
document.documentElement.classList.add("intro"); // entrée du hero en CSS (aucun JS requis)

A.boot({ deferCatalog: true });
initNav();
initAccount().then((me) => me && import("./account/pals.js").then((m) => m.initPals(A)).catch((e) => console.warn("[site] potes indisponibles", e)));

// motion puis catalogue (sous la ligne de flottaison), en tâches séparées
const idle = (fn, t = 600) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn, { timeout: t }) : setTimeout(fn, 1));
import("./motion/boot.js")
  .then((m) => m.start(A))
  .catch((e) => console.warn("[site] animations indisponibles", e))
  .finally(() => idle(() => A.renderCatalog()));

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
