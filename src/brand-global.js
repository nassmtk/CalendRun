// Expose la config de marque et l'URL du site au code navigateur (app.js lit window.BRAND)
import { BRAND, fill } from "../brand.config.js";

window.BRAND = Object.freeze({ ...BRAND, SITE_URL: __SITE_URL__, fill });
