/* =========================================================
   Hero : 12 barres (une par mois), empilées par catégorie.
   - desktop avec survol : scène WebGL interactive (scene.js, Three.js chargé ici seulement)
   - mobile / hover:none / reduced-motion / sans WebGL : version décorative SVG, sans interaction
   ========================================================= */
import { A, tokHex, MONTHS, CATS, monthStats } from "./layout.js";

export function mountHero(host) {
  const decorative = matchMedia("(hover: none), (pointer: coarse), (max-width: 760px), (prefers-reduced-motion: reduce)").matches;
  if (decorative || !webglOk()) return mountFallback(host);
  import("./scene.js").then((m) => m.mountScene(host)).catch((e) => { console.warn("[site] WebGL KO, repli", e); mountFallback(host); });
}

function webglOk() {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}

/* ---------- repli décoratif : barres isométriques en SVG ---------- */
export function mountFallback(host) {
  const stats = monthStats(A.races);
  const max = Math.max(...stats.map((s) => s.total));
  const W = 1200, H = 640, baseY = 520, slot = 74, x0 = 600 - (slot * 12) / 2 + 12, bw = 44, dx = 16, dy = 10, scale = 330 / max;
  const shade = (hex, k) => {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
    return `rgb(${c.join(",")})`;
  };
  let svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <line x1="${x0 - 20}" y1="${baseY + 0.5}" x2="${x0 + slot * 12}" y2="${baseY + 0.5}" stroke="${tokHex("--accent")}" stroke-opacity=".5"/>`;
  stats.forEach((s, i) => {
    const x = x0 + i * slot;
    let y = baseY;
    CATS.forEach((c) => {
      const n = s.parts[c.id];
      if (!n) return;
      const h = n * scale, col = tokHex(c.token);
      y -= h;
      // face avant, face droite, dessus
      svg += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" fill="${col}" fill-opacity=".9"/>`;
      svg += `<polygon points="${x + bw},${y} ${x + bw + dx},${y - dy} ${x + bw + dx},${y + h - dy} ${x + bw},${y + h}" fill="${shade(col, 0.55)}"/>`;
    });
    if (s.total) {
      const top = tokHex(CATS.filter((c) => s.parts[c.id]).slice(-1)[0].token);
      svg += `<polygon points="${x},${y} ${x + dx},${y - dy} ${x + bw + dx},${y - dy} ${x + bw},${y}" fill="${shade(top, 1.15)}"/>`;
      svg += `<text x="${x + bw / 2}" y="${y - dy - 10}" text-anchor="middle" fill="${tokHex("--text")}" font-family="Barlow Condensed, sans-serif" font-weight="800" font-size="22">${s.total}</text>`;
    }
    svg += `<text x="${x + bw / 2}" y="${baseY + 26}" text-anchor="middle" fill="${tokHex("--muted")}" font-family="JetBrains Mono, monospace" font-size="12" letter-spacing="1">${MONTHS[i].toUpperCase()}</text>`;
  });
  svg += "</svg>";
  host.innerHTML = `<div class="hero-fallback">${svg}</div>`;
  host.classList.add("ready", "is-static");
}
