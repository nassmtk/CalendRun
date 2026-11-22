import { defineConfig, loadEnv } from "vite";
import { BRAND, siteUrl, fill, logoSvg, mailParts } from "./brand.config.js";
import { loadRaces } from "./scripts/lib/races.mjs";

/** remplace les {{CLÉS}} de marque dans tous les HTML (index, pages générées, légal, 404) */
function brandHtml(vars) {
  return {
    name: "calendrun-brand-html",
    transformIndexHtml: {
      order: "pre",
      handler: (html) => html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))
    }
  };
}

/** clés des adresses e-mail : jamais écrites en clair, ni dans le HTML ni dans le JS */
const MAILS = { contact: BRAND.CONTACT_EMAIL, courses: BRAND.COURSES_EMAIL };
const PRIVATE_KEYS = ["CONTACT_EMAIL", "COURSES_EMAIL"];

/** lien e-mail anti-spam : l'adresse est assemblée par src/mail.js au chargement.
 *  Sans JS, le lien mène à la section contact des mentions légales et affiche une forme lisible non cliquable. */
function mailLink(key, { label, cls = "", tpl = "" } = {}) {
  const [u, d] = mailParts(MAILS[key]);
  const shown = label || `${u} (arobase) ${d.replace(/\./g, " (point) ")}`;
  return `<a${cls ? ` class="${cls}"` : ""} href="/mentions-legales/#contact" data-mail="${key}"${tpl ? ` data-mail-tpl="${tpl}"` : ""}${label ? "" : " data-mail-show"}>${shown}</a>`;
}

/** module « virtual:brand » : la config de marque côté navigateur, sans les adresses e-mail.
 *  Les adresses sont transmises découpées et inversées (rien qui ressemble à une adresse dans le bundle). */
function brandVirtual() {
  const pub = Object.fromEntries(Object.entries(BRAND).filter(([k]) => !PRIVATE_KEYS.includes(k)));
  const enc = Object.fromEntries(Object.entries(MAILS).map(([k, v]) => [k, mailParts(v).map((x) => [...x].reverse().join(""))]));
  return {
    name: "calendrun-brand-virtual",
    resolveId: (id) => (id === "virtual:brand" ? "\0virtual:brand" : null),
    load: (id) => (id === "\0virtual:brand"
      ? `export const BRAND = ${JSON.stringify(pub)};
export const MAIL = ${JSON.stringify(enc)};
export const fill = ${fill.toString()};`
      : null)
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
      ${mailLink("courses", { label: "Proposer une course", tpl: "propose" })}
      ${mailLink("contact", { label: "Contact" })}
      <span>Carte © <a href="https://www.openstreetmap.org/copyright" rel="noopener noreferrer" target="_blank">OpenStreetMap</a></span>
    </nav>`;
}

/** précharge les polices critiques (titre + texte) une fois leurs noms hachés connus */
function preloadFonts(patterns = [/bricolage-grotesque-latin-800-normal.*\.woff2$/, /inter-latin-400-normal.*\.woff2$/, /barlow-condensed-latin-800-normal.*\.woff2$/]) {
  return {
    name: "calendrun-preload-fonts",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html, ctx) => {
        const files = Object.keys(ctx.bundle || {}).filter((f) => patterns.some((p) => p.test(f)));
        const links = files.map((f) => `<link rel="preload" href="/${f}" as="font" type="font/woff2" crossorigin>`).join("\n    ");
        return html.replace("</title>", `</title>\n    ${links}`);
      }
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
    // l'accroche est affichée sur deux lignes animées (TAGLINE_LINES dans brand.config.js)
    TAGLINE_1: (BRAND.TAGLINE_LINES || [BRAND.TAGLINE])[0],
    TAGLINE_2: (BRAND.TAGLINE_LINES || [])[1] || "",
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
    LOGO_SVG: logoSvg("currentColor"),
    PUBLISHER_NAME: BRAND.PUBLISHER_NAME,
    LEGAL_UPDATED_AT: BRAND.LEGAL_UPDATED_AT,
    MAIL_CONTACT: mailLink("contact"),
    MAIL_COURSES: mailLink("courses", { tpl: "error-general" }),
    MAIL_PROPOSE_BTN: mailLink("courses", { label: "Proposer une course", cls: "btn btn--primary magnetic", tpl: "propose" }),
    UMAMI_SRC: env.UMAMI_SRC || "",
    UMAMI_WEBSITE_ID: env.UMAMI_WEBSITE_ID || ""
  };
  vars.FOOTER = footerHtml(vars);
  return {
    plugins: [brandVirtual(), brandHtml(vars), preloadFonts()],
    build: {
      rollupOptions: {
        input: {
          main: "index.html",
          mentions: "mentions-legales/index.html",
          confidentialite: "confidentialite/index.html",
          notfound: "404.html",
          alertOk: "alertes/confirmee/index.html",
          alertOff: "alertes/desinscription/index.html",
          course: "course-template.html" // gabarit des pages course (rempli par scripts/postbuild.mjs)
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
