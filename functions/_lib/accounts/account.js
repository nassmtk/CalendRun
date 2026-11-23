/* =========================================================
   API des comptes — /api/auth/* et /api/me/*
   Toutes les requêtes SQL sont paramétrées (prepare + bind).
   Messages d'erreur génériques : jamais d'indice sur l'existence d'un pseudo.
   ========================================================= */
import { turnstileOk } from "../util.js";
import {
  hashPassword, verifyPassword, DUMMY_HASH, newRecoveryCode, hashRecoveryCode, newFriendCode, randomHex, timingSafeEqual
} from "./crypto.js";
import { pseudoError, passwordError, normPseudo, PSEUDO_RE, cleanRaceList, isRaceId, KINDS } from "./validate.js";
import { hit, lockedFor, reset } from "./ratelimit.js";
import {
  json, err, readJson, createSession, getSession, csrfToken, csrfOk, withCookies, clearCookies, clientIp
} from "./http.js";

const now = () => Math.floor(Date.now() / 1000);
const BAD_LOGIN = "Pseudo ou mot de passe incorrect.";
const BAD_RECOVER = "Pseudo ou code de récupération incorrect.";
const TOO_MANY = (s) => err(429, "Trop de tentatives. Réessaie dans quelques minutes.", { "retry-after": String(Math.max(1, s)) });

/* limites */
const RL = {
  loginIp: { limit: 30, windowSec: 900, lockSec: 900 },          // 30 échecs / 15 min par IP
  loginUser: { freeFails: 5, windowSec: 86400, maxLockSec: 900 }, // puis 2 s, 4 s, 8 s… jusqu'à 15 min
  signupIp: { limit: 5, windowSec: 3600, lockSec: 3600 }          // 5 inscriptions / heure par IP
};

/* ---------- données de l'utilisateur ---------- */
async function racesOf(db, userId) {
  const { results } = await db.prepare("SELECT race_id, kind FROM user_races WHERE user_id = ? ORDER BY added_at").bind(userId).all();
  return { fav: results.filter((r) => r.kind === "fav").map((r) => r.race_id), reg: results.filter((r) => r.kind === "reg").map((r) => r.race_id) };
}
async function pendingCount(db, userId) {
  try {
    const r = await db.prepare(
      "SELECT COUNT(*) AS n FROM friendships WHERE status = 'pending' AND requested_by != ?1 AND (user_low = ?1 OR user_high = ?1)"
    ).bind(userId).first();
    return r?.n || 0;
  } catch { return 0; } // migration amis pas encore appliquée
}
const publicUser = (u) => ({ id: u.id, pseudo: u.pseudo, visibility: u.visibility, friendCode: u.friend_code, createdAt: u.created_at });

async function mePayload(env, session) {
  return {
    ok: true,
    user: publicUser(session.user),
    csrf: await csrfToken(env, session.token),
    races: await racesOf(env.DB, session.user.id),
    pendingRequests: await pendingCount(env.DB, session.user.id)
  };
}

