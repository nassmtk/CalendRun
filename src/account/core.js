/* =========================================================
   Comptes — noyau navigateur (toutes les pages)
   - aucun appel d'API tant que le cookie indicateur cr_auth est absent :
     un visiteur sans compte ne déclenche jamais de requête
   - connecté : un seul GET /api/me (profil, favoris, inscriptions, CSRF,
     demandes d'ami), puis les changements sont envoyés par lots
   - première connexion sur un appareil : le localStorage est fusionné dans le
     compte (union, sans doublon) ; ensuite le compte fait foi
   - déconnexion : la copie locale est vidée (appareil partagé) ; tout reste
     dans le compte
   ========================================================= */
export const ACCOUNTS = typeof __ACCOUNTS_ENABLED__ !== "undefined" ? __ACCOUNTS_ENABLED__ : false;
const LS_ACCT = "calendrun:acct"; // { id, pseudo } du compte dont l'appareil est le miroir

export const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const signedInHint = () => /(?:^|;\s*)cr_auth=1(?:;|$)/.test(document.cookie);
const readAcct = () => { try { return JSON.parse(localStorage.getItem(LS_ACCT)) || null; } catch { return null; } };
const writeAcct = (v) => { try { v ? localStorage.setItem(LS_ACCT, JSON.stringify(v)) : localStorage.removeItem(LS_ACCT); } catch {} };

/* ---------- avatar : initiales sur une couleur tirée de l'identifiant ---------- */
export function hueOf(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; }
export const initials = (pseudo) => String(pseudo).replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "?";
export const avatar = (u, cls = "") => `<span class="avatar ${cls}" style="--h:${hueOf(u.id || u.pseudo)}" aria-hidden="true">${esc(initials(u.pseudo))}</span>`;

