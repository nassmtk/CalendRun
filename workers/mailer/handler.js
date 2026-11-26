/* =========================================================
   Logique du Worker « mailer » (séparée de index.js pour être testable sous Node :
   la classe EmailMessage de « cloudflare:email » est injectée).
   POST /contact  { topic, name, email, message, page, date }
   → revalide tout (défense en profondeur) → e-mail MIME → binding send_email.
   Ce Worker n'a aucune route publique : seul le site l'appelle, via un service binding.
   ========================================================= */
import { isEmail } from "../../functions/_lib/util.js";
import { BRAND } from "../../brand.config.js";
import { buildMime, mailbox, oneLine } from "./mime.js";

export const TOPICS = { question: "Question", course: "Proposer une course", erreur: "Erreur", partenariat: "Partenariat", autre: "Autre" };
export const FROM = "formulaire@calend.run";
export const TO = "calendrun@gmail.com";
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const reply = (status, data) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });

/** valide et normalise ; renvoie { error } ou les champs propres */
export function normalize(body) {
  if (!body || typeof body !== "object") return { error: "corps invalide" };
  const topic = Object.hasOwn(TOPICS, body.topic) ? body.topic : "autre";
  const name = oneLine(body.name).slice(0, 80);
  const email = String(body.email ?? "").trim().toLowerCase();
  const message = String(body.message ?? "").replace(/\r\n?/g, "\n").trim();
  const page = oneLine(body.page).slice(0, 300);
  const date = oneLine(body.date).slice(0, 80);
  if (!isEmail(email)) return { error: "e-mail invalide" };
  if (message.length < 10 || message.length > 3000) return { error: "longueur du message" };
  return { topic, name, email, message, page, date };
}

export function contactMail(f, { from = FROM, to = TO } = {}) {
  const label = TOPICS[f.topic];
  const who = f.name || "(sans prénom)";
  const subject = `[${BRAND.SITE_NAME}] ${label} — ${f.name || f.email}`.slice(0, 180);
  const text = [
    `Sujet  : ${label}`,
    `Prénom : ${who}`,
    `E-mail : ${f.email}`,
    `Page   : ${f.page || "(inconnue)"}`,
    `Date   : ${f.date}`,
    "",
    f.message,
    "",
    "—",
    `Réponds directement à cet e-mail pour écrire à ${f.email}.`
  ].join("\n");
  const row = (k, v) => `<tr><td style="padding:2px 12px 2px 0;color:#5B5751;white-space:nowrap">${k}</td><td style="padding:2px 0">${v}</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#141414">
<table style="border-collapse:collapse;font-size:14px;margin:0 0 16px">
${row("Sujet", `<b>${esc(label)}</b>`)}
${row("Prénom", esc(who))}
${row("E-mail", esc(f.email))}
${row("Page", esc(f.page || "(inconnue)"))}
${row("Date", esc(f.date))}
</table>
<div style="white-space:pre-wrap;padding:14px 16px;border-left:3px solid #FC4C02;background:#F6F4F0">${esc(f.message)}</div>
<p style="margin:16px 0 0;color:#5B5751;font-size:12px">Réponds directement à cet e-mail pour écrire à ${esc(f.email)}.</p>
</div>`;
  const raw = buildMime({
    from: mailbox(from, `${BRAND.SITE_NAME} — formulaire`),
    to: mailbox(to),
    replyTo: mailbox(f.email, f.name),
    subject, text, html,
    domain: from.split("@")[1]
  });
  return { from, to, subject, raw };
}

export function createHandler(EmailMessage) {
  return async function fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/contact") return reply(404, { ok: false });
    if (!env.CONTACT_MAIL) return reply(503, { ok: false, error: "binding send_email CONTACT_MAIL absent" });
    let body;
    try { body = await request.json(); } catch { return reply(400, { ok: false, error: "JSON invalide" }); }
    const f = normalize(body);
    if (f.error) return reply(400, { ok: false, error: f.error });
    const mail = contactMail(f, { from: env.CONTACT_FROM || FROM, to: env.CONTACT_TO || TO });
    try {
      await env.CONTACT_MAIL.send(new EmailMessage(mail.from, mail.to, mail.raw));
    } catch (e) {
      console.error("mailer send", e && e.message);
      return reply(502, { ok: false, error: "envoi refusé" });
    }
    return reply(200, { ok: true });
  };
}