/* ---------- /api/auth ---------- */
async function signup(request, env) {
  const body = await readJson(request);
  if (!body) return err(400, "Requête invalide.");
  const ip = clientIp(request);
  if (await lockedFor(env.DB, "signup-ip:" + ip)) return TOO_MANY(await lockedFor(env.DB, "signup-ip:" + ip));
  const { pseudo, password } = body;
  const pe = pseudoError(pseudo);
  if (pe) return err(400, pe);
  const we = passwordError(password, pseudo);
  if (we) return err(400, we);
  if (env.TURNSTILE_SECRET_KEY && !(await turnstileOk(env, body.turnstile, ip))) return err(400, "Vérification anti-robot échouée : recharge la page et réessaie.");
  const lock = await hit(env.DB, "signup-ip:" + ip, RL.signupIp);
  if (lock) return TOO_MANY(lock);

  const id = randomHex(16);
  const recovery = newRecoveryCode();
  const t = now();
  try {
    await env.DB.prepare(
      "INSERT INTO users (id, pseudo, pseudo_norm, pw_hash, recovery_hash, friend_code, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, pseudo, normPseudo(pseudo), await hashPassword(env.AUTH_PEPPER, password), await hashRecoveryCode(env.AUTH_PEPPER, recovery), newFriendCode(), t, t).run();
  } catch (e) {
    if (/UNIQUE/i.test(String(e?.message || e))) return err(409, "Ce pseudo est déjà pris.");
    throw e;
  }
  const s = await createSession(env.DB, id);
  return withCookies(json({ ok: true, recoveryCode: recovery }, 201), s.cookies);
}

async function login(request, env) {
  const body = await readJson(request);
  if (!body) return err(400, "Requête invalide.");
  const ip = clientIp(request);
  const pseudo = typeof body.pseudo === "string" ? body.pseudo.slice(0, 40) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const kIp = "login-ip:" + ip, kUser = "login-user:" + normPseudo(pseudo);
  const locked = Math.max(await lockedFor(env.DB, kIp), await lockedFor(env.DB, kUser));
  if (locked) return TOO_MANY(locked);
  if (password.length > 128) return err(401, BAD_LOGIN);

  const user = PSEUDO_RE.test(pseudo)
    ? await env.DB.prepare("SELECT id, pw_hash FROM users WHERE pseudo_norm = ?").bind(normPseudo(pseudo)).first()
    : null;
  // même coût de calcul que le pseudo existe ou non
  const v = await verifyPassword(env.AUTH_PEPPER, password, user ? user.pw_hash : DUMMY_HASH);
  if (!user || !v.ok) {
    const a = await hit(env.DB, kIp, RL.loginIp);
    const b = await hit(env.DB, kUser, RL.loginUser);
    if (a || b) return TOO_MANY(Math.max(a, b));
    return err(401, BAD_LOGIN);
  }
  await reset(env.DB, kUser);
  if (v.rehash) await env.DB.prepare("UPDATE users SET pw_hash = ? WHERE id = ?").bind(await hashPassword(env.AUTH_PEPPER, password), user.id).run();
  await env.DB.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(now(), user.id).run();
  const s = await createSession(env.DB, user.id);
  return withCookies(json({ ok: true }), s.cookies);
}

async function recover(request, env) {
  const body = await readJson(request);
  if (!body) return err(400, "Requête invalide.");
  const ip = clientIp(request);
  const pseudo = typeof body.pseudo === "string" ? body.pseudo.slice(0, 40) : "";
  const kIp = "login-ip:" + ip, kUser = "login-user:" + normPseudo(pseudo);
  const locked = Math.max(await lockedFor(env.DB, kIp), await lockedFor(env.DB, kUser));
  if (locked) return TOO_MANY(locked);
  const we = passwordError(body.newPassword, pseudo);
  if (we) return err(400, we);

  const user = PSEUDO_RE.test(pseudo)
    ? await env.DB.prepare("SELECT id, recovery_hash FROM users WHERE pseudo_norm = ?").bind(normPseudo(pseudo)).first()
    : null;
  const h = await hashRecoveryCode(env.AUTH_PEPPER, body.code);
  if (!user || !timingSafeEqual(h, user.recovery_hash)) {
    const a = await hit(env.DB, kIp, RL.loginIp);
    const b = await hit(env.DB, kUser, RL.loginUser);
    if (a || b) return TOO_MANY(Math.max(a, b));
    return err(401, BAD_RECOVER);
  }
  // nouveau mot de passe + nouveau code (l'ancien ne sert plus) + toutes les sessions fermées
  const fresh = newRecoveryCode();
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pw_hash = ?, recovery_hash = ?, last_seen_at = ? WHERE id = ?")
      .bind(await hashPassword(env.AUTH_PEPPER, body.newPassword), await hashRecoveryCode(env.AUTH_PEPPER, fresh), now(), user.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id)
  ]);
  await reset(env.DB, kUser);
  const s = await createSession(env.DB, user.id);
  return withCookies(json({ ok: true, recoveryCode: fresh }), s.cookies);
}

