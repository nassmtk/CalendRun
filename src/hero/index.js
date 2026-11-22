/* =========================================================
   ALLURE — hero : choisit la scène WebGL (desktop) ou le repli SVG
   Three.js n'est téléchargé que si la scène WebGL est utilisée.
   ========================================================= */
import { A, tokHex, MONTHS, L, xOf, dayOf, layout } from "./layout.js";

/* =========================================================
   Point d'entrée
   ========================================================= */
export function mountHero(host) {
  const small = matchMedia("(max-width: 760px)").matches;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (small || reduced || !webglOk()) return mountFallback(host);
  import("./scene.js").then((m) => m.mountScene(host)).catch((e) => { console.warn("[Allure] WebGL KO, repli", e); mountFallback(host); });
}

function webglOk() {
  try { const c = document.createElement("canvas"); return !!c.getContext("webgl2"); } catch { return false; }
}

/* =========================================================
   Repli statique (mobile / reduced-motion) — SVG léger
   ========================================================= */
function mountFallback(host) {
  const items = layout(A.races);
  const W = 1200, H = 700, ox = 600, oy = 470;
  // projection oblique simple : x → droite, z → profondeur (vers le haut-gauche), y → haut
  const P = (x, y, z) => [ox + x * 17 - z * 7, oy - y * 18 - z * 5 - x * 2.4];
  const ground = [P(-L, 0, 0), P(L, 0, 0)];
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><linearGradient id="fb-g" x1="0" x2="1"><stop offset="0" stop-color="${tokHex("--accent")}"/><stop offset="1" stop-color="${tokHex("--accent-2")}"/></linearGradient></defs>
    <line x1="${ground[0][0]}" y1="${ground[0][1]}" x2="${ground[1][0]}" y2="${ground[1][1]}" stroke="url(#fb-g)" stroke-width="2" opacity=".8"/>`;
  for (let m = 0; m < 12; m++) {
    const x = xOf(dayOf(new Date(2027, m, 1)));
    const [a, b] = P(x, 0, 0), [c, d] = P(x, 0, 14);
    svg += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="${tokHex("--accent")}" stroke-opacity=".18"/>`;
    svg += `<text x="${a + 4}" y="${b + 18}" fill="${tokHex("--muted")}" font-family="JetBrains Mono, monospace" font-size="11" letter-spacing="1">${MONTHS[m]}</text>`;
  }
  items.sort((p, q) => q.z - p.z).forEach((it) => {
    const [x0, y0] = P(it.x, 0, it.z), [, y1] = P(it.x, it.h, it.z);
    svg += `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" style="stroke:var(${it.cat})" stroke-width="3" stroke-linecap="round" opacity=".9"/>`;
    svg += `<circle cx="${x0}" cy="${y1}" r="3" style="fill:var(${it.cat})"/>`;
  });
  svg += "</svg>";
  host.innerHTML = `<div class="hero-fallback">${svg}</div>`;
  host.classList.add("ready");
}

