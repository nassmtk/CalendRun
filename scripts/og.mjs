// Images Open Graph (1200×630, PNG) générées avec satori + resvg, aux couleurs du site
import fs from "node:fs";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { BRAND } from "../brand.config.js";

const F = (pkg, file) => fs.readFileSync(path.join("node_modules/@fontsource", pkg, "files", file));
const fonts = [
  { name: "Bricolage", data: F("bricolage-grotesque", "bricolage-grotesque-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "Barlow", data: F("barlow-condensed", "barlow-condensed-latin-800-normal.woff"), weight: 800, style: "normal" },
  { name: "Inter", data: F("inter", "inter-latin-500-normal.woff"), weight: 500, style: "normal" },
  { name: "Mono", data: F("jetbrains-mono", "jetbrains-mono-latin-500-normal.woff"), weight: 500, style: "normal" }
];
const C = { bg: "#0A0A0B", text: "#F5F3EF", muted: "#9A968F", accent: BRAND.LOGO.from, accent2: BRAND.LOGO.to, surface: "#17171A" };
const CAT = { route: "#FF8A3D", trail: "#5FB878", cross: "#5FB878", urban: "#5AA9E6", backyard: "#E5484D", relais: "#A78BFA" };
const MONTHS = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];

// mini « JSX » pour satori
const h = (type, style = {}, ...children) => ({ type, props: { style: { display: "flex", ...style }, children: children.flat().filter((c) => c !== null && c !== false && c !== undefined) } });
// les polices sont en sous-ensemble latin : on remplace les glyphes absents
const clean = (s) => String(s).replace(/→/g, "–").replace(/[’]/g, "'").replace(/[^\u0000-ɏ–—’·]/g, "");

const logo = () => h("div", { alignItems: "center", gap: 16 },
  h("div", { width: 56, height: 56, borderRadius: 16, backgroundImage: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, alignItems: "center", justifyContent: "center" },
    { type: "svg", props: { width: 38, height: 38, viewBox: "0 0 64 64", children: [{ type: "path", props: { d: BRAND.LOGO_PATH, stroke: C.bg, "stroke-width": 7, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" } }] } }),
  h("div", { fontFamily: "Bricolage", fontSize: 36, color: C.text }, BRAND.SITE_NAME)
);
// le padding s'ajoute à la largeur dans satori : chaque rangée reçoit une largeur explicite (1200 − 2×64)
const W = 1072;
const frame = (...children) => h("div", {
  width: 1200, height: 630, flexDirection: "column", justifyContent: "space-between", padding: 64, boxSizing: "border-box",
  backgroundColor: C.bg, backgroundImage: `radial-gradient(circle at 92% 0%, rgba(252,76,2,.45), rgba(10,10,11,0) 55%)`, color: C.text, fontFamily: "Inter"
}, ...children);

async function render(tree) {
  const svg = await satori(tree, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
}

export async function raceOg(r, siteHost) {
  const d = r._date;
  const date = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const name = clean(r.name);
  const size = name.length > 34 ? 64 : name.length > 22 ? 78 : 92;
  return render(frame(
    h("div", { width: W, justifyContent: "space-between", alignItems: "center" }, logo(),
      h("div", { fontFamily: "Mono", fontSize: 22, color: C.muted, letterSpacing: 2 }, `COURSES ${BRAND.REGION_SHORT} ${BRAND.YEAR}`)),
    h("div", { width: W, flexDirection: "column", gap: 18 },
      h("div", { fontFamily: "Barlow", fontSize: 64, color: C.accent, letterSpacing: 1 }, date),
      h("div", { fontFamily: "Bricolage", fontSize: size, lineHeight: 1.02, letterSpacing: -2, maxWidth: W }, name),
      h("div", { fontSize: 32, color: C.muted }, clean(`${r._place} · ${r._distLabel}`))
    ),
    h("div", { width: W, justifyContent: "space-between", alignItems: "center" },
      h("div", { height: 10, width: 220, borderRadius: 5, backgroundColor: CAT[r.type] || C.accent }),
      h("div", { fontFamily: "Mono", fontSize: 24, color: C.muted }, siteHost)
    )
  ));
}

export async function homeOg(races, count, subtagline, siteHost) {
  const months = Array(12).fill(0);
  races.forEach((r) => r._date.getUTCFullYear() === BRAND.YEAR && months[r._date.getUTCMonth()]++);
  const max = Math.max(...months);
  return render(frame(
    h("div", { width: W, justifyContent: "space-between", alignItems: "center" }, logo(),
      h("div", { fontFamily: "Mono", fontSize: 22, color: C.muted, letterSpacing: 2 }, `SAISON ${BRAND.YEAR}`)),
    h("div", { width: W, justifyContent: "space-between", alignItems: "flex-end" },
      h("div", { flexDirection: "column", gap: 10, maxWidth: 640 },
        h("div", { fontFamily: "Bricolage", fontSize: 92, lineHeight: 0.98, letterSpacing: -3, flexDirection: "column" },
          h("div", {}, clean(BRAND.TAGLINE.split(" ")[0])),
          h("div", { color: C.accent }, clean(BRAND.TAGLINE.split(" ").slice(1).join(" ")))),
        h("div", { fontSize: 34, color: C.text, marginTop: 14 }, clean(subtagline))
      ),
      h("div", { alignItems: "flex-end", gap: 8, height: 300 },
        ...months.map((n, i) => h("div", { flexDirection: "column", alignItems: "center", gap: 8 },
          h("div", { width: 26, height: Math.max(6, Math.round((n / max) * 250)), borderRadius: 5, backgroundImage: `linear-gradient(180deg, ${C.accent2}, ${C.accent})` }),
          h("div", { fontFamily: "Mono", fontSize: 14, color: C.muted }, MONTHS[i][0])
        )))
    ),
    h("div", { width: W, justifyContent: "flex-end" }, h("div", { fontFamily: "Mono", fontSize: 24, color: C.muted }, siteHost))
  ));
}

export async function iconPng(svg, size) {
  return new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
}
