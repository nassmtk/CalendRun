/* Cloudflare Turnstile (anti-robot) pour le formulaire d'alerte.
   Le script n'est chargé que lorsqu'un formulaire d'alerte s'affiche. */
const SITE_KEY = __TURNSTILE_SITE_KEY__;
let loading = null;

function load() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve(window.turnstile);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return loading;
}

export function initTurnstile(A) {
  A.hooks.alertForm.push(async (form) => {
    const slot = form.querySelector(".wl-turnstile");
    if (!slot) return;
    if (!SITE_KEY) { slot.textContent = "Alertes indisponibles : clé Turnstile manquante (TURNSTILE_SITE_KEY)."; return; }
    try {
      const ts = await load();
      if (slot.dataset.widget) { ts.reset(slot.dataset.widget); return; }
      slot.dataset.widget = ts.render(slot, {
        sitekey: SITE_KEY, theme: "dark", language: "fr", size: "flexible", appearance: "interaction-only",
        callback: (token) => { form.dataset.turnstile = token; },
        "expired-callback": () => { delete form.dataset.turnstile; },
        "error-callback": () => { delete form.dataset.turnstile; }
      });
    } catch {
      slot.textContent = "La vérification anti-robot n'a pas pu se charger.";
    }
  });
}
