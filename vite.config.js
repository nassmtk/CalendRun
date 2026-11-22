import { defineConfig, loadEnv } from "vite";
import { BRAND, siteUrl, fill } from "./brand.config.js";
import { loadRaces } from "./scripts/lib/races.mjs";

/** remplace les {{CLÉS}} de marque dans tous les HTML (index, pages générées, légal, 404) */
function brandHtml(vars) {
  return {
    name: "allure-brand-html",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))
    }
  };
}

/** pied de page commun à toutes les pages (HTML statique, lisible sans JS) */
function footerHtml(v) {
  return `<div class="footer-main">
      <p><strong>${v.SITE_NAME}</strong> — ${v.TAGLINE} Saison ${v.YEAR}.</p>
      <p class="footer-warn">Dates et infos indicatives — vérifie toujours sur le site officiel de l'organisateur.</p>
      <p class="muted"><b>Date officielle</b> : publiée par l'organisateur ou la Ville de Paris · <b>Date annoncée</b> : publiée dans les calendriers de courses · <b>Date estimée</b> : déduite des éditions précédentes. Les dénivelés précédés de « ~ » sont approximatifs.</p>
    </div>
    <nav class="footer-links" aria-label="Liens légaux">
      <a href="/mentions-legales/">Mentions légales</a>
      <a href="/confidentialite/">Confidentialité</a>
      <a href="mailto:?subject=Course%20%C3%A0%20ajouter%20sur%20${encodeURIComponent(v.SITE_NAME)}">Signaler une course</a>
      <span>Carte © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a></span>
    </nav>`;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const SITE_URL = siteUrl(env);
  const count = loadRaces().length;
  const vars = {
    SITE_NAME: BRAND.SITE_NAME,
    TAGLINE: BRAND.TAGLINE,
    // l'accroche est affichée sur deux lignes animées : 1er mot / reste
    TAGLINE_1: BRAND.TAGLINE.split(" ")[0],
    TAGLINE_2: BRAND.TAGLINE.split(" ").slice(1).join(" "),
    SUBTAGLINE: fill(BRAND.SUBTAGLINE, { count }),
    DESCRIPTION: BRAND.DESCRIPTION,
    YEAR: String(BRAND.YEAR),
    REGION: BRAND.REGION,
    REGION_SHORT: BRAND.REGION_SHORT,
    LOCALE: BRAND.LOCALE,
    SITE_URL,
    COUNT: String(count),
    LOGO_FROM: BRAND.LOGO.from,
    LOGO_TO: BRAND.LOGO.to,
    LOGO_INK: BRAND.LOGO.ink,
    LOGO_PATH: BRAND.LOGO_PATH,
    UMAMI_SRC: env.UMAMI_SRC || "",
    UMAMI_WEBSITE_ID: env.UMAMI_WEBSITE_ID || ""
  };
  vars.FOOTER = footerHtml(vars);
  return {
    plugins: [brandHtml(vars)],
    build: {
      rollupOptions: {
        input: {
          main: "index.html",
          mentions: "mentions-legales/index.html",
          confidentialite: "confidentialite/index.html",
          notfound: "404.html",
          alertOk: "alertes/confirmee/index.html",
          alertOff: "alertes/desinscription/index.html"
        }
      }
    },
    define: {
      __SITE_URL__: JSON.stringify(SITE_URL),
      __ALERTS_ENABLED__: JSON.stringify(env.ALERTS_ENABLED === "true"),
      __TURNSTILE_SITE_KEY__: JSON.stringify(env.TURNSTILE_SITE_KEY || ""),
      __UMAMI__: JSON.stringify({ src: env.UMAMI_SRC || "", id: env.UMAMI_WEBSITE_ID || "" })
    },
    server: {
      host: "127.0.0.1", // IPv4 explicite : « localhost » ne pointait que vers [::1] sur cette machine
      port: 5173,
      strictPort: true,
      open: true
    },
    preview: { host: "127.0.0.1", port: 4173 }
  };
});
