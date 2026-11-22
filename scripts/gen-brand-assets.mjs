// Génère les assets de marque à partir de brand.config.js : favicon.svg (le reste en phase SEO)
import fs from "node:fs";
import { BRAND } from "../brand.config.js";

fs.mkdirSync("public", { recursive: true });
const { from, to, ink } = BRAND.LOGO;
export const logoSvg = (size = 64, radius = 16) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="64" height="64" rx="${radius}" fill="url(#g)"/><path d="${BRAND.LOGO_PATH}" stroke="${ink}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
fs.writeFileSync("public/favicon.svg", logoSvg());
console.log("favicon.svg généré");
