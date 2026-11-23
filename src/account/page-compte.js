/* =========================================================
   Pages /compte/ (connexion, inscription, Mon compte) et /compte/oubli/
   Tous les messages d'erreur sont annoncés (role="alert" / aria-live).
   Le serveur revalide tout : ces contrôles ne servent qu'au confort.
   ========================================================= */
import { account } from "../page.js";
import { ACCOUNTS, api, getState, onChange, avatar, esc, logout, loadMe } from "./core.js";
import { mountTurnstile, resetTurnstile } from "../turnstile.js";

const $ = (s) => document.querySelector(s);
const PSEUDO_RE = /^[a-zA-Z0-9_.-]{3,20}$/;

/* ---------- utilitaires de formulaire ---------- */
function showError(id, msg) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg || "";
  el.hidden = !msg;
}
function busy(form, on) {
  form.querySelectorAll("button[type=submit]").forEach((b) => { b.disabled = on; b.setAttribute("aria-busy", String(on)); });
}
function invalid(input, on) { input.setAttribute("aria-invalid", String(!!on)); if (on) input.focus(); }

/* ---------- robustesse du mot de passe (indicatif) ---------- */
export function strength(pw) {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < 12) return { score: 0, label: `Trop court : encore ${12 - pw.length} caractère${12 - pw.length > 1 ? "s" : ""}` };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const uniq = new Set(pw.toLowerCase()).size;
  let bits = Math.log2(Math.max(pool, 10)) * Math.min(pw.length, uniq * 2.5);
  if (/(.)\1{2,}/.test(pw)) bits -= 10;
  if (/(0123|1234|2345|3456|abcd|azer|qwer)/i.test(pw)) bits -= 12;
  if (/\s|-/.test(pw.trim()) && pw.split(/[\s-]+/).length >= 3) bits += 10; // phrase de passe
  const score = bits < 45 ? 1 : bits < 65 ? 2 : bits < 85 ? 3 : 4;
  return { score, label: ["", "Faible", "Correct", "Solide", "Très solide"][score] };
}
function meter(input, bar, label) {
  if (!input) return;
  const upd = () => {
    const s = strength(input.value);
    bar.style.setProperty("--s", s.score);
    bar.dataset.score = s.score;
    label.textContent = s.label ? `Robustesse : ${s.label}` : "";
  };
  input.addEventListener("input", upd);
}
document.querySelectorAll("[data-pw-toggle]").forEach((b) => {
  b.addEventListener("click", () => {
    const input = b.previousElementSibling;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    b.setAttribute("aria-pressed", String(show));
    b.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
  });
});

