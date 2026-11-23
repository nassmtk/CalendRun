/* =========================================================
   Cryptographie des comptes (WebCrypto, runtime Workers)

   Mots de passe : PBKDF2-HMAC-SHA256, 30 000 itérations, sel aléatoire
   de 16 octets par utilisateur, + POIVRE (secret AUTH_PEPPER, hors base) :
     clé = HMAC-SHA256(AUTH_PEPPER, mot de passe)  →  PBKDF2(clé, sel, 30 000)
   Pourquoi pas Argon2id : absent de WebCrypto ; en WASM il dépasse la limite
   de 10 ms de CPU du plan gratuit dès qu'on lui donne une mémoire utile.
   Pourquoi 30 000 : ≈ 4,5 ms de CPU, ce qui laisse de la marge sous les 10 ms
   (100 000, le maximum accepté par Workers, coûte ≈ 15 ms). Le poivre compense :
   une copie de la base seule ne permet pas d'attaquer les mots de passe.
   Format stocké : pbkdf2-sha256$<itérations>$<sel>$<hash> (base64url) : on
   pourra augmenter les itérations plus tard (re-hachage à la connexion).
   ========================================================= */
export const PBKDF2_ITERATIONS = 30000;
const enc = new TextEncoder();

export const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
export const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const randomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));
export const randomHex = (n) => hex(randomBytes(n));
/** jeton de session : 256 bits */
export const randomToken = () => b64url(randomBytes(32));

export async function sha256Hex(s) {
  return hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
}

async function hmacRaw(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}
export const hmacHex = async (secret, message) => hex(await hmacRaw(secret, message));

/** comparaison à temps constant de deux chaînes */
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let r = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}

async function derive(pepper, password, salt, iterations) {
  const peppered = await hmacRaw(pepper, password);
  const key = await crypto.subtle.importKey("raw", peppered, "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
}

export async function hashPassword(pepper, password) {
  const salt = randomBytes(16);
  const bits = await derive(pepper, password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(bits)}`;
}

/** renvoie { ok, rehash } ; rehash = le hash utilise moins d'itérations que la valeur actuelle */
export async function verifyPassword(pepper, password, stored) {
  const [algo, it, salt, hash] = String(stored).split("$");
  const iterations = Number(it);
  if (algo !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 1 || iterations > 100000 || !salt || !hash) return { ok: false, rehash: false };
  const bits = await derive(pepper, password, fromB64url(salt), iterations);
  return { ok: timingSafeEqual(b64url(bits), hash), rehash: iterations < PBKDF2_ITERATIONS };
}

/** hash factice : une connexion sur un pseudo inconnu coûte autant qu'une vraie (pas d'énumération par le temps) */
export const DUMMY_HASH = `pbkdf2-sha256$${PBKDF2_ITERATIONS}$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

/* ---------- code de récupération ----------
   20 caractères base32 Crockford (100 bits d'entropie), affiché XXXXX-XXXXX-XXXXX-XXXXX.
   Son entropie rend un hachage lent inutile : HMAC-SHA256 avec le poivre suffit. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function newRecoveryCode() {
  const b = randomBytes(20);
  const chars = [...b].map((x) => CROCKFORD[x & 31]).join("");
  return chars.match(/.{5}/g).join("-");
}
export const normalizeRecoveryCode = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
export const hashRecoveryCode = (pepper, code) => hmacHex(pepper, "recovery:" + normalizeRecoveryCode(code));

/** code ami personnel : 10 caractères Crockford (≈ 50 bits) */
export function newFriendCode() {
  return [...randomBytes(10)].map((x) => CROCKFORD[x & 31]).join("");
}
