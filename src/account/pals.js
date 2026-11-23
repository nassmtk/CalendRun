/* =========================================================
   « Mes potes » sur l'accueil (chargé seulement si connecté)
   - UN seul appel : GET /api/friends/activity (déjà filtré côté serveur :
     amis acceptés, non bloqués, visibilité « Mes amis »)
   - avatars empilés sur les cartes et dans la fiche :
     « 2 potes inscrits · 1 en favori » ; au clic, la liste des amis concernés
   - filtre « Courses de mes potes »
   ========================================================= */
import { api, avatar, esc } from "./core.js";

const MAX_FACES = 3;

export async function initPals(A) {
  const r = await api("GET", "friends/activity");
  if (r.status !== 200 || !r.data.friends.length) return;
  const friends = Object.fromEntries(r.data.friends.map((f) => [f.id, f]));
  const races = r.data.races;

  /* ---------- pastille ---------- */
  function palsHTML(raceId, cls = "") {
    const e = races[raceId];
    if (!e) return "";
    const reg = e.reg.filter((id) => friends[id]), fav = e.fav.filter((id) => friends[id] && !e.reg.includes(id));
    const people = [...reg, ...fav];
    if (!people.length) return "";
    const parts = [];
    if (reg.length) parts.push(`${reg.length} pote${reg.length > 1 ? "s" : ""} inscrit${reg.length > 1 ? "s" : ""}`);
    if (fav.length) parts.push(`${fav.length} en favori`);
    const faces = people.slice(0, MAX_FACES).map((id) => avatar(friends[id], "avatar--sm")).join("");
    const more = people.length > MAX_FACES ? `<span class="pals-more">+${people.length - MAX_FACES}</span>` : "";
    return `<button type="button" class="pals ${cls}" data-pals="${esc(raceId)}" aria-haspopup="dialog" aria-label="${parts.join(", ")} : voir qui">
      <span class="pals-faces">${faces}${more}</span><span class="pals-txt">${parts.join(" · ")}</span></button>`;
  }

  function decorate(root = document) {
    root.querySelectorAll(".card[data-id]").forEach((card) => {
      if (card.querySelector(".pals") || !races[card.dataset.id]) return;
      const html = palsHTML(card.dataset.id);
      if (html) card.querySelector(".card-body")?.insertAdjacentHTML("beforeend", html);
    });
    const sheet = document.getElementById("sheet");
    const meta = sheet?.querySelector(".sheet-meta");
    const fav = sheet?.querySelector("[data-fav]");
    if (meta && fav && !sheet.querySelector(".pals")) {
      const html = palsHTML(fav.dataset.fav, "pals--sheet");
      if (html) meta.insertAdjacentHTML("afterend", html);
    }
  }
  decorate();
  const mo = new MutationObserver(() => decorate());
  ["results", "sheet"].forEach((id) => { const el = document.getElementById(id); if (el) mo.observe(el, { childList: true, subtree: true }); });

  /* ---------- liste des amis concernés ---------- */
  const pop = document.createElement("div");
  pop.className = "pals-pop";
  pop.id = "pals-pop";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "Tes potes sur cette course");
  pop.hidden = true;
  document.body.append(pop);
  let opener = null;
  const close = () => { if (pop.hidden) return; pop.hidden = true; opener?.setAttribute("aria-expanded", "false"); opener?.focus({ preventScroll: true }); opener = null; };

  document.addEventListener("click", (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const b = t?.closest("[data-pals]");
    if (b) {
      e.stopPropagation(); e.preventDefault(); // ne pas ouvrir la fiche de la carte
      if (opener === b) return close();
      const ev = races[b.dataset.pals];
      const row = (id, what) => `<li><a href="/amis/?u=${encodeURIComponent(id)}">${avatar(friends[id], "avatar--sm")}<span>${esc(friends[id].pseudo)}</span><em>${what}</em></a></li>`;
      pop.innerHTML = `<p class="pals-pop-title">Tes potes sur cette course</p><ul>
        ${ev.reg.filter((id) => friends[id]).map((id) => row(id, "inscrit")).join("")}
        ${ev.fav.filter((id) => friends[id] && !ev.reg.includes(id)).map((id) => row(id, "en favori")).join("")}</ul>`;
      pop.hidden = false;
      const rc = b.getBoundingClientRect();
      const w = Math.min(280, innerWidth - 24);
      pop.style.width = w + "px";
      pop.style.left = Math.max(12, Math.min(rc.left, innerWidth - w - 12)) + "px";
      const below = rc.bottom + 8 + pop.offsetHeight < innerHeight;
      pop.style.top = (below ? rc.bottom + 8 : Math.max(12, rc.top - 8 - pop.offsetHeight)) + "px";
      opener?.setAttribute("aria-expanded", "false");
      opener = b; b.setAttribute("aria-expanded", "true");
      pop.querySelector("a")?.focus({ preventScroll: true });
      return;
    }
    if (!pop.hidden && !pop.contains(t)) close();
  }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pop.hidden) { e.stopPropagation(); close(); } }, true);
  // défilement franc = on ferme (un petit glissé résiduel ne ferme pas)
  let y0 = 0;
  new MutationObserver(() => { if (!pop.hidden) y0 = scrollY; }).observe(pop, { attributes: true, attributeFilter: ["hidden"] });
  addEventListener("scroll", () => { if (!pop.hidden && Math.abs(scrollY - y0) > 60) close(); }, { passive: true });

  /* ---------- filtre « Courses de mes potes » ---------- */
  const toggles = document.querySelector("#toolbar .toggles");
  if (toggles && !document.getElementById("f-pals")) {
    toggles.insertAdjacentHTML("afterbegin", `<label class="switch switch--pals"><input type="checkbox" id="f-pals" /><span class="switch-ui"></span>Courses de mes potes</label>`);
    const input = document.getElementById("f-pals");
    const filter = { test: (r) => !!races[r.id], clear: () => { input.checked = false; } };
    input.addEventListener("change", () => A.setExtraFilter(input.checked ? filter : null));
  }
}
