/* =========================================================
   POST /api/subscribe — inscription à une alerte course
   Flux : validation serveur → champ piège → limitation IP → Turnstile
          → Brevo : double opt-in (nouveau contact) ou mise à jour (contact déjà confirmé)
   Réponse TOUJOURS générique (pas d'énumération d'e-mails).
   Variables : ALERTS_ENABLED, BREVO_API_KEY, BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID,
               TURNSTILE_SECRET_KEY, UNSUB_SECRET, SITE_URL ; KV optionnel : RATE_LIMIT
   ========================================================= */
import { json, GENERIC_OK, isEmail, RACE_ID_RE, rateLimited, turnstileOk, brevo, siteUrl } from "../_lib/util.js";

const ALLOWED_ALERTS = new Set(["opening", "reminder"]);
const MAX_BODY = 4096;

export async function onRequestPost({ request, env }) {
  if (env.ALERTS_ENABLED !== "true") return json({ ok: false, message: "Alertes indisponibles." }, 503);
  for (const k of ["BREVO_API_KEY", "BREVO_LIST_ID", "BREVO_DOI_TEMPLATE_ID", "TURNSTILE_SECRET_KEY", "SITE_URL"]) {
    if (!env[k]) return json({ ok: false, message: "Alertes indisponibles." }, 503);
  }

  // même origine uniquement
  const origin = request.headers.get("origin");
  const allowed = [siteUrl(env), ...String(env.ALLOWED_ORIGINS || "").split(",").map((o) => o.trim().replace(/\/+$/, "")).filter(Boolean)];
  if (origin && !allowed.includes(origin)) return json({ ok: false }, 403);

  const ip = request.headers.get("cf-connecting-ip") || "0.0.0.0";
  if (await rateLimited(env, ip, { limit: 5, windowSec: 600 })) {
    return json({ ok: false, message: "Trop de demandes, réessaie dans quelques minutes." }, 429, { "retry-after": "600" });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ ok: false }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ ok: false, message: "Requête invalide." }, 400); }

  // champ piège : un humain ne le remplit jamais → on répond « OK » sans rien faire
  if (body.website) return json(GENERIC_OK);

  const email = String(body.email || "").trim().toLowerCase();
  const raceId = String(body.raceId || "");
  const alerts = Array.isArray(body.alerts) ? [...new Set(body.alerts.map(String))].filter((a) => ALLOWED_ALERTS.has(a)) : [];
  if (!isEmail(email) || !RACE_ID_RE.test(raceId) || !alerts.length || body.consent !== true) {
    return json({ ok: false, message: "Vérifie l'adresse e-mail, le type d'alerte et la case de consentement." }, 400);
  }
  if (!(await turnstileOk(env, body.turnstileToken, ip))) {
    return json({ ok: false, message: "Vérification anti-robot échouée, réessaie." }, 400);
  }

  const listId = Number(env.BREVO_LIST_ID);
  const entry = `${raceId}:${alerts.join("+")}`;
  try {
    const existing = await brevo(env, `/contacts/${encodeURIComponent(email)}`);
    const confirmed = existing.ok && (existing.data?.listIds || []).includes(listId);
    if (confirmed) {
      // déjà confirmé : on ajoute la course à ses alertes (même consentement, même finalité)
      const prev = String(existing.data?.attributes?.ALERT_RACES || "").split(",").filter(Boolean).filter((x) => !x.startsWith(raceId + ":"));
      await brevo(env, `/contacts/${encodeURIComponent(email)}`, { method: "PUT", body: { attributes: { ALERT_RACES: [...prev, entry].join(",").slice(0, 2000) } } });
    } else {
      // nouveau : double opt-in — Brevo envoie l'e-mail de confirmation (template DOI)
      await brevo(env, "/contacts/doubleOptinConfirmation", {
        method: "POST",
        body: {
          email,
          includeListIds: [listId],
          templateId: Number(env.BREVO_DOI_TEMPLATE_ID),
          redirectionUrl: `${siteUrl(env)}/alertes/confirmee/`,
          attributes: { ALERT_RACES: entry, CONSENT_AT: new Date().toISOString() }
        }
      });
    }
  } catch (e) {
    console.error("brevo", e && e.message);
    // même réponse générique : l'erreur est journalisée côté serveur
  }
  return json(GENERIC_OK);
}

export const onRequestGet = () => json({ ok: false }, 405, { allow: "POST" });
