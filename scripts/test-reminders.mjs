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
const env = { ALERTS_ENABLED: "true", SITE_URL: "https://calend.run", BREVO_API_KEY: "k", BREVO_LIST_ID: "1", SENDER_EMAIL: "alertes@calend.run", UNSUB_SECRET: "s" };
const out = await runReminders(env, new Date("2027-09-19T07:00:00Z"));
const ok = (c, l) => { console.log(c ? "  ✓" : "  ✗", l); if (!c) process.exitCode = 1; };
ok(out.sent === 2, `2 e-mails envoyés (reçu ${out.sent})`);
ok(sent.some((m) => m.to[0].email === "a@test.fr" && /J-7/.test(m.subject)), "rappel J-7 pour a@ (Paris-Versailles le 26/09)");
ok(sent.some((m) => m.to[0].email === "a@test.fr" && /ouvertes/.test(m.subject)), "alerte d'ouverture pour a@ (Course X ouvre le 19/09)");
ok(!sent.some((m) => m.to[0].email === "b@test.fr"), "b@ n'a demandé que l'ouverture → rien");
ok(!sent.some((m) => m.to[0].email === "c@test.fr"), "c@ blacklisté → rien");
ok(sent.every((m) => /api\/unsubscribe\?e=/.test(m.htmlContent) && m.headers["List-Unsubscribe-Post"]), "lien de désinscription + List-Unsubscribe dans chaque e-mail");

// ---- purge RGPD : 12 mois après la dernière course suivie ----
const { purgeExpired, retentionLimit } = await import("../workers/reminders/index.js");
const byId = new Map(races.map((r) => [r.id, r]));
const deleted = [];
globalThis.fetch = async (url, opt = {}) => {
  if (opt.method === "DELETE") { deleted.push(decodeURIComponent(String(url).split("/contacts/")[1])); return new Response(null, { status: 204 }); }
  return new Response("{}", { status: 404 });
};
const people = [
  { email: "old@test.fr", attributes: { ALERT_RACES: "paris-versailles:reminder" } },                        // course 26/09/2027 → limite 26/09/2028
  { email: "keep@test.fr", attributes: { ALERT_RACES: "paris-versailles:reminder,x-open:opening" } },        // dernière course 01/12/2027 → limite 01/12/2028
  { email: "ghost@test.fr", attributes: { ALERT_RACES: "course-retiree:reminder", CONSENT_AT: "2027-01-10T10:00:00Z" } } // course inconnue → consentement + 12 mois
];
ok(retentionLimit(people[0], byId).toISOString().startsWith("2028-09-26"), "limite = date de la course + 12 mois");
const purged = await purgeExpired(env, people, byId, new Date("2028-10-01T07:00:00Z"));
ok(purged === 2 && deleted.includes("old@test.fr") && deleted.includes("ghost@test.fr"), `purge au 01/10/2028 : old@ et ghost@ supprimés (reçu ${deleted.join(", ")})`);
ok(!deleted.includes("keep@test.fr"), "keep@ suit encore une course de décembre 2027 → conservé");