/* ---------- code de récupération ---------- */
function showCode(code, { pseudo = "", next = "/" } = {}) {
  document.querySelectorAll("main > section").forEach((s) => { s.hidden = s.id !== "view-code"; });
  $("#acct-loading") && ($("#acct-loading").hidden = true);
  $("#recovery-code").textContent = code;
  const title = $("#code-title");
  title.focus();
  const status = $("#code-status");
  $("#code-copy").onclick = async () => {
    try { await navigator.clipboard.writeText(code); status.textContent = "Code copié dans le presse-papiers."; }
    catch { status.textContent = "Copie impossible : sélectionne le code et copie-le à la main."; }
  };
  $("#code-dl").onclick = () => {
    const txt = `CalendRun — code de récupération\n\nPseudo : ${pseudo}\nCode   : ${code}\n\nCe code est le seul moyen de récupérer ton compte si tu oublies ton mot de passe.\nGarde-le en lieu sûr. Il change à chaque utilisation.\nPage de récupération : ${location.origin}/compte/oubli/\n`;
    const url = URL.createObjectURL(new Blob([txt], { type: "text/plain;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `calendrun-code-recuperation-${pseudo || "compte"}.txt` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = "Fichier téléchargé.";
  };
  const ok = $("#code-ok"), cont = $("#code-continue");
  ok.checked = false; cont.disabled = true;
  ok.onchange = () => { cont.disabled = !ok.checked; };
  cont.onclick = () => { location.href = next; };
}

/* =========================================================
   /compte/oubli/
   ========================================================= */
const recoverForm = $("#form-recover");
if (recoverForm) {
  meter($("#rv-password"), $("#rv-meter"), $("#rv-strength"));
  recoverForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("#rv-error");
    const pseudo = $("#rv-pseudo").value.trim(), code = $("#rv-code").value.trim(), pw = $("#rv-password").value;
    if (!PSEUDO_RE.test(pseudo)) { invalid($("#rv-pseudo"), true); return showError("#rv-error", "Indique ton pseudo."); }
    invalid($("#rv-pseudo"), false);
    if (code.replace(/[^0-9a-z]/gi, "").length !== 20) { invalid($("#rv-code"), true); return showError("#rv-error", "Le code de récupération fait 20 caractères (XXXXX-XXXXX-XXXXX-XXXXX)."); }
    invalid($("#rv-code"), false);
    if (pw.length < 12) { invalid($("#rv-password"), true); return showError("#rv-error", "Le nouveau mot de passe doit faire au moins 12 caractères."); }
    invalid($("#rv-password"), false);
    busy(recoverForm, true);
    const r = await api("POST", "auth/recover", { pseudo, code, newPassword: pw });
    busy(recoverForm, false);
    if (r.status === 200) showCode(r.data.recoveryCode, { pseudo, next: "/compte/" });
    else showError("#rv-error", r.data?.message || "Erreur : réessaie.");
  });
}

/* =========================================================
   /compte/
   ========================================================= */
const authView = $("#view-auth");
if (authView) initAccountPage();

function initAccountPage() {
  const loading = $("#acct-loading");
  if (!ACCOUNTS) { loading.hidden = true; $("#acct-off").hidden = false; return; }

  /* ----- onglets Connexion / Créer un compte ----- */
  const tabs = [$("#tab-login"), $("#tab-signup")];
  const panels = [$("#form-login"), $("#form-signup")];
  let tsId = null, tsToken = "";
  async function selectTab(i, focus = true) {
    tabs.forEach((t, j) => { t.setAttribute("aria-selected", String(i === j)); t.tabIndex = i === j ? 0 : -1; });
    panels.forEach((p, j) => { p.hidden = i !== j; });
    $("#auth-title").textContent = i ? "Créer un compte" : "Connexion";
    if (focus) tabs[i].focus();
    if (i === 1 && tsId === null) {
      tsId = await mountTurnstile($("#su-turnstile"), { onToken: (t) => { tsToken = t; }, onReset: () => { tsToken = ""; } }).catch(() => false);
    }
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(i));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); selectTab(1 - i); }
    });
  });
  if (location.hash === "#creer") selectTab(1, false);
  meter($("#su-password"), $("#su-meter"), $("#su-strength"));

  // après connexion : retour à la page demandée (même origine uniquement)
  const next = (() => { const n = new URLSearchParams(location.search).get("suite"); return n && n.startsWith("/") && !n.startsWith("//") ? n : "/"; })();

  $("#form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    showError("#li-error");
    const pseudo = $("#li-pseudo").value.trim(), password = $("#li-password").value;
    if (!pseudo || !password) return showError("#li-error", "Indique ton pseudo et ton mot de passe.");
    busy(f, true);
    const r = await api("POST", "auth/login", { pseudo, password });
    busy(f, false);
    if (r.status === 200) { location.href = next; return; }
    $("#li-password").value = "";
    showError("#li-error", r.data?.message || "Pseudo ou mot de passe incorrect.");
    $("#li-password").focus();
  });

  $("#form-signup").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    showError("#su-error");
    const pseudo = $("#su-pseudo").value.trim(), password = $("#su-password").value;
    if (!PSEUDO_RE.test(pseudo)) { invalid($("#su-pseudo"), true); return showError("#su-error", "Le pseudo doit faire 3 à 20 caractères : lettres, chiffres, point, tiret ou tiret bas."); }
    invalid($("#su-pseudo"), false);
    if (password.length < 12) { invalid($("#su-password"), true); return showError("#su-error", "Le mot de passe doit faire au moins 12 caractères."); }
    invalid($("#su-password"), false);
    if (tsId && !tsToken) return showError("#su-error", "Patiente une seconde : la vérification anti-robot n'est pas terminée.");
    busy(f, true);
    const r = await api("POST", "auth/signup", { pseudo, password, turnstile: tsToken });
    busy(f, false);
    if (r.status === 201) { showCode(r.data.recoveryCode, { pseudo, next }); loadMe(); return; }
    resetTurnstile(tsId); tsToken = "";
    showError("#su-error", r.data?.message || "Erreur : réessaie.");
  });

  /* ----- connecté ----- */
  account.then(() => {
    loading.hidden = true;
    const s = getState();
    if (!s.user) { authView.hidden = false; return; }
    renderAccount(s);
    onChange((st) => { if (st.user) renderAccount(st); });
  });
}

