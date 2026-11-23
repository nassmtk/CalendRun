// Validation côté serveur de toutes les entrées des comptes
import { RACE_IDS } from "../race-ids.js";

export const PSEUDO_RE = /^[a-zA-Z0-9_.-]{3,20}$/;
export const PW_MIN = 12;
export const PW_MAX = 128; // borne haute : le coût du hachage reste maîtrisé

// pseudos réservés (comparés en minuscules, sans . _ -)
const RESERVED = new Set([
  "admin", "administrateur", "administrator", "root", "system", "systeme", "sysadmin",
  "calendrun", "calendrunidf", "calendrunteam", "support", "aide", "help", "contact", "courses",
  "alertes", "moderateur", "moderator", "mod", "staff", "team", "equipe", "officiel", "official",
  "security", "securite", "abuse", "postmaster", "webmaster", "hostmaster", "noreply", "info",
  "api", "www", "mail", "null", "undefined", "anonymous", "anonyme", "compte", "amis", "moi", "me"
]);

export const normPseudo = (p) => String(p).toLowerCase();

/** renvoie un message d'erreur, ou null si le pseudo est valide */
export function pseudoError(p) {
  if (typeof p !== "string" || !PSEUDO_RE.test(p)) return "Le pseudo doit faire 3 à 20 caractères : lettres, chiffres, point, tiret ou tiret bas.";
  const bare = normPseudo(p).replace(/[._-]/g, "");
  if (RESERVED.has(bare) || bare.startsWith("calendrun") || bare.startsWith("admin")) return "Ce pseudo est réservé : choisis-en un autre.";
  return null;
}

const COMMON = ["motdepasse", "password", "azerty", "qwerty", "123456", "000000", "111111", "soleil", "calendrun", "marathon"];
export function passwordError(pw, pseudo = "") {
  if (typeof pw !== "string" || pw.length < PW_MIN) return `Le mot de passe doit faire au moins ${PW_MIN} caractères.`;
  if (pw.length > PW_MAX) return `Le mot de passe doit faire au plus ${PW_MAX} caractères.`;
  const low = pw.toLowerCase();
  if (pseudo && low.includes(normPseudo(pseudo))) return "Le mot de passe ne doit pas contenir ton pseudo.";
  if (new Set(pw).size < 5) return "Ce mot de passe est trop répétitif.";
  if (COMMON.some((c) => low.replace(/[^a-z0-9]/g, "").startsWith(c) && low.length < c.length + 6)) return "Ce mot de passe est trop courant.";
  return null;
}

export const isRaceId = (id) => typeof id === "string" && id.length <= 90 && RACE_IDS.has(id);
export const isUserId = (id) => typeof id === "string" && /^[0-9a-f]{32}$/.test(id);
export const KINDS = new Set(["fav", "reg"]);

/** liste d'identifiants de course : garde uniquement les valides, sans doublon, bornée */
export const cleanRaceList = (arr, max = 500) => (Array.isArray(arr) ? [...new Set(arr.filter(isRaceId))].slice(0, max) : []);
