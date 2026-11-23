// Tests des comptes : inscription, connexion, rate limit, récupération, sessions, CSRF, fusion, RGPD
// Lancer : node --test tests/
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { setup, client, signup, PW, ORIGIN } from "./helpers.mjs";

let env, DB, dispose;
before(async () => ({ env, DB, dispose } = await setup()));
after(() => dispose());

const count = async (sql, ...args) => (await DB.prepare(sql).bind(...args).first()).n;

test("inscription : cookies sécurisés, code de récupération, hash en base", async () => {
  const c = client(env);
  const r = await c.call("POST", "auth/signup", { body: { pseudo: "Lea_Runs", password: PW } });
  assert.equal(r.status, 201);
  assert.match(r.data.recoveryCode, /^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/);
  const sess = r.setCookies.find((s) => s.startsWith("__Host-cr_session="));
  assert.ok(sess, "cookie __Host-");
  for (const attr of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) assert.ok(sess.includes(attr), attr);
  assert.ok(!/Domain=/i.test(sess), "pas de Domain sur un cookie __Host-");
  assert.ok(r.setCookies.some((s) => s.startsWith("cr_auth=1") && !s.includes("HttpOnly")), "indice cr_auth lisible en JS");
  const row = await DB.prepare("SELECT * FROM users WHERE pseudo_norm = 'lea_runs'").first();
  assert.match(row.pw_hash, /^pbkdf2-sha256\$30000\$[\w-]{22}\$[\w-]{43}$/);
  assert.ok(!row.pw_hash.includes(PW) && !row.recovery_hash.includes(r.data.recoveryCode.replace(/-/g, "")));
  const token = c.jar["__Host-cr_session"];
  assert.equal(await count("SELECT COUNT(*) AS n FROM sessions WHERE token_hash = ?", token), 0, "le jeton n'est jamais stocké en clair");
  const me = await c.me();
  assert.equal(me.status, 200);
  assert.equal(me.data.user.pseudo, "Lea_Runs");
  assert.equal(me.data.user.visibility, "friends");
});

test("inscription : validations serveur", async () => {
  const c = client(env);
  const bad = async (body, status = 400) => assert.equal((await c.call("POST", "auth/signup", { body })).status, status, JSON.stringify(body));
  await bad({ pseudo: "ab", password: PW });
  await bad({ pseudo: "a".repeat(21), password: PW });
  await bad({ pseudo: "léa", password: PW });
  await bad({ pseudo: "x' OR 1=1 --", password: PW });
  await bad({ pseudo: "<script>", password: PW });
  await bad({ pseudo: "Admin", password: PW });
  await bad({ pseudo: "calendrun.team", password: PW });
  await bad({ pseudo: "Support", password: PW });
  await bad({ pseudo: "valide1", password: "court" });
  await bad({ pseudo: "valide1", password: "aaaaaaaaaaaaaaa" });
  await bad({ pseudo: "valide1", password: "x".repeat(129) });
  await bad({ pseudo: "valide1", password: "valide1-et-autre-chose" });
  // unicité insensible à la casse
  await signup(env, "Marc.D");
  assert.equal((await client(env).call("POST", "auth/signup", { body: { pseudo: "marc.d", password: PW } })).status, 409);
});

test("CSRF : Origin obligatoire et jeton exigé une fois connecté", async () => {
  const c = client(env);
  assert.equal((await c.call("POST", "auth/signup", { body: { pseudo: "sans_origin", password: PW }, origin: null })).status, 403);
  assert.equal((await c.call("POST", "auth/login", { body: { pseudo: "x", password: PW }, origin: "https://evil.example" })).status, 403);
  const u = await signup(env, "csrf_user");
  assert.equal((await u.call("POST", "me/visibility", { body: { visibility: "none" }, csrf: null })).status, 403, "sans jeton");
  assert.equal((await u.call("POST", "me/visibility", { body: { visibility: "none" }, csrf: "0".repeat(64) })).status, 403, "faux jeton");
  assert.equal((await u.call("POST", "me/visibility", { body: { visibility: "none" }, origin: "https://evil.example" })).status, 403, "mauvaise origine");
  assert.equal((await u.call("POST", "me/visibility", { body: { visibility: "none" } })).status, 200);
});

