/* =========================================================
   Worker planifié (cron quotidien) : envoi des alertes confirmées
   - « reminder » : 7 jours avant la course
   - « opening »  : le jour d'ouverture des inscriptions, quand la date est connue
     (registration.opens dans les données). Sinon : campagne Brevo manuelle.
   Source des courses : ${SITE_URL}/races.json (généré au build).
   Contacts : liste Brevo BREVO_LIST_ID (uniquement des contacts confirmés en double opt-in),
   attribut ALERT_RACES = "raceId:opening+reminder,raceId2:reminder".
   Chaque e-mail contient un lien de désinscription en un clic + en-têtes List-Unsubscribe.
   Purge RGPD (même cron) : un contact est supprimé de Brevo 12 mois après la date de la
   dernière course qu'il suit (ou 12 mois après son consentement s'il ne suit plus aucune
   course connue). Voir la politique de confidentialité.
   ========================================================= */
import { BRAND } from "../../brand.config.js";
import { brevo, unsubscribeUrl, siteUrl } from "../../functions/_lib/util.js";
import { purgeInactive } from "../../functions/_lib/accounts/account.js";
import { purgeRateLimits } from "../../functions/_lib/accounts/ratelimit.js";

const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function listContacts(env) {
  const out = [];
  for (let offset = 0; offset < 50000; offset += 500) {
    const r = await brevo(env, `/contacts/lists/${Number(env.BREVO_LIST_ID)}/contacts?limit=500&offset=${offset}`);
    const batch = (r.data && r.data.contacts) || [];
    out.push(...batch);
    if (batch.length < 500) break;
  }
  return out;
}

function mail(env, { race, kind, unsub }) {
  const url = `${siteUrl(env)}/courses/${race.id}-2027/`;
  const title = kind === "opening" ? `Inscriptions ouvertes : ${race.name}` : `J-7 : ${race.name}`;
  const intro = kind === "opening"
    ? `Les inscriptions pour <b>${esc(race.name)}</b> ouvrent aujourd'hui. Les dossards partent parfois vite !`
    : `<b>${esc(race.name)}</b>, c'est dans 7 jours : ${esc(race.dateLong)} à ${esc(race.place)}.`;
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#0A0A0B;color:#F5F3EF;font-family:Inter,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px">
    <p style="font-weight:800;font-size:20px;margin:0 0 24px">${esc(BRAND.SITE_NAME)}</p>
    <h1 style="font-size:24px;margin:0 0 12px">${esc(title)}</h1>
    <p style="color:#9A968F;line-height:1.6">${intro}</p>
    <p style="margin:28px 0"><a href="${race.link || url}" style="background:#FC4C02;color:#0A0A0B;padding:12px 20px;border-radius:999px;font-weight:700;text-decoration:none">${kind === "opening" ? "Prendre mon dossard" : "Voir la course"}</a></p>
    <p style="color:#9A968F;font-size:13px;line-height:1.6">Infos indicatives : vérifie toujours sur le site officiel de l'organisateur.<br/><a href="${url}" style="color:#FC4C02">Fiche de la course</a></p>
    <hr style="border:0;border-top:1px solid #222;margin:28px 0"/>
    <p style="color:#5F5C57;font-size:12px">Tu reçois cet e-mail car tu as demandé une alerte sur ${esc(BRAND.SITE_NAME)}. <a href="${unsub}" style="color:#9A968F">Se désinscrire en un clic</a>.</p>
  </div></body></html>`;
  return {
    sender: { name: BRAND.SITE_NAME, email: env.SENDER_EMAIL || BRAND.SENDER_EMAIL },
    subject: title,
    htmlContent: html,
    headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: ["alerte", kind]
  };
}

export const RETENTION_MONTHS = 12;

/** date limite de conservation d'un contact (Date), ou null si on ne peut pas la calculer */
export function retentionLimit(contact, byId) {
  const ids = String(contact.attributes?.ALERT_RACES || "").split(",").filter(Boolean).map((e) => e.split(":")[0]);
  const dates = ids.map((id) => byId.get(id)).filter(Boolean).map((r) => r.endDate || r.date).filter(Boolean).sort();
  const ref = dates.length ? dates[dates.length - 1] : contact.attributes?.CONSENT_AT || contact.createdAt;
  if (!ref) return null;
  const d = new Date(String(ref).slice(0, 10) + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCMonth(d.getUTCMonth() + RETENTION_MONTHS);
  return d;
}

/** supprime de Brevo les contacts dont la durée de conservation est dépassée */
export async function purgeExpired(env, contacts, byId, now = new Date()) {
  let purged = 0;
  for (const c of contacts) {
    const limit = retentionLimit(c, byId);
    if (!limit || limit > now) continue;
    const r = await brevo(env, `/contacts/${encodeURIComponent(c.email)}`, { method: "DELETE" });
    if (r.ok || r.status === 404) purged++;
  }
  return purged;
}

export async function runReminders(env, now = new Date()) {
  if (!env.BREVO_API_KEY || !Number(env.BREVO_LIST_ID)) return { skipped: "Brevo non configuré" };
  const races = await (await fetch(`${siteUrl(env)}/races.json`, { cf: { cacheTtl: 300 } })).json();
  const byId = new Map(races.map((r) => [r.id, r]));
  const contacts = await listContacts(env);
  // la purge tourne même si les alertes ont été désactivées entre-temps
  const purged = await purgeExpired(env, contacts, byId, now);
  if (env.ALERTS_ENABLED !== "true") return { skipped: "ALERTS_ENABLED != true", purged };
  const today = iso(now), in7 = iso(new Date(now.getTime() + 7 * DAY));
  let sent = 0;
  for (const c of contacts) {
    if (c.emailBlacklisted) continue;
    if ((retentionLimit(c, byId) || now) <= now) continue; // déjà purgé
    const entries = String(c.attributes?.ALERT_RACES || "").split(",").filter(Boolean);
    for (const e of entries) {
      const [id, kinds = ""] = e.split(":");
      const race = byId.get(id);
      if (!race) continue;
      const want = kinds.split("+");
      const due = want.includes("reminder") && race.date === in7 ? "reminder" : want.includes("opening") && race.opens === today ? "opening" : null;
      if (!due) continue;
      const unsub = await unsubscribeUrl(env, c.email);
      const r = await brevo(env, "/smtp/email", { method: "POST", body: { ...mail(env, { race, kind: due, unsub }), to: [{ email: c.email }] } });
      if (r.ok) sent++;
    }
  }
  return { sent, purged, today };
}

/** comptes (D1, si le binding DB est présent) : comptes inactifs depuis 3 ans, sessions expirées, compteurs de tentatives */
export async function purgeAccounts(env) {
  if (!env.DB) return { skipped: true };
  const users = await purgeInactive(env.DB, 3);
  const sessions = await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(Math.floor(Date.now() / 1000)).run();
  await purgeRateLimits(env.DB);
  return { inactiveUsers: users.meta?.changes ?? 0, expiredSessions: sessions.meta?.changes ?? 0 };
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminders(env).then((r) => console.log("reminders", JSON.stringify(r))));
    ctx.waitUntil(purgeAccounts(env).then((r) => console.log("comptes", JSON.stringify(r))).catch((e) => console.error("comptes", e)));
  }
};
