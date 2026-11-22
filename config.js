/*
 * Configuration navigateur.
 * Le nom, l'accroche, l'année et l'URL du site viennent de brand.config.js (window.BRAND).
 * ALERTS_ENABLED vient de la variable d'environnement ALERTS_ENABLED au build (voir README) :
 * tant qu'elle n'est pas à "true", la cloche et le formulaire d'alerte sont masqués.
 */
window.SITE_CONFIG = {
  YEAR: (window.BRAND && window.BRAND.YEAR) || 2027,
  ALERTS_ENABLED: typeof __ALERTS_ENABLED__ !== "undefined" ? __ALERTS_ENABLED__ : false
};
