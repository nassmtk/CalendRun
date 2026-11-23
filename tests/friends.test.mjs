// Tests des amis : demandes, acceptation, visibilité, refus, blocage, IDOR, suppression en cascade, purge
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setup, client, signup, PW } from "./helpers.mjs";
import { purgeInactive } from "../functions/_lib/accounts/account.js";

let env, DB, dispose;
before(async () => ({ env, DB, dispose } = await setup()));
after(() => dispose());

const n = async (sql, ...a) => (await DB.prepare(sql).bind(...a).first()).n;
const req = (u, pseudo) => u.call("POST", "friends/request", { body: { pseudo } });
const respond = (u, userId, accept) => u.call("POST", "friends/respond", { body: { userId, accept } });
const profile = (u, id) => u.call("GET", "friends/profile/" + id);
const activity = async (u) => (await u.call("GET", "friends/activity")).data;
/** trois comptes : alice, bob (et éventuellement carol) avec des courses */
async function trio(tag) {
  const a = await signup(env, "alice_" + tag), b = await signup(env, "bob_" + tag), c = await signup(env, "carol_" + tag);
  await b.call("POST", "me/races/merge", { body: { fav: ["semi-paris"], reg: ["marathon-paris"] } });
  await c.call("POST", "me/races/merge", { body: { fav: ["paris-versailles"], reg: ["semi-paris"] } });
  return { a, b, c };
}

test("demande d'ami → acceptation → visibilité dans les deux sens", async () => {
  const { a, b } = await trio("ok");
  const r = await req(a, "BOB_ok"); // pseudo exact, insensible à la casse
  assert.equal(r.status, 200);
  // en attente : rien de visible
  assert.equal((await profile(a, b.id)).status, 404, "pas de visibilité tant que ce n'est pas accepté");
  assert.equal((await activity(a)).friends.length, 0);
  const bobView = (await b.call("GET", "friends")).data;
  assert.equal(bobView.incoming[0].pseudo, "alice_ok");
  assert.equal((await b.me()).data.pendingRequests, 1, "badge de demandes en attente");
  assert.equal((await respond(b, a.id, true)).status, 200);
  const p = await profile(a, b.id);
  assert.equal(p.status, 200);
  assert.deepEqual(p.data.races, { fav: ["semi-paris"], reg: ["marathon-paris"] });
  const act = await activity(a);
  assert.deepEqual(act.friends, [{ id: b.id, pseudo: "bob_ok" }]);
  assert.deepEqual(act.races["marathon-paris"], { reg: [b.id], fav: [] });
  assert.equal((await profile(b, a.id)).status, 200, "visible dans l'autre sens aussi");
  assert.equal((await a.call("GET", "friends")).data.friends[0].shares, true);
});

test("pseudo inconnu : même réponse (pas d'énumération) ; pas de recherche partielle", async () => {
  const { a } = await trio("enum");
  const exists = await req(a, "bob_enum");
  const ghost = await req(a, "personne_xyz");
  const partial = await req(a, "bob_");
  assert.equal(exists.status, ghost.status);
  assert.deepEqual(exists.data, ghost.data);
  assert.deepEqual(partial.data, ghost.data);
  assert.equal(await n("SELECT COUNT(*) AS n FROM friendships WHERE requested_by = ?", a.id), 1, "seul le pseudo exact crée une demande");
  assert.equal((await req(a, "alice_enum")).status, 400, "pas de demande à soi-même");
});

test("code ami / lien d'invitation, régénérable", async () => {
  const { a, b } = await trio("code");
  const code = (await b.call("GET", "friends")).data.friendCode;
  assert.match(code, /^[0-9A-Z]{10}$/);
  const r = await a.call("POST", "friends/request", { body: { code: code.toLowerCase() } });
  assert.equal(r.status, 200);
  assert.match(r.data.message, /bob_code/);
  const fresh = (await b.call("POST", "friends/code", { body: {} })).data.friendCode;
  assert.notEqual(fresh, code);
  const c = await signup(env, "dave_code");
  assert.equal((await c.call("POST", "friends/request", { body: { code } })).status, 404, "l'ancien code ne marche plus");
  // demande croisée : si l'autre m'a déjà demandé, je l'accepte en le demandant
  await req(b, "alice_code");
  assert.equal((await profile(a, b.id)).status, 200);
});

