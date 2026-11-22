// Utilitaires partagés par les fonctions serverless (Cloudflare Pages Functions)

/** réponse JSON générique — jamais d'information permettant d'énumérer les e-mails */
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      // _headers ne s'applique pas aux réponses des Functions : en-têtes de sécurité posés ici
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "x-robots-tag": "noindex",
      ...headers
    }
  });

export const GENERIC_OK = { ok: true, message: "Si l'adresse est valide, tu vas recevoir un e-mail pour confirmer ton alerte." };

const EMAIL_RE = /^[^\s@"<>()[\]\\,;:]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
export const isEmail = (s) => typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s);
export const RACE_ID_RE = /^[a-z0-9][a-z0-9-]{1,80}$/;

/** HMAC-SHA256 hexadécimal (jetons de désinscription) */
export async function hmac(secret, message) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** comparaison à temps constant */
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export const siteUrl = (env) => String(env.SITE_URL || "").replace(/\/+$/, "");
export const unsubscribeUrl = async (env, email) =>
  `${siteUrl(env)}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${await hmac(env.UNSUB_SECRET, email.toLowerCase())}`;

/**
 * Limitation par IP : fenêtre fixe, stockée dans KV (binding RATE_LIMIT) si présent,
 * sinon en mémoire de l'isolat (protection partielle, mieux que rien).
 */
const memory = new Map();
export async function rateLimited(env, ip, { limit = 5, windowSec = 600, scope = "rl" } = {}) {
  const bucket = Math.floor(Date.now() / 1000 / windowSec);
  const key = `${scope}:${ip}:${bucket}`;
  if (env.RATE_LIMIT) {
    const n = Number((await env.RATE_LIMIT.get(key)) || 0) + 1;
    await env.RATE_LIMIT.put(key, String(n), { expirationTtl: windowSec + 60 });
    return n > limit;
  }
  const n = (memory.get(key) || 0) + 1;
  memory.set(key, n);
  if (memory.size > 5000) memory.clear();
  return n > limit;
}

/** vérification Cloudflare Turnstile côté serveur */
export async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return false;
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const body = new FormData();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const out = await res.json().catch(() => ({}));
  return out.success === true;
}

/** appel à l'API Brevo */
export async function brevo(env, path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.brevo.com/v3${path}`, {
    method,
    headers: { "api-key": env.BREVO_API_KEY, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}
