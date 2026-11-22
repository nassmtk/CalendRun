/* =========================================================
   POST /api/contact — formulaire de contact
   Flux : même origine → limitation IP → taille → champ piège → validation
          → Turnstile (si TURNSTILE_SECRET_KEY est défini) → Brevo (e-mail transactionnel)
   Le message est envoyé à CONTACT_TO (sinon CONTACT_EMAIL de brand.config.js),
   avec « Répondre à » = l'adresse du visiteur. Aucun e-mail n'est envoyé au visiteur
   (le formulaire ne peut pas servir à écrire à un tiers).
   Variables : BREVO_API_KEY, SENDER_EMAIL, SITE_URL ; optionnelles : CONTACT_TO,
               TURNSTILE_SECRET_KEY, ALLOWED_ORIGINS ; KV optionnel : RATE_LIMIT
   ========================================================= */
import { BRAND } from "../../brand.config.js";
import { json, isEmail, rateLimited, turnstileOk, brevo, siteUrl } from "../_lib/util.js";

const TOPICS = { question: "Question", course: "Proposer une course", erreur: "Signaler une erreur", partenariat: "Partenariat / presse", autre: "Autre" };
const MAX_BODY = 8192;
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const oneLine = (s) => String(s).replace(/[\r\n\t]+/g, " ").trim();

export async function onRequestPost({ request, env }) {
  if (!env.BREVO_API_KEY || !env.SENDER_EMAIL || !env.SITE_URL) return json({ ok: false, message: "Formulaire indisponible." }, 503);

  const origin = request.headers.get("origin");
  const allowed = [siteUrl(env), ...String(env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)];
  if (origin && !allowed.includes(origin)) return json({ ok: false }, 403);

  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  if (await rateLimited(env, ip, { limit: 3, windowSec: 600, scope: "contact" })) {
    return json({ ok: false, message: "Tu as envoyé plusieurs messages d'affilée : réessaie dans quelques minutes." }, 429, { "retry-after": "600" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, message: "Message trop long (3000 caractères maximum)." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, message: "Requête invalide." }, 400); }

  // champ piège rempli = robot : on fait comme si tout allait bien
  if (body.website) return json({ ok: true });

  const topic = TOPICS[body.topic] ? body.topic : "autre";
  const name = oneLine(body.name || "").slice(0, 80);
  const email = String(body.email || "").trim().toLowerCase();
  const message = String(body.message || "").trim();
  if (!isEmail(email)) return json({ ok: false, message: "Vérifie ton adresse e-mail." }, 400);
  if (message.length < 10 || message.length > 3000) return json({ ok: false, message: "Ton message doit faire entre 10 et 3000 caractères." }, 400);

  if (env.TURNSTILE_SECRET_KEY && !(await turnstileOk(env, body.turnstileToken, ip))) {
    return json({ ok: false, message: "Vérification anti-robot échouée, réessaie." }, 400);
  }

  const to = env.CONTACT_TO || BRAND.CONTACT_EMAIL;
  const subject = oneLine(`[${BRAND.SITE_NAME}] ${TOPICS[topic]} — ${name || email}`).slice(0, 180);
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#141414">
    <p style="margin:0 0 4px;color:#5B5751;font-size:13px">Formulaire de contact · ${esc(TOPICS[topic])}</p>
    <p style="margin:0 0 16px"><b>${esc(name || "(sans prénom)")}</b> &lt;${esc(email)}&gt;</p>
    <div style="white-space:pre-wrap;padding:14px 16px;border-left:3px solid #FC4C02;background:#F6F4F0">${esc(message)}</div>
    <p style="margin:16px 0 0;color:#5B5751;font-size:12px">Réponds directement à cet e-mail pour écrire à ${esc(email)}.</p>
  </div>`;
  const r = await brevo(env, "/smtp/email", {
    method: "POST",
    body: {
      sender: { name: `${BRAND.SITE_NAME} — contact`, email: env.SENDER_EMAIL },
      to: [{ email: to }],
      replyTo: name ? { email, name } : { email },
      subject,
      htmlContent: html,
      textContent: `${TOPICS[topic]}\nDe : ${name || "(sans prénom)"} <${email}>\n\n${message}`,
      tags: ["contact"]
    }
  }).catch((e) => { console.error("contact brevo", e && e.message); return { ok: false }; });

  if (!r.ok) return json({ ok: false, message: "Envoi impossible pour le moment." }, 502);
  return json({ ok: true });
}

export const onRequestGet = () => json({ ok: false }, 405, { allow: "POST" });