/* ---------- /api/me ---------- */
async function checkPassword(env, userId, password) {
  if (typeof password !== "string" || password.length > 128) return false;
  const u = await env.DB.prepare("SELECT pw_hash FROM users WHERE id = ?").bind(userId).first();
  return !!u && (await verifyPassword(env.AUTH_PEPPER, password, u.pw_hash)).ok;
}
/** confirmation par mot de passe, avec la même limitation que la connexion */
async function confirmPassword(request, env, session, password) {
  const k = "confirm-user:" + session.user.id;
  const locked = await lockedFor(env.DB, k);
  if (locked) return TOO_MANY(locked);
  if (await checkPassword(env, session.user.id, password)) { await reset(env.DB, k); return null; }
  const l = await hit(env.DB, k, RL.loginUser);
  return l ? TOO_MANY(l) : err(400, "Mot de passe incorrect.");
}

async function mergeRaces(env, session, body) {
  const t = now();
  const stmts = [];
  for (const kind of KINDS) {
    for (const id of cleanRaceList(body[kind])) {
      stmts.push(env.DB.prepare("INSERT OR IGNORE INTO user_races (user_id, race_id, kind, added_at) VALUES (?, ?, ?, ?)").bind(session.user.id, id, kind, t));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, races: await racesOf(env.DB, session.user.id) });
}

/** changements groupés : { ops: [{ id, kind, on }] } (le front regroupe les clics) */
async function setRaces(env, session, body) {
  const ops = Array.isArray(body.ops) ? body.ops.slice(0, 100) : null;
  if (!ops || ops.some((o) => !o || !isRaceId(o.id) || !KINDS.has(o.kind) || typeof o.on !== "boolean")) return err(400, "Requête invalide.");
  const t = now();
  await env.DB.batch(ops.map((o) => o.on
    ? env.DB.prepare("INSERT OR IGNORE INTO user_races (user_id, race_id, kind, added_at) VALUES (?, ?, ?, ?)").bind(session.user.id, o.id, o.kind, t)
    : env.DB.prepare("DELETE FROM user_races WHERE user_id = ? AND race_id = ? AND kind = ?").bind(session.user.id, o.id, o.kind)));
  return json({ ok: true });
}

async function exportData(env, session) {
  const id = session.user.id;
  const u = await env.DB.prepare("SELECT pseudo, visibility, friend_code, created_at, last_seen_at FROM users WHERE id = ?").bind(id).first();
  const races = await racesOf(env.DB, id);
  const sessions = (await env.DB.prepare("SELECT created_at, expires_at FROM sessions WHERE user_id = ?").bind(id).all()).results;
  let friends = [], blocked = [];
  try {
    friends = (await env.DB.prepare(
      "SELECT u.pseudo, f.status, CASE WHEN f.requested_by = ?1 THEN 'envoyée' ELSE 'reçue' END AS direction, f.created_at FROM friendships f JOIN users u ON u.id = CASE WHEN f.user_low = ?1 THEN f.user_high ELSE f.user_low END WHERE f.user_low = ?1 OR f.user_high = ?1"
    ).bind(id).all()).results;
    blocked = (await env.DB.prepare("SELECT u.pseudo, b.created_at FROM blocks b JOIN users u ON u.id = b.blocked WHERE b.blocker = ?").bind(id).all()).results;
  } catch { /* migration amis absente */ }
  const iso = (s) => new Date(s * 1000).toISOString();
  const data = {
    export: { site: "CalendRun", date: new Date().toISOString() },
    compte: { pseudo: u.pseudo, visibilite: u.visibility, codeAmi: u.friend_code, creeLe: iso(u.created_at), derniereActivite: iso(u.last_seen_at) },
    favoris: races.fav, inscriptions: races.reg,
    amis: friends.map((f) => ({ pseudo: f.pseudo, statut: f.status === "accepted" ? "ami" : `demande ${f.direction}`, depuis: iso(f.created_at) })),
    bloques: blocked.map((b) => ({ pseudo: b.pseudo, depuis: iso(b.created_at) })),
    sessions: sessions.map((s) => ({ ouverte: iso(s.created_at), expire: iso(s.expires_at) })),
    note: "Le mot de passe et le code de récupération ne sont stockés que sous forme de hash : ils ne peuvent pas être exportés."
  };
  return json(data, 200, { "content-disposition": `attachment; filename="calendrun-${u.pseudo}.json"` });
}

