/* =========================================================
   /api/unsubscribe?e=<email>&t=<hmac> — désinscription en un clic
   - GET  : depuis le lien de l'e-mail → retire le contact de la liste puis redirige
   - POST : « List-Unsubscribe-Post: List-Unsubscribe=One-Click » (RFC 8058, clients mail)
   Le jeton HMAC empêche de désinscrire quelqu'un d'autre.
   ========================================================= */
import { hmac, safeEqual, brevo, siteUrl } from "../_lib/util.js";

async function unsubscribe(url, env) {
  const email = String(url.searchParams.get("e") || "").trim().toLowerCase();
  const token = String(url.searchParams.get("t") || "");
  if (!email || !token || !env.UNSUB_SECRET) return false;
  if (!safeEqual(token, await hmac(env.UNSUB_SECRET, email))) return false;
  try {
    await brevo(env, `/contacts/lists/${Number(env.BREVO_LIST_ID)}/contacts/remove`, { method: "POST", body: { emails: [email] } });
    await brevo(env, `/contacts/${encodeURIComponent(email)}`, { method: "PUT", body: { attributes: { ALERT_RACES: "" } } });
  } catch (e) {
    console.error("unsubscribe", e && e.message);
  }
  return true;
}

export async function onRequestGet({ request, env }) {
  await unsubscribe(new URL(request.url), env);
  // même destination dans tous les cas (pas d'information sur l'existence de l'adresse)
  return Response.redirect(`${siteUrl(env)}/alertes/desinscription/`, 303);
}

export async function onRequestPost({ request, env }) {
  await unsubscribe(new URL(request.url), env);
  return new Response(null, { status: 204 });
}
