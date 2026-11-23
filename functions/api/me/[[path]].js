// /api/me/* → routeur des comptes (functions/_lib/accounts/account.js)
import { handleAccount } from "../../_lib/accounts/account.js";
import { json } from "../../_lib/util.js";

export async function onRequest({ request, env, params }) {
  const rest = [].concat(params.path || []).join("/");
  try {
    return await handleAccount(request, env, rest ? "me/" + rest : "me");
  } catch (e) {
    console.error("[me]", e);
    return json({ ok: false, message: "Erreur serveur : réessaie dans un instant." }, 500);
  }
}
