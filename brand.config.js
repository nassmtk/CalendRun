/* =========================================================
   CONFIG DE MARQUE — source unique
   Utilisée par : le front (window.BRAND), index.html et les pages
   générées (plugin Vite), les images Open Graph, le manifest, le
   sitemap et les fonctions serveur (mails).
   Changer de nom / d'accroche = modifier ce fichier.
   Changer de domaine = modifier la variable d'environnement SITE_URL.
   ========================================================= */
export const BRAND = {
  SITE_NAME: "CalendRun",
  TAGLINE: "Cours où tu veux en Île-de-France.",
  // découpage de l'accroche sur deux lignes (titre du hero, image Open Graph)
  TAGLINE_LINES: ["Cours où tu veux", "en Île-de-France."],
  // {count} est remplacé dynamiquement par le nombre de courses
  SUBTAGLINE: "{count} courses. Un seul calendrier.",
  DESCRIPTION: "Le calendrier 2027 des courses à pied à Paris et en Île-de-France : dates, distances, liens d'inscription et alertes d'ouverture.",
  YEAR: 2027,
  REGION: "Île-de-France",
  REGION_SHORT: "IDF",
  LOCALE: "fr_FR",
  // couleurs du logo (identiques aux tokens --accent / --accent-2 / --on-accent)
  LOGO: { from: "#FC4C02", to: "#FF9F1C", ink: "#0A0A0B", bg: "#0A0A0B" },
  // tracé du logo (viewBox 0 0 64 64)
  LOGO_PATH: "M10 46 L26 18 L36 34 L43 24 L54 46"
};

/** URL publique du site, sans « / » final. Vient de la variable d'environnement SITE_URL. */
export function siteUrl(env = (typeof process !== "undefined" ? process.env : {})) {
  // SITE_URL (domaine final) > CF_PAGES_URL (fourni par Cloudflare Pages au build) > local
  const url = env.SITE_URL || env.CF_PAGES_URL || "http://localhost:5173";
  if (!env.SITE_URL && env.CF_PAGES === "1" && typeof console !== "undefined") {
    console.warn(`[brand] SITE_URL non défini : utilisation de ${url}. Définis SITE_URL dans Cloudflare Pages pour le domaine final.`);
  }
  return String(url).replace(/\/+$/, "");
}

/** remplace {count} dans un texte de marque */
export const fill = (txt, vars = {}) => String(txt).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
