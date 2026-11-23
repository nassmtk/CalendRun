/* =========================================================
   API des amis — /api/friends/*
   RÈGLE D'ACCÈS (contrôlée en SQL, jamais côté navigateur) :
   on ne lit les favoris / inscriptions de B que si
     1. une amitié ACCEPTÉE existe entre le demandeur et B
        (une seule ligne par paire, acceptée par le destinataire = valable dans les deux sens),
     2. aucun blocage, dans un sens ou dans l'autre,
     3. B a laissé sa visibilité sur « Mes amis ».
   Sinon : 404 (on ne révèle pas l'existence du compte).
   Toutes les routes ne lisent / modifient que des paires qui contiennent
   l'utilisateur connecté : changer un identifiant dans la requête ne donne
   accès à rien d'autre (IDOR).
   ========================================================= */
import { newFriendCode } from "./crypto.js";
import { isUserId, normPseudo, PSEUDO_RE } from "./validate.js";
import { hit, lockedFor } from "./ratelimit.js";
import { json, err } from "./http.js";

const now = () => Math.floor(Date.now() / 1000);
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
const RL_REQUEST = { limit: 20, windowSec: 3600, lockSec: 3600 }; // 20 demandes / heure par compte
const SENT = "Si ce pseudo existe, ta demande d'ami lui a été envoyée.";

/* condition SQL réutilisable : ?1 = moi, u = l'autre utilisateur */
const VISIBLE_SQL = `u.visibility = 'friends'
  AND EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
              AND ((f.user_low = ?1 AND f.user_high = u.id) OR (f.user_high = ?1 AND f.user_low = u.id)))
  AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ?1 AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = ?1))`;

/** l'utilisateur `viewer` peut-il voir les courses de `target` ? (renvoie { id, pseudo } ou null) */
export async function canView(db, viewer, target) {
  if (!isUserId(target) || viewer === target) return null;
  return db.prepare(`SELECT u.id, u.pseudo FROM users u WHERE u.id = ?2 AND ${VISIBLE_SQL}`).bind(viewer, target).first();
}

const blockedEither = (db, a, b) =>
  db.prepare("SELECT 1 AS x FROM blocks WHERE (blocker = ?1 AND blocked = ?2) OR (blocker = ?2 AND blocked = ?1)").bind(a, b).first();

/* ---------- lectures ---------- */
async function overview(env, me) {
  const db = env.DB;
  const { results } = await db.prepare(
    `SELECT u.id, u.pseudo, f.status, f.requested_by, f.created_at
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user_low = ?1 THEN f.user_high ELSE f.user_low END
      WHERE (f.user_low = ?1 OR f.user_high = ?1)
      ORDER BY u.pseudo_norm`
  ).bind(me.id).all();
  const blocked = (await db.prepare(
    "SELECT u.id, u.pseudo FROM blocks b JOIN users u ON u.id = b.blocked WHERE b.blocker = ? ORDER BY u.pseudo_norm"
  ).bind(me.id).all()).results;
  const visible = new Set((await db.prepare(`SELECT u.id FROM users u WHERE ${VISIBLE_SQL}`).bind(me.id).all()).results.map((r) => r.id));
  const out = (r) => ({ id: r.id, pseudo: r.pseudo, since: r.created_at });
  return json({
    ok: true,
    friendCode: me.friend_code,
    friends: results.filter((r) => r.status === "accepted").map((r) => ({ ...out(r), shares: visible.has(r.id) })),
    incoming: results.filter((r) => r.status === "pending" && r.requested_by !== me.id).map(out),
    outgoing: results.filter((r) => r.status === "pending" && r.requested_by === me.id).map(out),
    blocked: blocked.map((r) => ({ id: r.id, pseudo: r.pseudo }))
  });
}

