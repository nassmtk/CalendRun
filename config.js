/*
 * Configuration navigateur (héritée).
 * Le nom, l'accroche, l'année et l'URL du site viennent de brand.config.js (window.BRAND).
 * Les alertes mail sont pilotées par les variables d'environnement (voir README).
 */
window.SITE_CONFIG = {
  YEAR: (window.BRAND && window.BRAND.YEAR) || 2027
};
