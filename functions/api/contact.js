/* =========================================================
   POST /api/contact — formulaire de contact
   Flux : Origin autorisée → limitation IP → taille → champ piège → validation
          → Turnstile (obligatoire) → Worker « calendrun-mailer » (service binding MAILER)
          → Cloudflare Email Routing (send_email) → boîte du site.
   Les Pages Functions ne gèrent pas le binding send_email : l'envoi est délégué
   au Worker workers/mailer (voir son README). « Répondre à » = l'adresse du visiteur ;
   aucun e-mail n'est envoyé au visiteur (le formulaire ne peut pas écrire à un tiers).
   Liaisons / variables : MAILER (service), TURNSTILE_SECRET_KEY (secret), SITE_URL ;
   optionnelles : ALLOWED_ORIGINS, RATE_LIMIT (KV)
   ========================================================= */
import { json, isEmail, rateLimited, turnstileOk, siteUrl, originOk, allowedOrigins } from "../_lib/util.js";
import { oneLine } from "../../workers/mailer/mime.js";

const TOPICS = new Set(["question", "course", "erreur", "partenariat", "autre"]);
const MAX_BODY = 16384;
const UNAVAILABLE = { ok: false, message: "Formulaire indisponible." };

/** page d'origine : un chemin du site uniquement (jamais une URL externe) */
function originPage(value, env) {
  const p = oneLine(value).slice(0, 300);
  if (!/^\/(?![\/\\])/.test(p)) return "";
  try {
    const u = new URL(p, siteUrl(env));
    return u.origin === siteUrl(env) ? u.href : "";
  } catch { return ""; }
}

/** repli : l'en-tête Referer, s'il vient d'une origine autorisée */
function refererPage(request, env) {
  try {
    const u = new URL(request.headers.get("referer") || "");
    return allowedOrigins(env).includes(u.origin) ? originPage(u.pathname + u.search, env) : "";
  } catch { return ""; }
}

export const parisDate = (d = new Date()) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "medium", timeZone: "Europe/Paris" }).format(d) + " (heure de Paris)";

export async function onRequestPost({ request, env }) {
  if (!env.MAILER || !env.TURNSTILE_SECRET_KEY) return json(UNAVAILABLE, 503);

  if (!originOk(request, env)) return json({ ok: false }, 403);

  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  if (await rateLimited(env, ip, { limit: 3, windowSec: 600, scope: "contact" })) {
    return json({ ok: false, message: "Tu as envoyé plusieurs messages d'affilée : réessaie dans quelques minutes." }, 429, { "retry-after": "600" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false, message: "Message trop long (3000 caractères maximum)." }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, message: "Requête invalide." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, message: "Requête invalide." }, 400);

  // champ piège rempli = robot : on fait comme si tout allait bien, sans rien envoyer
  if (body.website) return json({ ok: true });

  const topic = TOPICS.has(body.topic) ? body.topic : "autre";
  const name = oneLine(typeof body.name === "string" ? body.name : "").slice(0, 80);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.replace(/\r\n?/g, "\n").trim() : "";
  // isEmail refuse tout espace blanc, donc \r et \n : l'adresse peut aller dans Reply-To
  if (!isEmail(email)) return json({ ok: false, message: "Vérifie ton adresse e-mail." }, 400);
  if (message.length < 10 || message.length > 3000) return json({ ok: false, message: "Ton message doit faire entre 10 et 3000 caractères." }, 400);

  if (!(await turnstileOk(env, body.turnstileToken, ip))) {
    return json({ ok: false, message: "Vérification anti-robot échouée, réessaie." }, 400);
  }

  const page = originPage(body.page, env) || refererPage(request, env);
  let res;
  try {
    res = await env.MAILER.fetch("https://mailer/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic, name, email, message, page, date: parisDate() })
    });
  } catch (e) {
    console.error("contact mailer", e && e.message);
  }
  if (!res || !res.ok) {
    if (res) console.error("contact mailer", res.status, await res.text().catch(() => ""));
    return json({ ok: false, message: "Envoi impossible pour le moment." }, 502);
  }
  return json({ ok: true });
}

export const onRequestGet = () => json({ ok: false }, 405, { allow: "POST" });