test("visibilité « Personne » : plus rien, même pour les amis", async () => {
  const { a, b } = await trio("vis");
  await req(a, "bob_vis"); await respond(b, a.id, true);
  assert.equal((await profile(a, b.id)).status, 200);
  await b.call("POST", "me/visibility", { body: { visibility: "none" } });
  assert.equal((await profile(a, b.id)).status, 404);
  assert.equal((await activity(a)).friends.length, 0);
  assert.equal((await a.call("GET", "friends")).data.friends[0].shares, false);
});

test("refus puis blocage : plus aucune visibilité, plus de nouvelle demande", async () => {
  const { a, b } = await trio("blk");
  await req(a, "bob_blk");
  assert.equal((await respond(b, a.id, false)).status, 200, "refus");
  assert.equal(await n("SELECT COUNT(*) AS n FROM friendships WHERE requested_by = ?", a.id), 0);
  assert.equal((await profile(a, b.id)).status, 404);
  // amis puis blocage
  await req(a, "bob_blk"); await respond(b, a.id, true);
  assert.equal((await profile(a, b.id)).status, 200);
  assert.equal((await b.call("POST", "friends/block", { body: { userId: a.id } })).status, 200);
  assert.equal((await profile(a, b.id)).status, 404, "bloqué → rien");
  assert.equal((await profile(b, a.id)).status, 404, "dans les deux sens");
  assert.equal((await activity(a)).friends.length, 0);
  assert.equal((await activity(b)).friends.length, 0);
  // le bloqué redemande : réponse normale mais aucune demande créée
  const again = await req(a, "bob_blk");
  assert.equal(again.status, 200);
  assert.equal(await n("SELECT COUNT(*) AS n FROM friendships WHERE user_low IN (?1, ?2) AND user_high IN (?1, ?2)", a.id, b.id), 0);
  assert.equal((await b.call("GET", "friends")).data.blocked[0].pseudo, "alice_blk");
  // déblocage : pas d'amitié restaurée automatiquement
  await b.call("POST", "friends/unblock", { body: { userId: a.id } });
  assert.equal((await profile(a, b.id)).status, 404);
});

test("retirer un ami", async () => {
  const { a, b } = await trio("rm");
  await req(a, "bob_rm"); await respond(b, a.id, true);
  assert.equal((await a.call("POST", "friends/remove", { body: { userId: b.id } })).status, 200);
  assert.equal((await profile(a, b.id)).status, 404);
  assert.equal((await profile(b, a.id)).status, 404);
});

