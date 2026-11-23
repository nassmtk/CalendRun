/* =========================================================
   Page /amis/ : liste, demandes reçues / envoyées, ajout, code ami,
   invitation (?invite=CODE) et profil d'un ami (?u=<id>)
   Les pseudos sont toujours échappés. Les actions sensibles (retirer,
   bloquer) demandent un second clic de confirmation (pas de boîte modale).
   ========================================================= */
import { account } from "../page.js";
import { api, getState, avatar, esc, setPending } from "./core.js";

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const show = (id) => document.querySelectorAll("main > section").forEach((s) => { s.hidden = s.id !== id; });
const status = (msg) => { const s = $("#fr-status"); if (s) s.textContent = msg || ""; };
function showError(id, msg) { const el = $(id); el.textContent = msg || ""; el.hidden = !msg; }

account.then(async () => {
  $("#acct-loading").hidden = true;
  const s = getState();
  const invite = (params.get("invite") || "").toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 10);
  if (!s.user) {
    show("view-out");
    if (invite) $("#out-login").href = "/compte/?suite=" + encodeURIComponent("/amis/?invite=" + invite);
    return;
  }
  if (invite) return showInvite(invite);
  if (params.get("u")) return showProfile(params.get("u"));
  show("view-friends");
  bindList();
  await loadList();
});

/* ---------- invitation ---------- */
function showInvite(code) {
  show("view-invite");
  $("#invite-code").textContent = code;
  $("#invite-go").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    const r = await api("POST", "friends/request", { code });
    if (r.status === 200) { $("#invite-status").textContent = r.data.message + " Redirection vers tes amis…"; setTimeout(() => { location.href = "/amis/"; }, 1500); }
    else { e.currentTarget.disabled = false; showError("#invite-error", r.data?.message || "Erreur : réessaie."); }
  });
}

/* ---------- profil d'un ami ---------- */
let racesP = null;
const loadRaces = () => (racesP ||= fetch("/races.json").then((r) => r.json()).then((list) => Object.fromEntries(list.map((x) => [x.id, x]))).catch(() => ({})));
const DAY = 86400000;
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

async function showProfile(id) {
  show("view-profile");
  const [r, races] = await Promise.all([api("GET", "friends/profile/" + encodeURIComponent(id)), loadRaces()]);
  if (r.status !== 200) {
    $("#pf-pseudo").textContent = "Profil indisponible";
    $("#pf-body").hidden = true;
    showError("#pf-error", "Ce profil n'existe pas, ou cette personne ne partage pas ses courses avec toi.");
    $("#pf-title").focus();
    return;
  }
  const u = r.data.user;
  document.title = `${u.pseudo} — Amis — ${document.title.split(" — ").pop()}`;
  $("#pf-avatar").innerHTML = avatar(u, "avatar--lg");
  $("#pf-pseudo").textContent = u.pseudo;
  const t0 = today();
  const item = (race, withCountdown) => {
    const d = parseDate(race.date);
    const days = Math.round((d - t0) / DAY);
    const cd = withCountdown ? `<span class="race-cd" aria-label="dans ${days} jour${days > 1 ? "s" : ""}">${days === 0 ? "Aujourd'hui" : "J-" + days}</span>` : "";
    return `<li><a href="/?course=${encodeURIComponent(race.id)}">${cd}<span class="race-main"><b>${esc(race.name)}</b><small>${esc(race.dateLong)} · ${esc(race.place)} (${esc(race.dept)})</small></span></a></li>`;
  };
  const upcoming = r.data.races.reg.map((rid) => races[rid]).filter((x) => x && parseDate(x.endDate || x.date) >= t0).sort((a, b) => a.date.localeCompare(b.date));
  const favs = r.data.races.fav.map((rid) => races[rid]).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  $("#pf-reg").innerHTML = upcoming.length ? upcoming.map((x) => item(x, true)).join("") : `<li class="empty">Aucune course à venir pour l'instant.</li>`;
  $("#pf-fav").innerHTML = favs.length ? favs.map((x) => item(x, false)).join("") : `<li class="empty">Aucun favori.</li>`;
  $("#pf-title").focus();
}

