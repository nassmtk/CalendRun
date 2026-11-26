// Tests du formulaire de contact : Pages Function /api/contact + Worker mailer (MIME, send_email)
// Lancer : node --test tests/contact.test.mjs
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/contact.js";
import { createHandler, normalize, contactMail } from "../workers/mailer/handler.js";
import { headerSafe, oneLine } from "../workers/mailer/mime.js";
import { ORIGIN, freshIp } from "./helpers.mjs";

// ---- doublures : Turnstile (fetch global), binding send_email, service binding MAILER
let turnstile, realFetch;
beforeEach(() => {
  turnstile = { success: true, calls: 0 };
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.match(String(url), /challenges\.cloudflare\.com\/turnstile/);
    turnstile.calls++;
    return new Response(JSON.stringify({ success: turnstile.success }));
  };
});
afterEach(() => { globalThis.fetch = realFetch; });

class FakeEmailMessage { constructor(from, to, raw) { Object.assign(this, { from, to, raw }); } }
const sendEmail = () => { const sent = []; return { sent, send: async (m) => { sent.push(m); } }; };
const mailerEnv = (binding = sendEmail()) => ({ CONTACT_MAIL: binding, CONTACT_FROM: "formulaire@calend.run", CONTACT_TO: "calendrun@gmail.com" });
const worker = createHandler(FakeEmailMessage);

function makeEnv() {
  const binding = sendEmail();
  const wenv = mailerEnv(binding);
  const calls = [];
  const MAILER = { fetch: async (url, init) => { calls.push(JSON.parse(init.body)); return worker(new Request(url, init), wenv); } };
  return { env: { MAILER, TURNSTILE_SECRET_KEY: "secret", SITE_URL: ORIGIN }, sent: binding.sent, calls };
}

const GOOD = { topic: "course", name: "Léa", email: "Lea@Example.com", message: "Il manque le 10 km de Vincennes.", page: "/course/10k-vincennes/", turnstileToken: "tok" };
async function post(env, body, { origin = ORIGIN, ip = freshIp(), raw, headers = {} } = {}) {
  const h = new Headers({ "content-type": "application/json", "cf-connecting-ip": ip, ...headers });
  if (origin) h.set("origin", origin);
  const req = new Request(ORIGIN + "/api/contact", { method: "POST", headers: h, body: raw ?? JSON.stringify(body) });
  const res = await onRequestPost({ request: req, env });
  return { status: res.status, data: await res.json() };
}

/** décode un e-mail MIME brut : en-têtes dépliés + corps texte */
function parse(raw) {
  const [head] = raw.split("\r\n\r\n");
  const headers = {};
  for (const line of head.replace(/\r\n /g, " ").split("\r\n")) {
    const i = line.indexOf(":");
    headers[line.slice(0, i).toLowerCase()] = line.slice(i + 2);
  }
  const dec = (v) => v.replace(/\?=\s+=\?/g, "?==?").replace(/=\?UTF-8\?B\?([^?]+?)\?=/g, (_, b) => Buffer.from(b, "base64").toString("utf8"));
  const parts = raw.split(/--=_cr_\w+/).slice(1, -1).map((p) => {
    const [ph, body] = p.split("\r\n\r\n");
    return { type: /text\/(\w+)/.exec(ph)[1], body: Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8") };
  });
  return { headers, dec, text: parts.find((p) => p.type === "plain").body, html: parts.find((p) => p.type === "html").body };
}

test("envoi réel : sujet, prénom, e-mail, message, page, date, Reply-To", async () => {
  const { env, sent } = makeEnv();
  const r = await post(env, GOOD);
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { ok: true });
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.from, "formulaire@calend.run");
  assert.equal(m.to, "calendrun@gmail.com");
  const { headers, dec, text, html } = parse(m.raw);
  assert.match(headers.from, /<formulaire@calend\.run>$/);
  assert.equal(headers.to, "<calendrun@gmail.com>");
  assert.equal(dec(headers["reply-to"]), "Léa <lea@example.com>");
  assert.equal(dec(headers.subject), "[CalendRun] Proposer une course — Léa");
  assert.match(headers["message-id"], /^<[0-9a-f-]{36}@calend\.run>$/);
  assert.ok(headers.date && headers["mime-version"] === "1.0");
  for (const s of ["Sujet  : Proposer une course", "Prénom : Léa", "E-mail : lea@example.com", "Page   : https://calend.run/course/10k-vincennes/", "Il manque le 10 km de Vincennes."]) assert.ok(text.includes(s), s);
  assert.match(text, /Date {3}: \w+ \d{1,2} \w+ 20\d\d .*heure de Paris/);
  assert.ok(html.includes("Proposer une course") && html.includes("lea@example.com"));
  // lignes ≤ 998 caractères, fins de ligne CRLF uniquement
  assert.ok(m.raw.split("\r\n").every((l) => l.length <= 998 && !l.includes("\n")));
});

