// Expose la config de marque et l'URL du site au code navigateur (app.js lit window.BRAND)
import { BRAND, fill } from "virtual:brand"; // brand.config.js sans les adresses e-mail (voir vite.config.js)

window.BRAND = Object.freeze({ ...BRAND, SITE_URL: __SITE_URL__, fill });