/** activité de tous les amis visibles, en UNE requête (cartes, fiches, filtre « Courses de mes potes ») */
async function activity(env, me) {
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.pseudo, ur.race_id, ur.kind
       FROM users u JOIN user_races ur ON ur.user_id = u.id
      WHERE ${VISIBLE_SQL}`
  ).bind(me.id).all();
  const friends = {}, races = {};
  for (const r of results) {
    friends[r.id] = r.pseudo;
    const e = (races[r.race_id] ||= { reg: [], fav: [] });
    e[r.kind].push(r.id);
  }
  return json({ ok: true, friends: Object.entries(friends).map(([id, pseudo]) => ({ id, pseudo })), races });
}

async function profile(env, me, id) {
  const u = await canView(env.DB, me.id, id);
  if (!u) return err(404, "Profil introuvable.");
  const { results } = await env.DB.prepare("SELECT race_id, kind FROM user_races WHERE user_id = ? ORDER BY added_at").bind(u.id).all();
  return json({
    ok: true, user: { id: u.id, pseudo: u.pseudo },
    races: { fav: results.filter((r) => r.kind === "fav").map((r) => r.race_id), reg: results.filter((r) => r.kind === "reg").map((r) => r.race_id) }
  });
}

/* ---------- écritures ---------- */
async function request(env, me, body) {
  const db = env.DB;
  const k = "friend-req:" + me.id;
  const locked = await lockedFor(db, k);
  if (locked) return err(429, "Trop de demandes d'ami d'affilée : réessaie plus tard.", { "retry-after": String(locked) });
  const lock = await hit(db, k, RL_REQUEST);
  if (lock) return err(429, "Trop de demandes d'ami d'affilée : réessaie plus tard.", { "retry-after": String(lock) });

  let target = null;
  const byCode = typeof body.code === "string" && body.code.trim();
  if (byCode) {
    const code = body.code.trim().toUpperCase();
    if (!/^[0-9A-Z]{10}$/.test(code)) return err(400, "Code ami invalide.");
    target = await db.prepare("SELECT id, pseudo FROM users WHERE friend_code = ?").bind(code).first();
    if (!target) return err(404, "Code ami invalide ou expiré.");
  } else {
    const p = typeof body.pseudo === "string" ? body.pseudo.trim() : "";
    if (!PSEUDO_RE.test(p)) return err(400, "Indique le pseudo exact de ton ami.");
    // pseudo EXACT (insensible à la casse) : pas de recherche partielle
    target = await db.prepare("SELECT id, pseudo FROM users WHERE pseudo_norm = ?").bind(normPseudo(p)).first();
  }
  // réponse identique, que le pseudo existe ou non (pas d'énumération)
  const generic = () => json({ ok: true, message: byCode ? `Demande envoyée à ${target.pseudo}.` : SENT });
  if (!target) return generic();
  if (target.id === me.id) return err(400, "C'est ton propre " + (byCode ? "code" : "pseudo") + " !");
  if (await blockedEither(db, me.id, target.id)) return generic(); // silencieux
  const [low, high] = pair(me.id, target.id);
  const row = await db.prepare("SELECT status, requested_by FROM friendships WHERE user_low = ? AND user_high = ?").bind(low, high).first();
  if (row) {
    // l'autre m'avait déjà demandé : on accepte
    if (row.status === "pending" && row.requested_by === target.id) {
      await db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ?").bind(low, high).run();
    }
    return generic();
  }
  await db.prepare("INSERT INTO friendships (user_low, user_high, requested_by, status, created_at) VALUES (?, ?, ?, 'pending', ?)")
    .bind(low, high, me.id, now()).run();
  return generic();
}

/** opérations sur une paire (moi, userId) — userId est validé, et la paire contient toujours « moi » */
async function onPair(env, me, path, body) {
  const db = env.DB;
  const other = body.userId;
  if (!isUserId(other) || other === me.id) return err(400, "Requête invalide.");
  const [low, high] = pair(me.id, other);
  const where = "user_low = ? AND user_high = ?";
  switch (path) {
    case "friends/respond": {
      // uniquement une demande REÇUE (envoyée par l'autre) et en attente
      const r = await db.prepare(`SELECT 1 AS x FROM friendships WHERE ${where} AND status = 'pending' AND requested_by = ?`).bind(low, high, other).first();
      if (!r) return err(404, "Demande introuvable.");
      if (body.accept === true) await db.prepare(`UPDATE friendships SET status = 'accepted' WHERE ${where}`).bind(low, high).run();
      else await db.prepare(`DELETE FROM friendships WHERE ${where}`).bind(low, high).run();
      return json({ ok: true });
    }
    case "friends/cancel": {
      const r = await db.prepare(`DELETE FROM friendships WHERE ${where} AND status = 'pending' AND requested_by = ?`).bind(low, high, me.id).run();
      return r.meta.changes ? json({ ok: true }) : err(404, "Demande introuvable.");
    }
    case "friends/remove": {
      const r = await db.prepare(`DELETE FROM friendships WHERE ${where} AND status = 'accepted'`).bind(low, high).run();
      return r.meta.changes ? json({ ok: true }) : err(404, "Ami introuvable.");
    }
    case "friends/block": {
      const exists = await db.prepare("SELECT 1 AS x FROM users WHERE id = ?").bind(other).first();
      if (!exists) return err(404, "Utilisateur introuvable.");
      await db.batch([
        db.prepare(`DELETE FROM friendships WHERE ${where}`).bind(low, high),
        db.prepare("INSERT OR IGNORE INTO blocks (blocker, blocked, created_at) VALUES (?, ?, ?)").bind(me.id, other, now())
      ]);
      return json({ ok: true });
    }
    case "friends/unblock": {
      const r = await db.prepare("DELETE FROM blocks WHERE blocker = ? AND blocked = ?").bind(me.id, other).run();
      return r.meta.changes ? json({ ok: true }) : err(404, "Blocage introuvable.");
    }
    default: return err(404, "Introuvable.");
  }
}

/** routeur : appelé par handleAccount une fois la session et le CSRF vérifiés */
export async function handleFriends(env, session, method, path, body) {
  const me = session.user;
  if (method === "GET") {
    if (path === "friends") return overview(env, me);
    if (path === "friends/activity") return activity(env, me);
    const m = path.match(/^friends\/profile\/([^/]+)$/);
    if (m) return profile(env, me, m[1]);
    return err(404, "Introuvable.");
  }
  if (path === "friends/request") return request(env, me, body);
  if (path === "friends/code") {
    const code = newFriendCode();
    await env.DB.prepare("UPDATE users SET friend_code = ? WHERE id = ?").bind(code, me.id).run();
    return json({ ok: true, friendCode: code });
  }
  return onPair(env, me, path, body);
}