test("libellés des sujets", async () => {
  const labels = { question: "Question", course: "Proposer une course", erreur: "Erreur", partenariat: "Partenariat", autre: "Autre", inconnu: "Autre", __proto__x: "Autre" };
  for (const [topic, label] of Object.entries(labels)) {
    const { env, sent } = makeEnv();
    assert.equal((await post(env, { ...GOOD, topic })).status, 200);
    assert.ok(parse(sent[0].raw).text.startsWith(`Sujet  : ${label}\n`), topic);
  }
});

test("Turnstile obligatoire", async () => {
  const { env, sent } = makeEnv();
  turnstile.success = false;
  assert.equal((await post(env, GOOD)).status, 400);
  assert.equal((await post(env, { ...GOOD, turnstileToken: "" })).status, 400);
  assert.equal(sent.length, 0);
  // sans secret Turnstile, le formulaire refuse d'envoyer (503 → repli mailto côté navigateur)
  delete env.TURNSTILE_SECRET_KEY;
  turnstile.success = true;
  assert.equal((await post(env, GOOD)).status, 503);
  assert.equal(sent.length, 0);
});

test("sans service binding MAILER : 503", async () => {
  const { env } = makeEnv();
  delete env.MAILER;
  assert.equal((await post(env, GOOD)).status, 503);
});

test("Origin vérifiée", async () => {
  const { env, sent } = makeEnv();
  assert.equal((await post(env, GOOD, { origin: null })).status, 403);
  assert.equal((await post(env, GOOD, { origin: "https://evil.example" })).status, 403);
  assert.equal((await post(env, GOOD, { origin: "https://calend.run.evil.example" })).status, 403);
  assert.equal(sent.length, 0);
  env.ALLOWED_ORIGINS = "https://calendrun.pages.dev";
  assert.equal((await post(env, GOOD, { origin: "https://calendrun.pages.dev" })).status, 200);
});

test("limitation par IP : 3 messages / 10 min", async () => {
  const { env, sent } = makeEnv();
  const ip = freshIp();
  for (let i = 0; i < 3; i++) assert.equal((await post(env, GOOD, { ip })).status, 200);
  const r = await post(env, GOOD, { ip });
  assert.equal(r.status, 429);
  assert.ok(r.data.message);
  assert.equal(sent.length, 3);
  assert.equal((await post(env, GOOD)).status, 200, "une autre IP passe");
});

test("champ piège : succès simulé, rien n'est envoyé, Turnstile pas appelé", async () => {
  const { env, sent } = makeEnv();
  const r = await post(env, { ...GOOD, website: "http://spam.example" });
  assert.equal(r.status, 200);
  assert.equal(sent.length, 0);
  assert.equal(turnstile.calls, 0);
});

test("validation serveur : e-mail, longueur du message, corps", async () => {
  const { env, sent } = makeEnv();
  const bad = async (body, status = 400) => assert.equal((await post(env, body)).status, status, JSON.stringify(body).slice(0, 80));
  await bad({ ...GOOD, email: "" });
  await bad({ ...GOOD, email: "pas-un-email" });
  await bad({ ...GOOD, email: "a@b" });
  await bad({ ...GOOD, email: ["a@b.fr"] });
  await bad({ ...GOOD, message: "court" });
  await bad({ ...GOOD, message: "         abc        " });
  await bad({ ...GOOD, message: "x".repeat(3001) });
  await bad({ ...GOOD, message: { length: 50 } });
  assert.equal((await post(env, null, { raw: "{pas du json" })).status, 400);
  assert.equal((await post(env, null, { raw: "[1,2]" })).status, 400);
  assert.equal((await post(env, null, { raw: "x".repeat(20000) })).status, 413);
  assert.equal(sent.length, 0);
  assert.equal((await post(env, { ...GOOD, message: "x".repeat(10) })).status, 200);
  assert.equal((await post(env, { ...GOOD, message: "é".repeat(3000) })).status, 200);
});