function renderAccount(s) {
  const v = $("#view-account");
  v.hidden = false;
  $("#acct-avatar").innerHTML = avatar(s.user, "avatar--lg");
  $("#acct-pseudo").textContent = s.user.pseudo;
  document.querySelectorAll('#form-vis input[name="visibility"]').forEach((i) => { i.checked = i.value === s.user.visibility; });
  if (v.dataset.bound) return;
  v.dataset.bound = "1";

  $("#form-vis").addEventListener("change", async (e) => {
    const st = $("#vis-status");
    st.textContent = "Enregistrement…";
    const r = await api("POST", "me/visibility", { visibility: e.target.value });
    st.textContent = r.status === 200 ? (r.data.visibility === "none" ? "Enregistré : personne ne voit tes courses." : "Enregistré : tes amis voient tes courses.") : (r.data?.message || "Erreur : réessaie.");
  });

  meter($("#pw-next"), $("#pw-meter"), $("#pw-strength"));
  $("#form-pw").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    showError("#pw-error"); $("#pw-status").textContent = "";
    const current = $("#pw-current").value, nextPw = $("#pw-next").value;
    if (!current) return showError("#pw-error", "Indique ton mot de passe actuel.");
    if (nextPw.length < 12) return showError("#pw-error", "Le nouveau mot de passe doit faire au moins 12 caractères.");
    busy(f, true);
    const r = await api("POST", "me/password", { current, next: nextPw });
    busy(f, false);
    if (r.status === 200) { f.reset(); $("#pw-meter").dataset.score = 0; $("#pw-strength").textContent = ""; $("#pw-status").textContent = "Mot de passe changé. Tes autres appareils ont été déconnectés."; }
    else showError("#pw-error", r.data?.message || "Erreur : réessaie.");
  });

  $("#form-rc").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    showError("#rc-error");
    const password = $("#rc-password").value;
    if (!password) return showError("#rc-error", "Indique ton mot de passe.");
    busy(f, true);
    const r = await api("POST", "me/recovery", { password });
    busy(f, false);
    if (r.status === 200) showCode(r.data.recoveryCode, { pseudo: getState().user.pseudo, next: "/compte/" });
    else showError("#rc-error", r.data?.message || "Erreur : réessaie.");
  });

  $("#logout-all").addEventListener("click", () => logout(true));

  $("#form-del").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    showError("#del-error");
    const password = $("#del-password").value;
    if (!password) return showError("#del-error", "Indique ton mot de passe.");
    if (!$("#del-ok").checked) { $("#del-ok").focus(); return showError("#del-error", "Coche la case pour confirmer."); }
    busy(f, true);
    const r = await api("POST", "me/delete", { password });
    busy(f, false);
    if (r.status === 200) {
      try { ["calendrun:favs", "calendrun:v1:registered", "calendrun:acct"].forEach((k) => localStorage.removeItem(k)); } catch {}
      document.querySelector("main").innerHTML = `<section class="doc-done"><p class="eyebrow">Compte supprimé</p><h1 tabindex="-1" id="bye">C'est fait.</h1><p class="lead">Ton compte et toutes ses données ont été effacés. Merci d'être passé·e, ${esc(getState().user?.pseudo || "")}.</p><a class="btn btn--primary" href="/">Retour au calendrier</a></section>`;
      $("#bye").focus();
    } else showError("#del-error", r.data?.message || "Erreur : réessaie.");
  });
}