/* ---------- API ---------- */
let csrf = null;
export async function api(method, path, body) {
  const headers = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (csrf && method !== "GET") headers["x-csrf-token"] = csrf;
  let res;
  try {
    res = await fetch("/api/" + path, { method, headers, credentials: "same-origin", body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { status: 0, data: { ok: false, message: "Connexion impossible : vérifie ton réseau et réessaie." } };
  }
  let data = null;
  try { data = await res.json(); } catch { data = { ok: false, message: "Réponse inattendue du serveur." }; }
  // 401 hors connexion / récupération = session perdue
  if (res.status === 401 && !path.startsWith("auth/")) signedOut();
  return { status: res.status, data };
}

/* ---------- état ---------- */
const listeners = new Set();
let state = { ready: false, user: null, pendingRequests: 0 };
export const getState = () => state;
export function onChange(fn) { listeners.add(fn); if (state.ready) fn(state); return () => listeners.delete(fn); }
function set(patch) { state = { ...state, ...patch, ready: true }; listeners.forEach((f) => { try { f(state); } catch (e) { console.error("[compte]", e); } }); }

/** session perdue (expirée, fermée ailleurs) : on vide le miroir local */
function signedOut() {
  if (readAcct()) clearLocalLists();
  writeAcct(null);
  csrf = null;
  set({ user: null, pendingRequests: 0 });
}
function clearLocalLists() {
  const A = window.CALENDRUN;
  if (A?.replaceLists) A.replaceLists({ fav: [], reg: [] });
  else { try { localStorage.removeItem("calendrun:favs"); localStorage.removeItem("calendrun:v1:registered"); } catch {} }
}

/* ---------- synchronisation des favoris / inscriptions (page d'accueil) ---------- */
let queue = new Map(), flushT = null;
function enqueue(kind, id, on) {
  if (!state.user) return;
  queue.set(kind + ":" + id, { id, kind, on });
  clearTimeout(flushT);
  flushT = setTimeout(flush, 500); // les clics rapprochés partent ensemble
}
async function flush(keepalive = false) {
  if (!queue.size || !state.user) return;
  const ops = [...queue.values()];
  queue = new Map();
  if (keepalive) {
    // fermeture de l'onglet : envoi garanti, sans attendre la réponse
    fetch("/api/me/races", { method: "POST", keepalive: true, credentials: "same-origin", headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: JSON.stringify({ ops }) }).catch(() => {});
    return;
  }
  const r = await api("POST", "me/races", { ops });
  if (r.status !== 200 && r.status !== 401) ops.forEach((o) => queue.has(o.kind + ":" + o.id) || queue.set(o.kind + ":" + o.id, o)); // nouvel essai au prochain changement
}

function attachLists(me) {
  const A = window.CALENDRUN;
  if (!A?.replaceLists) return;
  const acct = readAcct();
  const apply = (races) => A.replaceLists({ fav: races.fav, reg: races.reg });
  if (!acct || acct.id !== me.user.id) {
    // premier passage de ce compte sur cet appareil : union localStorage + compte
    const local = A.getLists();
    if (local.fav.length || local.reg.length) {
      api("POST", "me/races/merge", { fav: local.fav, reg: local.reg }).then((r) => { if (r.status === 200) apply(r.data.races); });
    } else apply(me.races);
  } else apply(me.races);
  writeAcct({ id: me.user.id, pseudo: me.user.pseudo });
  if (!A.__acctHooks) {
    A.__acctHooks = true;
    A.hooks.fav.push((id, on) => enqueue("fav", id, on));
    A.hooks.registered.push((id, on) => enqueue("reg", id, on));
    addEventListener("pagehide", () => flush(true));
  }
}

/* ---------- démarrage ---------- */
export async function loadMe() {
  if (!ACCOUNTS || !signedInHint()) {
    // cookie absent mais miroir présent : la session a expiré → on vide la copie locale
    if (readAcct()) signedOut(); else set({ user: null });
    return null;
  }
  const r = await api("GET", "me");
  if (r.status !== 200) { if (r.status === 401) signedOut(); else set({ user: null, error: true }); return null; }
  csrf = r.data.csrf;
  set({ user: r.data.user, pendingRequests: r.data.pendingRequests });
  attachLists(r.data);
  return r.data;
}
export const setPending = (n) => set({ pendingRequests: n });
export const setCsrf = (t) => { csrf = t; };

export async function logout(all = false) {
  await flush();
  await api("POST", all ? "auth/logout-all" : "auth/logout", {});
  clearLocalLists();
  writeAcct(null);
  location.href = "/";
}

/* ---------- barre du haut ---------- */
const ICON_USER = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>`;
const ICON_FRIENDS = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.4-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/><circle cx="17" cy="9" r="2.8"/><path d="M16.5 14.6c2.6.2 4.3 1.9 5 5"/></svg>`;
const ICON_OUT = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"/></svg>`;
const ICON_GEAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
const badge = (n) => (n ? `<span class="badge on" aria-label="${n} demande${n > 1 ? "s" : ""} d'ami en attente">${n}</span>` : "");

function renderNav(s) {
  // barre du haut (ordinateur, et pages secondaires)
  document.querySelectorAll("[data-account-slot]").forEach((slot) => {
    if (!s.user) {
      slot.innerHTML = `<a class="nav-account nav-account--in" href="/compte/">${ICON_USER}<span class="lbl">Connexion</span></a>`;
      return;
    }
    const n = s.pendingRequests;
    slot.innerHTML = `<button type="button" class="nav-account nav-account--user" aria-expanded="false" aria-controls="acct-pop" aria-label="Mon compte : ${esc(s.user.pseudo)}${n ? ` — ${n} demande${n > 1 ? "s" : ""} d'ami` : ""}">
        ${avatar(s.user)}${n ? `<span class="dot" aria-hidden="true">${n}</span>` : ""}</button>
      <div class="acct-pop" id="acct-pop" hidden>
        <p class="acct-pop-head">${avatar(s.user, "avatar--sm")}<b>${esc(s.user.pseudo)}</b></p>
        <a href="/compte/">${ICON_GEAR}<span>Mon compte</span></a>
        <a href="/amis/">${ICON_FRIENDS}<span>Amis</span>${badge(n)}</a>
        <button type="button" data-logout>${ICON_OUT}<span>Déconnexion</span></button>
      </div>`;
  });
  // menu compact (mobile)
  const m = document.getElementById("menu-account");
  if (m) {
    m.innerHTML = s.user
      ? `<p class="menu-user">${avatar(s.user)}<b>${esc(s.user.pseudo)}</b></p>
        <a class="menu-row" href="/amis/">${ICON_FRIENDS}<span>Amis</span>${badge(s.pendingRequests)}</a>
        <a class="menu-row" href="/compte/">${ICON_GEAR}<span>Mon compte</span></a>
        <button type="button" class="menu-row" data-logout>${ICON_OUT}<span>Déconnexion</span></button><div class="menu-sep"></div>`
      : `<a class="menu-row menu-row--cta" href="/compte/">${ICON_USER}<span>Connexion / créer un compte</span></a><div class="menu-sep"></div>`;
  }
  const mb = document.getElementById("menu-badge");
  if (mb) { mb.hidden = !(s.user && s.pendingRequests); mb.textContent = s.pendingRequests || ""; }
}

function initNavEvents() {
  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!t) return;
    if (t.closest("[data-logout]")) { e.preventDefault(); logout(); return; }
    const btn = t.closest(".nav-account--user");
    const open = document.querySelector(".acct-pop:not([hidden])");
    if (btn) {
      const pop = btn.nextElementSibling;
      const on = pop.hidden;
      pop.hidden = !on;
      btn.setAttribute("aria-expanded", String(on));
      if (on) pop.querySelector("a")?.focus();
      return;
    }
    if (open && !open.contains(t)) { open.hidden = true; open.previousElementSibling?.setAttribute("aria-expanded", "false"); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = document.querySelector(".acct-pop:not([hidden])");
    if (open) { open.hidden = true; const b = open.previousElementSibling; b?.setAttribute("aria-expanded", "false"); b?.focus(); }
  });
}

export function initAccount() {
  if (!ACCOUNTS) return Promise.resolve(null);
  // pseudo mémorisé : la barre affiche tout de suite l'avatar (pas de saut de mise en page)
  const acct = readAcct();
  if (acct && signedInHint()) renderNav({ user: acct, pendingRequests: 0 }); else renderNav({ user: null });
  onChange(renderNav);
  initNavEvents();
  return loadMe();
}
