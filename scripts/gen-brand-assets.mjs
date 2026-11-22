// Assets de marque générés depuis brand.config.js : favicons (SVG + PNG), apple-touch-icon, manifest
import "./lib/env.mjs";
import fs from "node:fs";
import { BRAND } from "../brand.config.js";
import { iconPng } from "./og.mjs";

fs.mkdirSync("public", { recursive: true });
const { from, to, ink } = BRAND.LOGO;
const logoSvg = ({ radius = 16, pad = 0 } = {}) => {
  const s = 64 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="64" height="64" rx="${radius}" fill="url(#g)"/><g transform="translate(${pad} ${pad}) scale(${s / 64})"><path d="${BRAND.LOGO_PATH}" stroke="${ink}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
};
fs.writeFileSync("public/favicon.svg", logoSvg());
fs.writeFileSync("public/favicon-32.png", await iconPng(logoSvg(), 32));
fs.writeFileSync("public/apple-touch-icon.png", await iconPng(logoSvg({ radius: 0, pad: 6 }), 180));
fs.writeFileSync("public/icon-192.png", await iconPng(logoSvg(), 192));
fs.writeFileSync("public/icon-512.png", await iconPng(logoSvg(), 512));
fs.writeFileSync("public/icon-maskable-512.png", await iconPng(logoSvg({ radius: 0, pad: 12 }), 512));
fs.writeFileSync("public/manifest.webmanifest", JSON.stringify({
  name: `${BRAND.SITE_NAME} — ${BRAND.TAGLINE}`,
  short_name: BRAND.SITE_NAME,
  description: BRAND.DESCRIPTION,
  lang: "fr",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: BRAND.LOGO.bg,
  theme_color: BRAND.LOGO.bg,
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }
  ]
}, null, 2));
console.log("favicons + manifest générés");
