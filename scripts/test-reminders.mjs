// Test du worker de rappels avec un faux Brevo (aucun appel réseau réel)
import { runReminders } from "../workers/reminders/index.js";

const sent = [];
const races = [
  { id: "paris-versailles", name: "Paris-Versailles", date: "2027-09-26", dateLong: "dimanche 26 septembre 2027", place: "Paris → Versailles", opens: null, link: "https://www.parisversailles.com/site/" },
  { id: "x-open", name: "Course X", date: "2027-12-01", dateLong: "", place: "Paris", opens: "2027-09-19", link: "" }
];
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url);
  const res = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (u.endsWith("/races.json")) return res(races);
  if (u.includes("/contacts/lists/")) return res({ contacts: [
    { email: "a@test.fr", attributes: { ALERT_RACES: "paris-versailles:reminder,x-open:opening" } },
    { email: "b@test.fr", attributes: { ALERT_RACES: "paris-versailles:opening" } },
    { email: "c@test.fr", emailBlacklisted: true, attributes: { ALERT_RACES: "paris-versailles:reminder" } }
  ] });
  if (u.endsWith("/smtp/email")) { sent.push(JSON.parse(opt.body)); return new Response(null, { status: 201 }); }
  return res({}, 404);
};
const env = { ALERTS_ENABLED: "true", SITE_URL: "https://exemple.fr", BREVO_API_KEY: "k", BREVO_LIST_ID: "1", SENDER_EMAIL: "alertes@exemple.fr", UNSUB_SECRET: "s" };
const out = await runReminders(env, new Date("2027-09-19T07:00:00Z"));
const ok = (c, l) => { console.log(c ? "  ✓" : "  ✗", l); if (!c) process.exitCode = 1; };
ok(out.sent === 2, `2 e-mails envoyés (reçu ${out.sent})`);
ok(sent.some((m) => m.to[0].email === "a@test.fr" && /J-7/.test(m.subject)), "rappel J-7 pour a@ (Paris-Versailles le 26/09)");
ok(sent.some((m) => m.to[0].email === "a@test.fr" && /ouvertes/.test(m.subject)), "alerte d'ouverture pour a@ (Course X ouvre le 19/09)");
ok(!sent.some((m) => m.to[0].email === "b@test.fr"), "b@ n'a demandé que l'ouverture → rien");
ok(!sent.some((m) => m.to[0].email === "c@test.fr"), "c@ blacklisté → rien");
ok(sent.every((m) => /api\/unsubscribe\?e=/.test(m.htmlContent) && m.headers["List-Unsubscribe-Post"]), "lien de désinscription + List-Unsubscribe dans chaque e-mail");