test("connexion : succès, mauvais mot de passe, message générique", async () => {
  await signup(env, "nina");
  const c = client(env);
  const ok = await c.call("POST", "auth/login", { body: { pseudo: "NINA", password: PW } });
  assert.equal(ok.status, 200, "pseudo insensible à la casse");
  assert.equal((await c.me()).data.user.pseudo, "nina");
  const wrong = await client(env).call("POST", "auth/login", { body: { pseudo: "nina", password: PW + "x" } });
  const ghost = await client(env).call("POST", "auth/login", { body: { pseudo: "personne_ici", password: PW } });
  assert.equal(wrong.status, 401);
  assert.equal(ghost.status, 401);
  assert.equal(wrong.data.message, "Pseudo ou mot de passe incorrect.");
  assert.deepEqual(wrong.data, ghost.data, "aucune différence entre pseudo inconnu et mauvais mot de passe");
});

test("rate limit : délai croissant par pseudo, puis blocage même avec le bon mot de passe", async () => {
  await signup(env, "cible");
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    // une IP différente à chaque essai : c'est la limite PAR PSEUDO qui doit jouer
    statuses.push((await client(env).call("POST", "auth/login", { body: { pseudo: "cible", password: "mauvais-mdp-" + i } })).status);
  }
  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429]);
  const blocked = await client(env).call("POST", "auth/login", { body: { pseudo: "cible", password: PW } });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.res.headers.get("retry-after")) >= 1);
  // le délai augmente : 2 s puis 4 s
  await DB.prepare("UPDATE rate_limits SET locked_until = 0 WHERE key = 'login-user:cible'").run();
  await client(env).call("POST", "auth/login", { body: { pseudo: "cible", password: "encore-faux-123" } });
  const lock = (await DB.prepare("SELECT locked_until - strftime('%s','now') AS s FROM rate_limits WHERE key = 'login-user:cible'").first()).s;
  assert.ok(lock >= 3 && lock <= 4, `deuxième blocage ≈ 4 s (reçu ${lock})`);
});

test("rate limit : par IP, quel que soit le pseudo", async () => {
  const c = client(env);
  let last;
  for (let i = 0; i < 31; i++) last = await c.call("POST", "auth/login", { body: { pseudo: "inconnu" + i, password: "nimportequoi-123" } });
  assert.equal(last.status, 429);
});

test("récupération par code : nouveau mot de passe, nouveau code, sessions fermées", async () => {
  const u = await signup(env, "oubli");
  const old = u.recoveryCode;
  const c = client(env);
  const bad = await c.call("POST", "auth/recover", { body: { pseudo: "oubli", code: "AAAAA-AAAAA-AAAAA-AAAAA", newPassword: "nouveau-mdp-tres-solide" } });
  assert.equal(bad.status, 401);
  assert.equal(bad.data.message, "Pseudo ou code de récupération incorrect.");
  const ok = await c.call("POST", "auth/recover", { body: { pseudo: "oubli", code: old.toLowerCase().replace(/-/g, " "), newPassword: "nouveau-mdp-tres-solide" } });
  assert.equal(ok.status, 200, "code accepté sans tenir compte de la casse ni des séparateurs");
  assert.notEqual(ok.data.recoveryCode, old);
  assert.equal((await u.call("GET", "me")).status, 401, "l'ancienne session est fermée");
  assert.equal((await client(env).call("POST", "auth/login", { body: { pseudo: "oubli", password: PW } })).status, 401, "ancien mot de passe refusé");
  assert.equal((await client(env).call("POST", "auth/login", { body: { pseudo: "oubli", password: "nouveau-mdp-tres-solide" } })).status, 200);
  const reuse = await client(env).call("POST", "auth/recover", { body: { pseudo: "oubli", code: old, newPassword: "encore-un-autre-mdp" } });
  assert.equal(reuse.status, 401, "un code ne sert qu'une fois");
});

test("fusion du localStorage : union sans doublon, identifiants inventés ignorés", async () => {
  const u = await signup(env, "fusion");
  let r = await u.call("POST", "me/races/merge", { body: { fav: ["marathon-paris", "semi-paris"], reg: ["marathon-paris"] } });
  assert.equal(r.status, 200);
  r = await u.call("POST", "me/races/merge", { body: { fav: ["semi-paris", "paris-versailles", "course-inventee", "<img>", 42], reg: ["marathon-paris"] } });
  assert.deepEqual(r.data.races.fav.sort(), ["marathon-paris", "paris-versailles", "semi-paris"]);
  assert.deepEqual(r.data.races.reg, ["marathon-paris"]);
  // modifications groupées
  r = await u.call("POST", "me/races", { body: { ops: [{ id: "semi-paris", kind: "fav", on: false }, { id: "paris-versailles", kind: "reg", on: true }] } });
  assert.equal(r.status, 200);
  const me = await u.me();
  assert.deepEqual(me.data.races.fav.sort(), ["marathon-paris", "paris-versailles"]);
  assert.deepEqual(me.data.races.reg.sort(), ["marathon-paris", "paris-versailles"]);
  assert.equal((await u.call("POST", "me/races", { body: { ops: [{ id: "inventee", kind: "fav", on: true }] } })).status, 400);
  assert.equal((await u.call("POST", "me/races", { body: { ops: [{ id: "semi-paris", kind: "admin", on: true }] } })).status, 400);
});