test("injection d'en-têtes : aucun \\r\\n dans les en-têtes", async () => {
  const { env, sent } = makeEnv();
  // e-mail avec CRLF : refusé
  assert.equal((await post(env, { ...GOOD, email: "a@b.fr\r\nBcc: victime@example.com" })).status, 400);
  assert.equal((await post(env, { ...GOOD, email: "a@b.fr\nBcc:x@y.fr" })).status, 400);
  // prénom / page avec CRLF : aplatis sur une ligne
  const evil = "Léa\r\nBcc: victime@example.com\r\n\r\ncorps forgé";
  assert.equal((await post(env, { ...GOOD, name: evil, page: "/x\r\nBcc: v@example.com" })).status, 200);
  const raw = sent[0].raw;
  const head = raw.split("\r\n\r\n")[0];
  assert.ok(!/^bcc:/im.test(head), "pas d'en-tête Bcc injecté");
  assert.ok(!/^cc:/im.test(head));
  const names = head.replace(/\r\n /g, " ").split("\r\n").map((l) => l.split(":")[0].toLowerCase());
  assert.deepEqual(names, ["from", "to", "reply-to", "subject", "date", "message-id", "mime-version", "auto-submitted", "content-type"]);
  const { headers, dec } = parse(raw);
  assert.ok(!dec(headers["reply-to"]).includes("\n") && !dec(headers.subject).includes("\n"));
  // helpers
  assert.equal(oneLine("a\r\nb\u2028c\td\u0000e"), "a b c d e");
  assert.ok(headerSafe("é\r\nBcc: x@y.fr".repeat(10)).split("\r\n ").every((w) => !/[\r\n]/.test(w)), "seuls des plis CRLF+espace");
});

test("page d'origine : chemin du site uniquement, repli sur Referer", async () => {
  const { env, calls } = makeEnv();
  await post(env, { ...GOOD, page: "/contact/?sujet=erreur" });
  assert.equal(calls.at(-1).page, "https://calend.run/contact/?sujet=erreur");
  await post(env, { ...GOOD, page: "https://evil.example/phish" });
  assert.equal(calls.at(-1).page, "");
  await post(env, { ...GOOD, page: "//evil.example/x" });
  assert.equal(calls.at(-1).page, "");
  await post(env, { ...GOOD, page: "/\\evil.example" });
  assert.equal(calls.at(-1).page, "");
  await post(env, { ...GOOD, page: undefined }, { headers: { referer: "https://calend.run/amis/" } });
  assert.equal(calls.at(-1).page, "https://calend.run/amis/");
  await post(env, { ...GOOD, page: undefined }, { headers: { referer: "https://evil.example/amis/" } });
  assert.equal(calls.at(-1).page, "");
});

test("échec du Worker ou de send_email : 502 (le navigateur propose le mailto)", async () => {
  const { env } = makeEnv();
  env.MAILER = { fetch: async () => new Response("{}", { status: 502 }) };
  assert.equal((await post(env, GOOD)).status, 502);
  env.MAILER = { fetch: async () => { throw new Error("réseau"); } };
  assert.equal((await post(env, GOOD)).status, 502);
  // send_email qui refuse (adresse non vérifiée…)
  const wenv = mailerEnv({ send: async () => { throw new Error("E_RECIPIENT_NOT_ALLOWED"); } });
  const orig = console.error; console.error = () => {};
  try {
    const res = await worker(new Request("https://mailer/contact", { method: "POST", body: JSON.stringify(GOOD) }), wenv);
    assert.equal(res.status, 502);
  } finally { console.error = orig; }
});

test("Worker mailer : revalide et ne répond qu'à POST /contact", async () => {
  const binding = sendEmail();
  const env = mailerEnv(binding);
  const call = (method, path, body) => worker(new Request("https://mailer" + path, { method, body: body && JSON.stringify(body) }), env);
  assert.equal((await call("GET", "/contact")).status, 404);
  assert.equal((await call("POST", "/autre", GOOD)).status, 404);
  assert.equal((await call("POST", "/contact", { ...GOOD, email: "x\r\n@y.fr" })).status, 400);
  assert.equal((await call("POST", "/contact", { ...GOOD, message: "court" })).status, 400);
  assert.equal((await worker(new Request("https://mailer/contact", { method: "POST", body: "{" }), env)).status, 400);
  assert.equal((await worker(new Request("https://mailer/contact", { method: "POST", body: "{}" }), {})).status, 503);
  assert.equal(binding.sent.length, 0);
  assert.equal((await call("POST", "/contact", GOOD)).status, 200);
  assert.equal(binding.sent.length, 1);
});

test("MIME : sans prénom, Reply-To = adresse seule ; caractères HTML échappés", () => {
  const f = normalize({ topic: "erreur", email: "a@b.fr", message: "<script>alert(1)</script> & co" });
  const { raw } = contactMail(f);
  const { headers, dec, html, text } = parse(raw);
  assert.equal(headers["reply-to"], "<a@b.fr>");
  assert.equal(dec(headers.subject), "[CalendRun] Erreur — a@b.fr");
  assert.ok(!html.includes("<script>") && html.includes("&lt;script&gt;"));
  assert.ok(text.includes("<script>alert(1)</script> & co"), "texte brut intact");
  assert.ok(text.includes("Prénom : (sans prénom)"));
});
