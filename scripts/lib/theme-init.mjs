// Script inline du <head> : applique le thème clair AVANT l'affichage (pas de flash sombre → clair).
// Son empreinte SHA-256 est ajoutée à la CSP par scripts/gen-headers.mjs : ne pas le modifier ailleurs.
import crypto from "node:crypto";

export const THEME_KEY = "calendrun:theme";
export const THEME_INIT = `try{if(localStorage.getItem("${THEME_KEY}")==="light"){document.documentElement.dataset.theme="light"}}catch(e){}`;
export const THEME_INIT_HASH = `'sha256-${crypto.createHash("sha256").update(THEME_INIT).digest("base64")}'`;
