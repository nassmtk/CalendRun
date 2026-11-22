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
  return {
    plugins: [brandHtml(vars)],
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