test("IDOR : changer un identifiant ne donne accès à rien", async () => {
  const { a, b, c } = await trio("idor");
  // b et c sont amis ; a n'est ami de personne
  await req(b, "carol_idor"); await respond(c, b.id, true);
  assert.equal((await profile(b, c.id)).status, 200, "contrôle : b voit c");

  // lecture directe du profil d'un non-ami (identifiant valide, deviné ou volé)
  const p = await profile(a, c.id);
  assert.equal(p.status, 404);
  assert.ok(!JSON.stringify(p.data).includes("paris-versailles"));
  assert.equal((await profile(a, b.id)).status, 404);
  assert.equal((await profile(a, a.id)).status, 404, "pas de contournement via son propre id");
  for (const bad of ["../me", "' OR 1=1 --", "0".repeat(32), c.id.toUpperCase(), c.id + "x"]) {
    const r = await profile(a, encodeURIComponent(bad));
    assert.equal(r.status, 404, bad);
  }
  // l'activité ne contient que mes amis
  assert.deepEqual((await activity(a)).races, {});

  // agir sur la relation b–c depuis a en passant l'id de l'un d'eux
  await req(c, "alice_idor"); // c → a en attente, pour avoir une vraie demande dans la base
  await req(a, "bob_idor");   // a → b en attente
  assert.equal((await respond(a, b.id, true)).status, 404, "a ne peut pas accepter SA propre demande");
  assert.equal((await b.call("POST", "friends/respond", { body: { userId: c.id, accept: false } })).status, 404, "b ne peut pas refuser à la place de quelqu'un");
  assert.equal((await a.call("POST", "friends/remove", { body: { userId: c.id } })).status, 404, "a ne peut pas casser l'amitié b–c");
  assert.equal((await a.call("POST", "friends/cancel", { body: { userId: c.id } })).status, 404, "a ne peut pas annuler la demande de c");
  assert.equal((await profile(b, c.id)).status, 200, "l'amitié b–c est intacte");
  assert.equal((await profile(a, c.id)).status, 404, "et a ne voit toujours rien");

  // identifiants malformés
  for (const userId of [null, 42, "", "abc", b.id + "0", { $ne: 1 }]) {
    assert.equal((await a.call("POST", "friends/block", { body: { userId } })).status, 400, JSON.stringify(userId));
  }
  // routes de compte : aucun paramètre d'utilisateur n'est lu (on ne modifie que soi)
  await a.call("POST", "me/visibility", { body: { visibility: "none", userId: c.id } });
  assert.equal((await DB.prepare("SELECT visibility FROM users WHERE id = ?").bind(c.id).first()).visibility, "friends");
  await a.call("POST", "me/races", { body: { userId: c.id, ops: [{ id: "paris-versailles", kind: "fav", on: false }] } });
  assert.equal(await n("SELECT COUNT(*) AS n FROM user_races WHERE user_id = ? AND race_id = 'paris-versailles'", c.id), 1);
  // sans session / sans CSRF
  assert.equal((await client(env).call("GET", "friends/profile/" + c.id)).status, 401);
  assert.equal((await b.call("POST", "friends/remove", { body: { userId: c.id }, csrf: null })).status, 403);
});

test("rate limit des demandes d'ami", async () => {
  const u = await signup(env, "spammeur");
  let last;
  for (let i = 0; i < 21; i++) last = await req(u, "cible_" + i);
  assert.equal(last.status, 429);
});

test("suppression du compte : amitiés et blocages effacés en cascade", async () => {
  const { a, b, c } = await trio("del");
  await req(a, "bob_del"); await respond(b, a.id, true);
  await req(c, "alice_del");
  await b.call("POST", "friends/block", { body: { userId: c.id } });
  await a.call("POST", "friends/block", { body: { userId: c.id } });
  assert.equal((await a.call("POST", "me/delete", { body: { password: PW } })).status, 200);
  for (const [sql, label] of [
    ["SELECT COUNT(*) AS n FROM users WHERE id = ?1", "users"],
    ["SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?1", "sessions"],
    ["SELECT COUNT(*) AS n FROM user_races WHERE user_id = ?1", "user_races"],
    ["SELECT COUNT(*) AS n FROM friendships WHERE user_low = ?1 OR user_high = ?1 OR requested_by = ?1", "friendships"],
    ["SELECT COUNT(*) AS n FROM blocks WHERE blocker = ?1 OR blocked = ?1", "blocks"]
  ]) assert.equal(await n(sql, a.id), 0, label);
  assert.equal(await n("SELECT COUNT(*) AS n FROM blocks WHERE blocker = ?", b.id), 1, "les données des autres restent");
  assert.equal((await b.call("GET", "friends")).data.friends.length, 0);
});

test("purge des comptes inactifs depuis 3 ans (cascade comprise)", async () => {
  const { a, b } = await trio("purge");
  await req(a, "bob_purge"); await respond(b, a.id, true);
  const old = Math.floor(Date.now() / 1000) - 3 * 366 * 86400;
  await DB.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").bind(old, a.id).run();
  await purgeInactive(DB, 3);
  assert.equal(await n("SELECT COUNT(*) AS n FROM users WHERE id = ?", a.id), 0);
  assert.equal(await n("SELECT COUNT(*) AS n FROM friendships WHERE user_low = ?1 OR user_high = ?1", a.id), 0);
  assert.equal(await n("SELECT COUNT(*) AS n FROM users WHERE id = ?", b.id), 1, "compte actif conservé");
});
