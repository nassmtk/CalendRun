/* =========================================================
   CONFIG DE MARQUE — source unique
   Utilisée par : le front (window.BRAND), index.html et les pages
   générées (plugin Vite), les images Open Graph, le manifest, le
   sitemap et les fonctions serveur (mails).
   Changer de nom / d'accroche = modifier ce fichier.
   Domaine : SITE_URL ci-dessous (surchargeable par la variable d'environnement SITE_URL).
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
  // domaine public (canonical, sitemap, Open Graph, e-mails) ; la variable d'environnement SITE_URL a priorité
  SITE_URL: "https://calend.run",
  // couleurs du logo (identiques aux tokens --accent / --accent-2 / --on-accent)
  LOGO: { from: "#FC4C02", to: "#FF9F1C", ink: "#0A0A0B", bg: "#0A0A0B" },
  // coordonnées légales et contact (utilisées par les pages légales, le pied de page et les fiches ;
  // les adresses sont assemblées en JS côté navigateur, jamais écrites en clair dans le HTML)
  CONTACT_EMAIL: "contact@calend.run",
  COURSES_EMAIL: "courses@calend.run",
  // expéditeur des e-mails automatiques (Brevo) ; la variable d'environnement SENDER_EMAIL a priorité
  SENDER_EMAIL: "alertes@calend.run",
  // comptes utilisateurs et amis (docs/COMPTES.md) ; la variable d'environnement ACCOUNTS_ENABLED a priorité
  ACCOUNTS_ENABLED: true,
  // clé PUBLIQUE Cloudflare Turnstile (le secret TURNSTILE_SECRET_KEY reste dans le tableau de bord) ;
  // la variable d'environnement TURNSTILE_SITE_KEY a priorité
  TURNSTILE_SITE_KEY: "0x4AAAAAAGPelQqaCwO4myNxtt-ACB0bIXk",
  // nom affiché sur les pages légales (mentions légales, confidentialité)
  PUBLISHER_NAME: "Nassim MTK",
  // à mettre à jour à chaque modification des pages légales
  LEGAL_UPDATED_AT: "23 novembre 2026"
};

/** pictogramme du logo (viewBox 0 0 64 64) : calendrier dont s'échappe un coureur.
 *  `ink` = couleur du tracé ("currentColor" dans les pages, couleur fixe pour favicons / OG). */
export function logoSvg(ink = "currentColor") {
  return `<g fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round">`
    + `<path stroke-width="5" d="M28 13 H15 a8 8 0 0 0 -8 8 V49 a8 8 0 0 0 8 8 H49 a8 8 0 0 0 8 -8 V30 M7 25 H24 M20 7 V17"/>`
    + `<path stroke-width="4.5" d="M40 21 L34 33 M39 23 L47 27 L51 22 M39 23 L31 22 L27 27 M34 33 L43 37 L43 45 M34 33 L27 40 L19 39"/>`
    + `</g><circle cx="44" cy="13" r="4.6" fill="${ink}"/>`;
}

/** sépare une adresse en [utilisateur, domaine] (pour l'assemblage anti-spam côté navigateur) */
export const mailParts = (email) => String(email).split("@");

/** URL publique du site, sans « / » final. Vient de la variable d'environnement SITE_URL. */
export function siteUrl(env = (typeof process !== "undefined" ? process.env : {})) {
  // variable SITE_URL > build Cloudflare Pages (domaine de BRAND) > local
  const url = env.SITE_URL || (env.CF_PAGES === "1" ? BRAND.SITE_URL : "http://localhost:5173");
  return String(url).replace(/\/+$/, "");
}

/** valeur de build : variable d'environnement si elle est définie (non vide), sinon brand.config.js.
 *  Les [vars] de wrangler.toml ne sont pas garanties au build Cloudflare Pages : d'où ce repli. */
export function buildFlag(env, key) {
  const v = env[key];
  return v !== undefined && v !== "" ? v : BRAND[key];
}
export const accountsEnabled = (env) => String(buildFlag(env, "ACCOUNTS_ENABLED")) === "true";
export const turnstileSiteKey = (env) => String(buildFlag(env, "TURNSTILE_SITE_KEY") || "");

/** remplace {count} dans un texte de marque */
export const fill = (txt, vars = {}) => String(txt).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`));