/* ---------- liste ---------- */
const ACTIONS = {
  accept: { label: "Accepter", cls: "btn--primary", path: "friends/respond", body: (id) => ({ userId: id, accept: true }), done: "Demande acceptée." },
  refuse: { label: "Refuser", path: "friends/respond", body: (id) => ({ userId: id, accept: false }), done: "Demande refusée." },
  cancel: { label: "Annuler", path: "friends/cancel", done: "Demande annulée." },
  remove: { label: "Retirer", path: "friends/remove", confirm: true, done: "Ami retiré." },
  block: { label: "Bloquer", path: "friends/block", confirm: true, done: "Utilisateur bloqué : il ne voit plus rien de toi et ne peut plus te demander en ami." },
  unblock: { label: "Débloquer", path: "friends/unblock", done: "Utilisateur débloqué." }
};
const btn = (act, u) => `<button type="button" class="btn btn--sm ${ACTIONS[act].cls || "btn--ghost"}" data-act="${act}" data-id="${esc(u.id)}" data-pseudo="${esc(u.pseudo)}" aria-label="${ACTIONS[act].label} ${esc(u.pseudo)}">${ACTIONS[act].label}</button>`;
const person = (u, actions, { link = false, note = "" } = {}) => `<li class="person">
    ${link ? `<a class="person-main" href="/amis/?u=${encodeURIComponent(u.id)}">` : `<span class="person-main">`}${avatar(u)}<span><b>${esc(u.pseudo)}</b>${note ? `<small>${note}</small>` : ""}</span>${link ? "</a>" : "</span>"}
    <span class="person-actions">${actions.map((a) => btn(a, u)).join("")}</span></li>`;
const empty = (t) => `<li class="empty">${t}</li>`;

async function loadList() {
  const r = await api("GET", "friends");
  if (r.status !== 200) { status(r.data?.message || "Impossible de charger tes amis."); return; }
  const d = r.data;
  $("#my-code").textContent = d.friendCode;
  $("#list-in").innerHTML = d.incoming.length ? d.incoming.map((u) => person(u, ["accept", "refuse", "block"])).join("") : empty("Aucune demande en attente.");
  $("#in-count").hidden = !d.incoming.length;
  $("#in-count").textContent = d.incoming.length;
  setPending(d.incoming.length);
  $("#list-friends").innerHTML = d.friends.length
    ? d.friends.map((u) => person(u, ["remove", "block"], { link: u.shares, note: u.shares ? "Voir ses courses →" : "Ne partage pas ses courses" })).join("")
    : empty("Pas encore d'ami ici. Ajoute un pseudo ou envoie ton lien d'invitation.");
  $("#list-out").innerHTML = d.outgoing.length ? d.outgoing.map((u) => person(u, ["cancel"], { note: "En attente" })).join("") : empty("Aucune demande envoyée en attente.");
  $("#box-blocked").hidden = !d.blocked.length;
  $("#list-blocked").innerHTML = d.blocked.map((u) => person(u, ["unblock"])).join("");
}

function bindList() {
  $("#form-add").addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("#add-error");
    const input = $("#add-pseudo");
    const pseudo = input.value.trim();
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(pseudo)) { input.setAttribute("aria-invalid", "true"); input.focus(); return showError("#add-error", "Un pseudo fait 3 à 20 caractères : lettres, chiffres, point, tiret ou tiret bas."); }
    input.setAttribute("aria-invalid", "false");
    const b = e.currentTarget.querySelector("button[type=submit]");
    b.disabled = true;
    const r = await api("POST", "friends/request", { pseudo });
    b.disabled = false;
    if (r.status === 200) { input.value = ""; status(r.data.message); await loadList(); }
    else showError("#add-error", r.data?.message || "Erreur : réessaie.");
  });

  const link = () => `${location.origin}/amis/?invite=${$("#my-code").textContent}`;
  $("#copy-link").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(link()); status("Lien d'invitation copié."); }
    catch { status("Copie impossible : " + link()); }
  });
  if (navigator.share) {
    $("#share-link").hidden = false;
    $("#share-link").addEventListener("click", () => navigator.share({ title: "CalendRun", text: "Ajoute-moi en ami sur CalendRun !", url: link() }).catch(() => {}));
  }
  $("#regen-code").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    if (!b.dataset.confirm) { b.dataset.confirm = "1"; b.textContent = "Confirmer : l'ancien lien ne marchera plus"; setTimeout(() => { delete b.dataset.confirm; b.textContent = "Nouveau code"; }, 4000); return; }
    delete b.dataset.confirm; b.textContent = "Nouveau code";
    const r = await api("POST", "friends/code", {});
    if (r.status === 200) { $("#my-code").textContent = r.data.friendCode; status("Nouveau code ami créé. L'ancien lien ne marche plus."); }
  });

  document.querySelector("#view-friends").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const a = ACTIONS[b.dataset.act];
    if (a.confirm && !b.dataset.confirm) {
      b.dataset.confirm = "1";
      b.textContent = "Confirmer ?";
      b.setAttribute("aria-label", `Confirmer : ${a.label.toLowerCase()} ${b.dataset.pseudo}`);
      setTimeout(() => { if (document.contains(b)) { delete b.dataset.confirm; b.textContent = a.label; b.setAttribute("aria-label", `${a.label} ${b.dataset.pseudo}`); } }, 4000);
      return;
    }
    b.disabled = true;
    const r = await api("POST", a.path, a.body ? a.body(b.dataset.id) : { userId: b.dataset.id });
    status(r.status === 200 ? a.done : (r.data?.message || "Erreur : réessaie."));
    await loadList();
    $("#fr-status").focus?.();
  });
}
