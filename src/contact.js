/* =========================================================
   Page Contact : formulaire → POST /api/contact (Pages Function → Worker mailer → Email Routing)
   - validation côté navigateur (le serveur revalide tout)
   - champ piège + Turnstile
   - succès : message de confirmation dans le formulaire, champs vidés
   - service indisponible (pas encore configuré, hors ligne, dev local) :
     on propose d'envoyer le même message par e-mail, déjà pré-rempli
   ========================================================= */
import "./page.js";
import { address } from "./mail.js";
import { mountTurnstile, resetTurnstile } from "./turnstile.js";

const $ = (s) => document.querySelector(s);
const form = $("#contact-form");
const errBox = $("#cf-error");
const okBox = $("#cf-success");
const btn = $("#cf-submit");
const msg = $("#cf-message");
const count = $("#cf-count");
const TOPICS = { question: "Une question", course: "Proposer une course", erreur: "Signaler une erreur", partenariat: "Partenariat / presse", autre: "Autre" };
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let token = "", widget = null;

// sujet pré-sélectionné : /contact/?sujet=course
const pre = new URLSearchParams(location.search).get("sujet");
if (pre && TOPICS[pre]) form.querySelector(`input[name=topic][value="${pre}"]`).checked = true;
document.querySelector(".nav-contact")?.classList.add("active");

msg.addEventListener("input", () => { count.textContent = `${msg.value.length} / 3000`; });
form.addEventListener("input", (e) => { if (e.target.getAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid"); });

mountTurnstile($("#cf-turnstile"), { onToken: (t) => { token = t; }, onReset: () => { token = ""; } })
  .then((id) => { widget = id; })
  .catch(() => { /* Turnstile injoignable : le serveur décidera */ });

function showError(html) {
  errBox.innerHTML = html;
  errBox.hidden = false;
}

function mailtoFallback(data) {
  const to = address("contact");
  const subject = `[${TOPICS[data.topic] || "Contact"}] Message depuis ${location.hostname}`;
  const body = `${data.message}\n\n— ${data.name || ""} (${data.email})`;
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// page d'où vient le visiteur (même site uniquement), sinon la page Contact elle-même
function originPath() {
  try {
    const r = new URL(document.referrer);
    if (r.origin === location.origin && r.pathname !== location.pathname) return r.pathname + r.search;
  } catch { /* pas de référent */ }
  return location.pathname + location.search;
}

function done(data) {
  const topic = form.querySelector("input[name=topic]:checked")?.value;
  form.reset();
  if (topic) form.querySelector(`input[name=topic][value="${topic}"]`).checked = true;
  count.textContent = "0 / 3000";
  okBox.innerHTML = `<strong>Message envoyé${data.name ? `, merci ${esc(data.name)}` : ""}&nbsp;!</strong> On te répond à <strong>${esc(data.email)}</strong> dès que possible.`;
  okBox.hidden = false;
  okBox.focus({ preventScroll: true });
  okBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errBox.hidden = true;
  okBox.hidden = true;
  const fd = new FormData(form);
  const data = {
    topic: String(fd.get("topic") || "question"),
    name: String(fd.get("name") || "").trim(),
    email: String(fd.get("email") || "").trim(),
    message: String(fd.get("message") || "").trim(),
    website: String(fd.get("website") || ""),
    page: originPath(),
    turnstileToken: token
  };

  const emailEl = $("#cf-email");
  if (!emailEl.checkValidity() || !data.email) {
    emailEl.setAttribute("aria-invalid", "true"); emailEl.focus();
    return showError("Vérifie ton adresse e-mail : on en a besoin pour te répondre.");
  }
  if (data.message.length < 10) {
    msg.setAttribute("aria-invalid", "true"); msg.focus();
    return showError("Ton message est un peu court (10 caractères minimum).");
  }

  btn.disabled = true;
  btn.textContent = "Envoi…";
  let res = null, out = {};
  try {
    res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    out = await res.json().catch(() => ({}));
  } catch { /* hors ligne */ }
  btn.disabled = false;
  btn.textContent = "Envoyer le message";

  resetTurnstile(widget); token = "";
  if (res && res.ok && out.ok) return done(data);
  if (res && (res.status === 400 || res.status === 429) && out.message) return showError(esc(out.message));
  // service pas encore actif / indisponible : rien n'est perdu, on passe par l'e-mail
  showError(`L'envoi depuis le site n'est pas disponible pour le moment. <a href="${esc(mailtoFallback(data))}">Envoie ce message par e-mail</a> (il est déjà rédigé).`);
});
