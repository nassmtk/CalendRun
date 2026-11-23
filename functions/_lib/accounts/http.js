/* =========================================================
   Sessions, cookies et CSRF
   - jeton de session 256 bits ; seul son SHA-256 est en base ; 30 jours glissants
   - cookie __Host-cr_session : HttpOnly + Secure + SameSite=Lax + Path=/ (sans Domain)
   - cookie cr_auth=1 (lisible en JS, aucun secret) : le front ne fait AUCUN appel
     d'API tant qu'il est absent (visiteurs sans compte)
   - CSRF sur toute route qui modifie des données : Origin obligatoire et dans la
     liste blanche + en-tête X-CSRF-Token = HMAC(poivre, jeton de session)
   ========================================================= */
import { json, originOk } from "../util.js";
import { randomToken, sha256Hex, hmacHex, timingSafeEqual } from "./crypto.js";

export const SESSION_COOKIE = "__Host-cr_session";
export const HINT_COOKIE = "cr_auth";
export const SESSION_DAYS = 30;
const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

export { json };
export const err = (status, message, headers) => json({ ok: false, message }, status, headers);

export function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

const sessionCookies = (token, maxAge) => [
  `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
  `${HINT_COOKIE}=${maxAge ? 1 : ""}; Path=/; Max-Age=${maxAge}; Secure; SameSite=Lax`
];
export const clearCookies = () => sessionCookies("", 0);

/** réponse JSON + plusieurs Set-Cookie */
export function withCookies(res, cookies) {
  for (const c of cookies) res.headers.append("set-cookie", c);
  return res;
}

/** corps JSON borné ; renvoie null si invalide */
export async function readJson(request, max = 8192) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > max) return null;
  const raw = await request.text();
  if (raw.length > max) return null;
  try { const v = JSON.parse(raw || "{}"); return v && typeof v === "object" && !Array.isArray(v) ? v : null; } catch { return null; }
}

export async function createSession(db, userId) {
  const token = randomToken();
  const t = now();
  await db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, t, t + SESSION_DAYS * DAY).run();
  // ménage des sessions expirées de cet utilisateur
  await db.prepare("DELETE FROM sessions WHERE user_id = ? AND expires_at < ?").bind(userId, t).run();
  return { token, cookies: sessionCookies(token, SESSION_DAYS * DAY) };
}

/**
 * Session de la requête : { user, token, tokenHash, refresh } ou null.
 * refresh = cookies à renvoyer quand la session est prolongée (glissante).
 */
export async function getSession(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT s.expires_at, u.id, u.pseudo, u.visibility, u.friend_code, u.created_at, u.last_seen_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?"
  ).bind(tokenHash).first();
  const t = now();
  if (!row) return null;
  if (row.expires_at <= t) { await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run(); return null; }
  let refresh = null;
  // prolongation au plus une fois par jour (limite les écritures D1)
  if (row.expires_at - t < (SESSION_DAYS - 1) * DAY) {
    await env.DB.batch([
      env.DB.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").bind(t + SESSION_DAYS * DAY, tokenHash),
      env.DB.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(t, row.id)
    ]);
    refresh = sessionCookies(token, SESSION_DAYS * DAY);
  }
  const { expires_at, ...user } = row;
  return { user, token, tokenHash, refresh };
}

export const csrfToken = (env, token) => hmacHex(env.AUTH_PEPPER, "csrf:" + token);

/** contrôle CSRF : Origin + (si connecté) jeton synchronisé */
export async function csrfOk(request, env, session) {
  if (!originOk(request, env)) return false;
  if (!session) return true;
  const sent = request.headers.get("x-csrf-token") || "";
  return timingSafeEqual(sent, await csrfToken(env, session.token));
}

export const clientIp = (request) => request.headers.get("cf-connecting-ip") || "0.0.0.0";
