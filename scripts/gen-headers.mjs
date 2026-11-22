import "./lib/env.mjs";
// Génère public/_headers (en-têtes HTTP Cloudflare Pages) avec une CSP stricte
// construite uniquement à partir des services réellement utilisés.
import fs from "node:fs";

const env = process.env;
const origin = (u) => { try { return new URL(u).origin; } catch { return ""; } };
const umami = env.UMAMI_SRC && env.UMAMI_WEBSITE_ID ? origin(env.UMAMI_SRC) : "";
const TURNSTILE = "https://challenges.cloudflare.com";
const TILES = "https://tile.openstreetmap.org";

const csp = [
  "default-src 'self'",
  `script-src 'self' ${TURNSTILE}${umami ? " " + umami : ""}`,
  // feuilles de style : uniquement nos fichiers ; attributs style="" (variables CSS posées par le JS) autorisés
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self'",
  `img-src 'self' data: blob: ${TILES}`,
  `connect-src 'self' ${TURNSTILE}${umami ? ` ${umami} https://api-gateway.umami.dev` : ""}`,
  `frame-src ${TURNSTILE}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests"
].join("; ");

const security = {
  "Content-Security-Policy": csp,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-get=(), usb=(), browsing-topics=()",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin"
};

const block = (path, headers) => `${path}\n${Object.entries(headers).map(([k, v]) => `  ${k}: ${v}`).join("\n")}\n`;
const out = [
  "# Généré par scripts/gen-headers.mjs — ne pas modifier à la main",
  block("/*", security),
  block("/assets/*", { "Cache-Control": "public, max-age=31536000, immutable" }),
  block("/fonts/*", { "Cache-Control": "public, max-age=31536000, immutable" }),
  block("/og/*", { "Cache-Control": "public, max-age=86400" }),
  block("/races.json", { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" }),
  block("/api/*", { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" })
].join("\n");
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/_headers", out);
console.log("_headers généré", umami ? `(Umami : ${umami})` : "(sans Umami)");