/* ---------- routeur ---------- */
export async function handleAccount(request, env, path) {
  if (!env.DB || !env.AUTH_PEPPER) return err(503, "Les comptes ne sont pas encore disponibles.");
  const method = request.method;
  const route = `${method} ${path}`;

  // routes publiques (pas encore de session) : Origin obligatoire
  if (route === "POST auth/signup" || route === "POST auth/login" || route === "POST auth/recover") {
    if (!(await csrfOk(request, env, null))) return err(403, "Requête refusée.");
    if (path === "auth/signup") return signup(request, env);
    if (path === "auth/login") return login(request, env);
    return recover(request, env);
  }

  const session = await getSession(request, env);
  const done = (res) => (session?.refresh ? withCookies(res, session.refresh) : res);

  if (route === "GET me") {
    if (!session) return withCookies(err(401, "Non connecté."), clearCookies());
    return done(json(await mePayload(env, session)));
  }
  if (route === "GET me/export") {
    if (!session) return err(401, "Non connecté.");
    return exportData(env, session);
  }
  if (method !== "POST") return err(405, "Méthode non autorisée.");
  if (!session) return withCookies(err(401, "Non connecté."), clearCookies());
  if (!(await csrfOk(request, env, session))) return err(403, "Requête refusée.");
  const body = await readJson(request, 32768);
  if (!body) return err(400, "Requête invalide.");
  const uid = session.user.id;

  switch (path) {
    case "auth/logout":
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(session.tokenHash).run();
      return withCookies(json({ ok: true }), clearCookies());
    case "auth/logout-all":
      await env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(uid).run();
      return withCookies(json({ ok: true }), clearCookies());
    case "me/races/merge": return done(await mergeRaces(env, session, body));
    case "me/races": return done(await setRaces(env, session, body));
    case "me/password": {
      const bad = await confirmPassword(request, env, session, body.current);
      if (bad) return bad;
      const we = passwordError(body.next, session.user.pseudo);
      if (we) return err(400, we);
      // les autres appareils sont déconnectés, celui-ci garde sa session
      await env.DB.batch([
        env.DB.prepare("UPDATE users SET pw_hash = ? WHERE id = ?").bind(await hashPassword(env.AUTH_PEPPER, body.next), uid),
        env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(uid, session.tokenHash)
      ]);
      return done(json({ ok: true }));
    }
    case "me/recovery": {
      const bad = await confirmPassword(request, env, session, body.password);
      if (bad) return bad;
      const code = newRecoveryCode();
      await env.DB.prepare("UPDATE users SET recovery_hash = ? WHERE id = ?").bind(await hashRecoveryCode(env.AUTH_PEPPER, code), uid).run();
      return done(json({ ok: true, recoveryCode: code }));
    }
    case "me/visibility": {
      if (body.visibility !== "friends" && body.visibility !== "none") return err(400, "Requête invalide.");
      await env.DB.prepare("UPDATE users SET visibility = ? WHERE id = ?").bind(body.visibility, uid).run();
      return done(json({ ok: true, visibility: body.visibility }));
    }
    case "me/delete": {
      const bad = await confirmPassword(request, env, session, body.password);
      if (bad) return bad;
      // suppression réelle : sessions, favoris, inscriptions, amitiés et blocages partent en cascade (clés étrangères)
      await env.DB.batch([
        env.DB.prepare("DELETE FROM rate_limits WHERE key IN (?, ?)").bind("confirm-user:" + uid, "login-user:" + normPseudo(session.user.pseudo)),
        env.DB.prepare("DELETE FROM users WHERE id = ?").bind(uid)
      ]);
      return withCookies(json({ ok: true }), clearCookies());
    }
    default: return err(404, "Introuvable.");
  }
}

/** purge des comptes inactifs depuis 3 ans (worker planifié) */
export const purgeInactive = (db, years = 3) =>
  db.prepare("DELETE FROM users WHERE last_seen_at < ?").bind(now() - Math.round(years * 365.25 * 86400)).run();