test("déconnexion : invalidation côté serveur ; « tous mes appareils »", async () => {
  const a = await signup(env, "multi");
  const stolen = { ...a.jar };
  assert.equal((await a.call("POST", "auth/logout", { body: {} })).status, 200);
  const replay = client(env); Object.assign(replay.jar, stolen);
  assert.equal((await replay.call("GET", "me")).status, 401, "le cookie copié ne marche plus");

  const p1 = client(env), p2 = client(env);
  await p1.call("POST", "auth/login", { body: { pseudo: "multi", password: PW } });
  await p2.call("POST", "auth/login", { body: { pseudo: "multi", password: PW } });
  await p1.me();
  assert.equal((await p1.call("POST", "auth/logout-all", { body: {} })).status, 200);
  assert.equal((await p2.call("GET", "me")).status, 401);
  assert.equal(await count("SELECT COUNT(*) AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.pseudo = 'multi'"), 0);
});

test("Mon compte : changer de mot de passe, régénérer le code", async () => {
  const u = await signup(env, "titi_compte");
  assert.equal((await u.call("POST", "me/password", { body: { current: "faux-mot-de-passe", next: "tout-nouveau-mdp-99" } })).status, 400);
  assert.equal((await u.call("POST", "me/password", { body: { current: PW, next: "court" } })).status, 400);
  assert.equal((await u.call("POST", "me/password", { body: { current: PW, next: "tout-nouveau-mdp-99" } })).status, 200);
  assert.equal((await u.call("GET", "me")).status, 200, "la session courante reste ouverte");
  const r = await u.call("POST", "me/recovery", { body: { password: "tout-nouveau-mdp-99" } });
  assert.equal(r.status, 200);
  assert.notEqual(r.data.recoveryCode, u.recoveryCode);
  const old = await client(env).call("POST", "auth/recover", { body: { pseudo: "titi_compte", code: u.recoveryCode, newPassword: "x-nouveau-mdp-solide" } });
  assert.equal(old.status, 401, "l'ancien code ne marche plus");
});

test("export RGPD : données lisibles, aucun hash", async () => {
  const u = await signup(env, "export_me");
  await u.call("POST", "me/races/merge", { body: { fav: ["semi-paris"], reg: [] } });
  const r = await u.call("GET", "me/export");
  assert.equal(r.status, 200);
  assert.match(r.res.headers.get("content-disposition"), /attachment/);
  assert.equal(r.data.compte.pseudo, "export_me");
  assert.deepEqual(r.data.favoris, ["semi-paris"]);
  assert.ok(!JSON.stringify(r.data).includes("pbkdf2"));
});

test("suppression du compte : mot de passe exigé, données réellement effacées", async () => {
  const u = await signup(env, "a_effacer");
  const other = await signup(env, "temoin");
  await u.call("POST", "me/races/merge", { body: { fav: ["semi-paris"], reg: ["marathon-paris"] } });
  const id = u.id;
  assert.equal((await u.call("POST", "me/delete", { body: { password: "pas-le-bon-mdp" } })).status, 400);
  assert.equal((await u.call("POST", "me/delete", { body: { password: PW } })).status, 200);
  for (const [t, col] of [["users", "id"], ["sessions", "user_id"], ["user_races", "user_id"]]) {
    assert.equal(await count(`SELECT COUNT(*) AS n FROM ${t} WHERE ${col} = ?`, id), 0, t);
  }
  assert.equal((await u.call("GET", "me")).status, 401);
  assert.equal((await client(env).call("POST", "auth/login", { body: { pseudo: "a_effacer", password: PW } })).status, 401);
  assert.equal((await other.call("GET", "me")).status, 200, "les autres comptes ne sont pas touchés");
});

test("sans base ou sans poivre : 503 propre", async () => {
  const c = client({ SITE_URL: ORIGIN });
  assert.equal((await c.call("POST", "auth/login", { body: {} })).status, 503);
});
