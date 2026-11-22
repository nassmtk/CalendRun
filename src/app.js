/* =========================================================
   CALENDRUN — app
   ========================================================= */
(() => {
  "use strict";

  const RACES = (window.RACES || []).slice();
  const CFG = window.SITE_CONFIG || {};
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- dates ---------- */
  const DAY = 86400000;
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const parse = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => startOfDay(new Date());
  const daysUntil = (d) => Math.round((startOfDay(d) - today()) / DAY);
  const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  const fmtLong = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtShort = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const inDays = (n) => (n === 0 ? "aujourd'hui" : n === 1 ? "demain" : `dans ${n} j`);

  /* ---------- helpers ---------- */
  const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const fmtKm = (km) => (Number.isInteger(km) ? String(km) : Math.abs(km - 42.195) < 0.01 ? "42,195" : km.toFixed(1).replace(".", ",")) + " km";
  const store = {
    get(k, def) { try { return JSON.parse(localStorage.getItem("calendrun:" + k)) ?? def; } catch { return def; } },
    set(k, v) { try { localStorage.setItem("calendrun:" + k, JSON.stringify(v)); } catch {} }
  };

  /* ---------- calendrier compact → fiches ---------- */
  const CITIES = window.CITIES || {};
  const TYPE_LABEL = { route: "Route", trail: "Trail", urban: "Urban trail", cross: "Cross", backyard: "Backyard & ultra", relais: "Relais" };
  const ids = new Set(RACES.map((r) => r.id));
  (window.RACES_COMPACT || []).forEach(([date, end, name, place, type, dists, slug, opt = {}]) => {
    if (ids.has(slug)) return;
    ids.add(slug);
    const c = CITIES[place] || ["", 48.8566, 2.3522];
    const isParis = place.startsWith("Paris ");
    const [city, arr] = isParis ? ["Paris", place.slice(6)] : [place, ""];
    // léger décalage déterministe pour que les courses d'une même ville ne se superposent pas
    let h = 0; for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const jit = (n) => (((h >> n) & 255) / 255 - 0.5) * 0.012;
    RACES.push({
      id: slug, name, sponsor: "", date, endDate: end || undefined, dateStatus: opt.dateStatus || "listed",
      city, arr, dept: c[0], lat: c[1] + jit(0), lng: c[2] + jit(8), type,
      distances: dists.map((d) => (typeof d === "number" ? { label: fmtKm(d), km: d } : { label: d, km: null })),
      registration: { status: opt.status || "check", note: opt.note, url: opt.url, info: "https://running.life/en/event/" + slug },
      website: "", tagline: "", tags: opt.note ? [opt.note] : [], compact: true
    });
  });

  RACES.forEach((r) => {
    r._date = parse(r.date);
    r._end = parse(r.endDate) || r._date;
    const kms = r.distances.map((d) => d.km).filter((k) => k != null);
    r._search = norm([r.name, r.sponsor, r.city, r.arr, r.dept, r.type, TYPE_LABEL[r.type], ...(r.tags || []), ...r.distances.map((d) => d.label)].join(" "));
    r._maxKm = kms.length ? Math.max(...kms) : 0;
    r._minKm = kms.length ? Math.min(...kms) : 0;
    r._maxDplus = Math.max(0, ...r.distances.map((d) => d.dplus || 0));
    r._hasElev = r.distances.some((d) => d.dplus != null);
    r._distLabel = r.distances.length ? r.distances.map((d) => (d.km != null ? fmtKm(d.km) : d.label)).slice(0, 4).join(" / ") : "Formats à venir";
  });
  RACES.sort((a, b) => a._date - b._date);

  /* ---------- categories ---------- */
  const CATS = [
    { id: "short", label: "≤ 10 km" },
    { id: "mid", label: "15–20 km" },
    { id: "semi", label: "Semi" },
    { id: "marathon", label: "Marathon" },
    { id: "trail", label: "Trail & cross" },
    { id: "urban", label: "Urban trail" },
    { id: "ultra", label: "Ultra & backyard" },
    { id: "relais", label: "Relais" }
  ];
  const catOf = (race, d) => {
    if (race.type === "relais") return "relais";
    if (race.type === "backyard" || (d.km != null && d.km > 42.5)) return "ultra";
    if (race.type === "trail" || race.type === "cross") return "trail";
    if (race.type === "urban") return "urban";
    if (d.km == null) return "short";
    if (d.km <= 10.5) return "short";
    if (d.km < 21) return "mid";
    if (d.km <= 21.3) return "semi";
    if (d.km <= 42.5) return "marathon";
    return "trail";
  };
  const raceCats = (r) => new Set(r.distances.length ? r.distances.map((d) => catOf(r, d)) : [r.type === "trail" ? "trail" : r.type === "urban" ? "urban" : "short"]);
  const DEPTS = { "75": "Paris", "77": "Seine-et-Marne", "78": "Yvelines", "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-St-Denis", "94": "Val-de-Marne", "95": "Val-d'Oise" };

  /* ---------- registration state ---------- */
  function regInfo(r) {
    const reg = r.registration || {};
    const t = today();
    const opens = parse(reg.opens), closes = parse(reg.closes);
    const hasUrl = !!reg.url;
    if (r._end < t) return { key: "past", label: "Course terminée", sub: "Rendez-vous en 2028", can: false };
    if (reg.status === "closed") return { key: "closed", label: "Inscriptions closes", sub: CFG.ALERTS_ENABLED ? "Inscris-toi à l'alerte pour la prochaine édition" : "Plus de dossard pour cette édition", can: false };
    if (opens && t < opens) {
      const n = daysUntil(opens);
      return { key: "soon", label: `Ouverture ${inDays(n)}`, sub: `Le ${fmtShort(opens)} ${opens.getFullYear()}`, can: false, opens, closes };
    }
    if (closes && t > closes) {
      return {
        key: "closed",
        label: reg.status === "lottery" ? "Tirage au sort clos" : "Inscriptions closes",
        sub: `Depuis le ${fmtShort(closes)} — dossards solidaires possibles`,
        can: false, opens, closes
      };
    }
    if (reg.status === "open") {
      const sub = closes ? `Clôture ${inDays(daysUntil(closes))} · ${fmtShort(closes)}` : (reg.price ? `À partir de ${reg.price}` : "Places limitées");
      return { key: "open", label: "Inscriptions ouvertes", sub, can: hasUrl, opens, closes };
    }
    if (reg.status === "lottery") {
      const sub = closes ? `Jusqu'au ${fmtShort(closes)}` : "Candidature sur le site officiel";
      return { key: "lottery", label: "Tirage au sort", sub, can: hasUrl, opens, closes };
    }
    if (reg.status === "soon") return { key: "soon", label: "Ouverture bientôt", sub: reg.preUrl ? "Pré-inscription chez l'organisateur" : CFG.ALERTS_ENABLED ? "Sois prévenu·e dès l'ouverture" : "Surveille le site de l'organisateur", can: false };
    if (reg.status === "check") return { key: "check", label: reg.url ? "Inscriptions en ligne" : "Inscription chez l'orga", sub: "Tarifs & dossards sur la page de la course", can: !!reg.url };
    return { key: "unknown", label: "Infos à venir", sub: "L'orga n'a pas encore communiqué", can: false };
  }

  /* ---------- liens : chaque course a toujours au moins un lien ---------- */
  function linksFor(r) {
    const reg = r.registration || {}, info = regInfo(r), out = [];
    const add = (href, label, kind) => href && !out.some((l) => l.href === href) && out.push({ href, label, kind });
    if (info.can && reg.url) add(reg.url, info.key === "lottery" ? "Tenter le tirage" : "S'inscrire", "register");
    if (reg.preUrl && info.key !== "past") add(reg.preUrl, info.key === "closed" ? "Dossards solidaires" : "Pré-inscription", "prereg");
    if (reg.info) add(reg.info, out.length ? "Fiche de la course" : "Infos & inscription", "info");
    if (reg.url && !info.can) add(reg.url, "Site d'inscription", "info");
    if (r.website) add(r.website, "Site officiel", "site");
    if (!out.length) add(`https://www.google.com/search?q=${encodeURIComponent(r.name + " " + r.city + " 2027 inscription")}`, "Trouver l'inscription", "search");
    return out;
  }

  const DATE_BADGE = {
    confirmed: { cls: "ok", label: "Date officielle" },
    listed: { cls: "listed", label: "Date annoncée" },
    estimated: { cls: "est", label: "Date estimée" }
  };

  function terrain(r) {
    if (!r._hasElev) {
      const T = { route: [1, "Route"], urban: [3, "Urbain"], trail: [3, "Nature"], cross: [3, "Cross"], backyard: [5, "Endurance"], relais: [2, "Relais"] }[r.type] || [1, "Route"];
      return { lvl: T[0], label: T[1] };
    }
    const ratio = Math.max(...r.distances.filter((d) => d.km).map((d) => (d.dplus || 0) / d.km));
    if (ratio < 6) return { lvl: 1, label: "Plat" };
    if (ratio < 12) return { lvl: 2, label: "Roulant" };
    if (ratio < 20) return { lvl: 3, label: "Vallonné" };
    if (ratio < 35) return { lvl: 4, label: "Costaud" };
    return { lvl: 5, label: "Montagne" };
  }

  /* ---------- state ---------- */
  const state = {
    q: "", cats: new Set(), depts: new Set(), month: null,
    open: false, confirmed: false, sort: "date", view: "grid", list: "all" // list : all | favs | registered
  };
  let favs = new Set(store.get("favs", []));
  let registered = new Set(store.get("v1:registered", [])); // clé versionnée : calendrun:v1:registered
  let alerts = store.get("alerts", {});

  function matches(r, ignore) {
    if (state.q && !norm(state.q).split(/\s+/).every((w) => r._search.includes(w))) return false;
    if (state.cats.size && ![...raceCats(r)].some((c) => state.cats.has(c))) return false;
    if (ignore !== "dept" && state.depts.size && !state.depts.has(r.dept)) return false;
    if (ignore !== "month" && state.month !== null && r._date.getMonth() !== state.month) return false;
    if (state.open && !["open", "lottery"].includes(regInfo(r).key)) return false;
    if (state.confirmed && r.dateStatus !== "confirmed") return false;
    return inScope(r);
  }
  /* périmètre : Favoris / Inscrites ont leur propre ensemble, indépendant des filtres */
  function inScope(r) {
    if (state.list === "favs") return favs.has(r.id);
    if (state.list === "registered") return registered.has(r.id);
    return true;
  }
  function filtered() {
    const list = RACES.filter((r) => matches(r));
    const s = state.list === "all" ? state.sort : "date"; // Favoris / Inscrites : toujours par date
    if (s === "dist-asc") list.sort((a, b) => a._minKm - b._minKm);
    else if (s === "dist-desc") list.sort((a, b) => b._maxKm - a._maxKm);
    else if (s === "dplus") list.sort((a, b) => b._maxDplus - a._maxDplus);
    return list;
  }
  const isFiltered = () => !!(state.q || state.cats.size || state.depts.size || state.month !== null || state.open || state.confirmed);

  /* ---------- filtres : un jeu pour la liste principale, un jeu local pour Favoris / Inscrites ---------- */
  const blankFilters = () => ({ q: "", cats: new Set(), depts: new Set(), month: null, open: false, confirmed: false, sort: "date" });
  const snapshot = () => ({ q: state.q, cats: new Set(state.cats), depts: new Set(state.depts), month: state.month, open: state.open, confirmed: state.confirmed, sort: state.sort });
  let savedMain = null; // filtres de la liste principale, mis de côté pendant Favoris / Inscrites
  function syncControls() {
    $("#q").value = state.q;
    $("#f-open").checked = state.open;
    $("#f-confirmed").checked = state.confirmed;
    $("#f-sort").value = state.sort;
    $("#f-sort").disabled = state.list !== "all";
  }
  function setList(l) {
    if (l === state.list) return;
    if (l === "all") {
      Object.assign(state, savedMain || blankFilters()); // restaure la liste principale telle quelle
      savedMain = null;
    } else {
      if (state.list === "all") savedMain = snapshot();
      Object.assign(state, blankFilters()); // filtres locaux : repartent de zéro à chaque entrée
    }
    state.list = l;
    syncControls();
  }
  const activeFilterCount = () => state.cats.size + state.depts.size + (state.month !== null) + state.open + state.confirmed + (state.q ? 1 : 0);

  /* ---------- icons ---------- */
  const I = {
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-9.2-9.4C1.6 7.2 3.9 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.3 0 5.6 3.2 4.4 6.6C19.5 15.4 12 20 12 20z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 20a2 2 0 0 0 3.4 0"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>',
    cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    checkCircle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
    euro: '<svg viewBox="0 0 24 24"><path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/></svg>'
  };
  const ARROW = `<span class="arrow" aria-hidden="true">${I.arrow}${I.arrow}</span>`;

  /* ---------- rendering: shared bits ---------- */
  const dateBlock = (r) => {
    const multi = r.endDate && r.endDate !== r.date;
    return `<div class="date-block" data-vt="date">
      <span class="m">${MONTHS[r._date.getMonth()].replace(".", "")}</span>
      <span class="d">${r._date.getDate()}${multi ? `<small>–${r._end.getDate()}</small>` : ""}</span>
      <span class="w">${WEEKDAYS[r._date.getDay()]}</span>
    </div>`;
  };
  const placeLine = (r) => `<div class="place">${I.pin}<span>${esc(r.city)}${r.arr ? " " + esc(r.arr) : ""}</span><span class="dept">${esc(r.dept)}</span></div>`;
  const elevVal = (v, approx) => (v == null ? "—" : `${approx ? "~" : ""}${v} m`);

  const ALERTS = !!CFG.ALERTS_ENABLED; // false → cloche et formulaire masqués (aucun faux formulaire)
  const isReg = (r) => registered.has(r.id);
  function regToggle(r, variant = "") {
    const on = isReg(r);
    const label = on ? "Inscrit" : "Je suis inscrit";
    return `<button class="reg-toggle ${variant} ${on ? "on" : ""}" data-reg="${r.id}" aria-pressed="${on}" aria-label="${on ? "Inscrit — annuler" : "Je suis inscrit"} : ${esc(r.name)}" title="${on ? "Tu es inscrit·e — cliquer pour annuler" : "Marquer comme inscrit·e"}">${I.checkCircle}<span>${label}</span></button>`;
  }
  function ctaFor(r, info, cls = "") {
    const l = linksFor(r)[0];
    const on = !!alerts[r.id];
    const bell = isReg(r) || !ALERTS ? "" : `<button class="btn btn--icon btn--bell ${on ? "subscribed" : ""}" data-alert="${r.id}" aria-label="${on ? "Alerte active" : "Me prévenir par email"}" title="${on ? "Alerte active" : "Me prévenir par email"}">${on ? I.check : I.bell}</button>`;
    const strong = l.kind === "register" || l.kind === "prereg";
    const SHORT = { register: l.label, prereg: "Pré-inscription", info: "Infos", site: "Site", search: "Chercher" };
    return `<div class="cta-row">${regToggle(r, "compact")}${bell}<a class="btn ${strong ? "btn--primary" : "btn--ghost"} magnetic ${cls}" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer" data-stop aria-label="${esc(l.label)} — ${esc(r.name)}">${esc(SHORT[l.kind] || l.label)} ${ARROW}</a></div>`;
  }

  const CAT_VAR = { route: "--cat-route", trail: "--cat-trail", cross: "--cat-trail", urban: "--cat-urban", backyard: "--cat-ultra", relais: "--cat-relais" };
  const typeLabel = (r) => TYPE_LABEL[r.type] || "Route";

  function card(r, i) {
    const info = regInfo(r);
    const main = r.distances[0] || {};
    const t = terrain(r);
    const shown = r.distances.slice(0, 4);
    const extra = r.distances.length - shown.length;
    const badge = DATE_BADGE[r.dateStatus] || DATE_BADGE.listed;
    const facts = r._hasElev
      ? `<div class="up"><small>D+</small><b class="${main.dplus == null ? "is-empty" : ""}">${elevVal(main.dplus, main.elevApprox)}</b></div>
         <div class="down"><small>D−</small><b class="${main.dminus == null ? "is-empty" : ""}">${elevVal(main.dminus, main.elevApprox)}</b></div>`
      : `<div><small>Type</small><b class="ty">${esc(typeLabel(r))}</b></div>
         <div><small>Formats</small><b>${r.distances.length || "—"}</b></div>`;
    return `<div class="card-wrap" data-flip-id="${r.id}"><article class="card ${isReg(r) ? "is-registered" : ""}" data-id="${r.id}" data-type="${r.type}" tabindex="0" aria-label="${esc(r.name)}, ${fmtLong(r._date)}">
      <div class="card-glare" aria-hidden="true"></div>
      <div class="card-rim" aria-hidden="true"></div>
      <div class="card-top">
        ${dateBlock(r)}
        <div class="card-title">
          <div class="sponsor">${esc(r.sponsor || r.edition || typeLabel(r))}</div>
          <h3 data-vt="title">${esc(r.name)}</h3>
          ${placeLine(r)}
        </div>
        <button class="fav" data-fav="${r.id}" aria-pressed="${favs.has(r.id)}" aria-label="Ajouter aux favoris">${I.heart}</button>
      </div>
      <div class="card-body">
        <div class="dists">${shown.length ? shown.map((d) => `<span class="dist">${esc(d.km != null ? fmtKm(d.km) : d.label)}</span>`).join("") : `<span class="dist more">Formats à venir</span>`}${extra > 0 ? `<span class="dist more">+${extra}</span>` : ""}</div>
        <div class="elev">
          ${facts}
          <div><small>Profil</small><span class="terrain-label">${t.label}</span><div class="terrain">${[1, 2, 3, 4, 5].map((n) => `<i class="${n <= t.lvl ? "on" : ""}"></i>`).join("")}</div></div>
        </div>
        <div class="badges"><span class="date-badge ${badge.cls}">${badge.label}</span>${isReg(r) ? `<span class="reg-badge">${I.check}Inscrit</span>` : ""}</div>
      </div>
      <div class="card-foot">
        <div class="status">
          <span class="status-pill ${info.key}">${esc(info.label)}</span>
          <span class="status-sub">${esc(info.sub)}</span>
        </div>
        ${ctaFor(r, info)}
      </div>
    </article></div>`;
  }

  /* ---------- hero + next-up ---------- */
  function renderHero() {
    const upcoming = RACES.filter((r) => r._end >= today());
    const openCount = RACES.filter((r) => ["open", "lottery"].includes(regInfo(r).key)).length;
    const nDist = RACES.reduce((n, r) => n + r.distances.length, 0);
    const km = Math.round(RACES.reduce((n, r) => n + r.distances.reduce((a, d) => a + d.km, 0), 0));
    const fr = (n) => n.toLocaleString("fr-FR");
    const stat = (n, label, unit = "", key = false) =>
      `<div class="stat${key ? " stat--key" : ""}"><b class="num"><span data-count="${n}">${fr(n)}</span>${unit ? `<small>${unit}</small>` : ""}</b><span>${label}</span></div>`;
    $("#hero-stats").innerHTML =
      stat(upcoming.length, "courses en 2027") +
      stat(nDist, "formats au départ") +
      stat(km, "de bitume et de sentiers", "km") +
      stat(openCount, "inscriptions ouvertes");

    const next = upcoming[0];
    if (!next) { $("#next-up").hidden = true; return; }
    $("#next-up").innerHTML = `
      <div class="next-card" data-id="${next.id}" role="button" tabindex="0" aria-label="Voir ${esc(next.name)}">
        <div class="next-icon"><div><b>${next._date.getDate()}</b>${MONTHS[next._date.getMonth()]}</div></div>
        <div>
          <div class="next-label">Prochain départ</div>
          <div class="next-name">${esc(next.name)}</div>
          <div class="next-meta">${esc(next.city)} · ${esc(next._distLabel)} · ${esc(regInfo(next).label)}</div>
        </div>
        <div class="countdown" id="countdown" aria-hidden="true"></div>
      </div>`;
    $("#next-mini").dataset.id = next.id;
    $("#next-mini").innerHTML = `<span class="label">Prochain départ</span><b>${esc(next.name)}</b><span class="mini-cd" id="mini-cd"></span>`;
    // le compte à rebours (affichage animé) est géré par la couche motion via le hook afterHero
    next._startAt = next._date.getTime() + 9 * 3600000; // départ ~9h
    window.CALENDRUN.heroNext = next;
    run("afterHero", next);
  }

  /* ---------- filters UI ---------- */
  function renderFilters() {
    const base = RACES.filter((r) => matches(r, "month"));
    // distance chips
    $("#f-dist").innerHTML = `<button class="chip" data-cat="" aria-pressed="${state.cats.size === 0}">Toutes</button>` +
      CATS.map((c) => {
        const n = RACES.filter((r) => raceCats(r).has(c.id)).length;
        return n ? `<button class="chip" data-cat="${c.id}" aria-pressed="${state.cats.has(c.id)}">${c.label} <span class="n">${n}</span></button>` : "";
      }).join("");
    // months
    const counts = Array(12).fill(0);
    base.forEach((r) => counts[r._date.getMonth()]++);
    const max = Math.max(1, ...counts);
    $("#f-month").innerHTML = MONTHS.map((m, i) =>
      `<button class="month" data-month="${i}" aria-pressed="${state.month === i}" ${counts[i] ? "" : "disabled"} aria-label="${MONTHS_LONG[i]} : ${counts[i]} course(s)">
        ${m.replace(".", "")}<span class="mc">${counts[i] || "·"}</span><span class="bar" style="--w:${(counts[i] / max).toFixed(3)}"></span>
      </button>`).join("");
    // départements → barre du haut (segmented control + liste déroulante / tiroir)
    const present = [...new Set(RACES.map((r) => r.dept))].sort();
    const chips = present.map((d) => {
      const n = RACES.filter((r) => matches(r, "dept") && r.dept === d).length;
      return `<button class="dchip" data-dept="${d}" aria-pressed="${state.depts.has(d)}" title="${DEPTS[d] || d}" aria-label="${DEPTS[d] || d} (${d}) : ${n} course${n > 1 ? "s" : ""}">${d === "75" ? "Paris" : d}<span class="n">${n}</span></button>`;
    }).join("");
    const clear = `<button class="dchip-clear" data-dept-clear aria-label="Effacer les départements" ${state.depts.size ? "" : "hidden"}>${I.close}</button>`;
    $("#dept-seg").innerHTML = chips + clear;
    $("#dept-list").innerHTML = chips + (state.depts.size ? `<button class="link-btn" data-dept-clear>Effacer la sélection</button>` : "");
    $("#dept-count").textContent = state.depts.size;
    $("#dept-count").hidden = !state.depts.size;
    $("#dept-toggle").classList.toggle("on", state.depts.size > 0);
  }

  /* ---------- views ---------- */
  let prevView = null;
  let viewSwap = (draw, done) => { draw(); done(); }; // remplacé par la couche motion (fondu enchaîné)
  const VIEW_URL = { grid: "cards", calendar: "calendar", map: "map" };
  const URL_VIEW = { cards: "grid", calendar: "calendar", map: "map" };

  function render() {
    renderToken++; // annule un rendu progressif en cours
    run("beforeRender", state);
    renderFilters();
    const list = filtered();
    const n = list.length;
    const pl = n > 1 ? "s" : "";
    $("#results-count").innerHTML = state.list === "favs" ? `<b>${n}</b> course${pl} en favori`
      : state.list === "registered" ? `<b>${n}</b> course${pl} où tu es inscrit·e`
      : `<b>${n}</b> course${pl} ${isFiltered() ? "correspondent" : "au calendrier 2027"}`;
    $("#reset").hidden = !isFiltered();
    $("#list-exit").hidden = state.list === "all";

    const viewChanged = prevView !== null && prevView !== state.view;
    prevView = state.view;
    const draw = () => {
      const box = $("#results");
      box.dataset.mode = state.view;
      box.setAttribute("aria-labelledby", "tab-" + state.view);
      if (state.view !== "map" || !n) destroyMap();
      if (!n) { box.innerHTML = emptyHTML(); return; }
      if (state.view === "grid") {
        const first = state.list === "all" && list.length > FIRST_BATCH && typeof requestIdleCallback === "function";
        box.innerHTML = gridHTML(first ? list.slice(0, FIRST_BATCH) : list);
        if (first) appendRest(box, list.slice(FIRST_BATCH));
      }
      else if (state.view === "calendar") box.innerHTML = calendarHTML(list);
      else renderMap(list, box);
    };
    const done = () => run("afterRender", state, list, viewChanged);
    if (viewChanged) viewSwap(draw, done); else { draw(); done(); }

    syncTabs();
    updateNav();
    syncURL();
  }

  const FIRST_BATCH = matchMedia("(max-width: 640px)").matches ? 9 : 18;
  let renderToken = 0;
  function appendRest(box, rest) {
    const token = ++renderToken;
    // petits lots tant qu'il reste du temps libre dans la frame (aucune tâche > 50 ms)
    const step = (deadline) => {
      if (token !== renderToken || !rest.length) return;
      const grid = box.querySelector(".grid");
      if (!grid) return;
      const els = [];
      do {
        const tmp = document.createElement("div");
        tmp.innerHTML = rest.splice(0, 3).map(card).join("");
        els.push(...tmp.children);
        grid.append(...tmp.children);
      } while (rest.length && deadline.timeRemaining() > 12);
      run("afterAppend", els);
      if (rest.length) requestIdleCallback(step, { timeout: 1000 });
    };
    requestIdleCallback(step, { timeout: 1000 });
  }

  function emptyHTML() {
    // des courses existent dans le périmètre mais les filtres les masquent toutes
    const hidden = RACES.filter(inScope).length;
    if (hidden && isFiltered()) {
      return `<div class="empty"><div class="empty-icon" aria-hidden="true">${I.filter}</div>
        <h3>${hidden} course${hidden > 1 ? "s" : ""} masquée${hidden > 1 ? "s" : ""} par tes filtres</h3>
        <p>${state.list === "all" ? "Aucune course ne correspond à cette combinaison." : "Tes filtres locaux cachent toutes tes courses."}</p>
        <button class="btn btn--primary" data-reset>Tout afficher</button></div>`;
    }
    const t = state.list === "registered"
      ? ["Aucune course inscrite", "Marque une course comme inscrite depuis sa fiche ou avec le bouton ✓ d'une carte."]
      : state.list === "favs"
      ? ["Aucun favori", "Touche le cœur d'une course pour la retrouver ici."]
      : ["Aucune course ne colle à tes filtres", "Élargis la distance, le mois ou les départements."];
    const icon = state.list === "registered" ? I.checkCircle : state.list === "favs" ? I.heart : "🏃‍♂️💨";
    return `<div class="empty"><div class="empty-icon" aria-hidden="true">${icon}</div><h3>${t[0]}</h3><p>${t[1]}</p>
      ${state.list !== "all" ? `<button class="btn btn--ghost" data-list-exit>Voir toutes les courses</button>` : ""}</div>`;
  }

  function gridHTML(list) {
    if (state.list === "all") return `<div class="grid">${list.map(card).join("")}</div>`;
    // Favoris / Inscrites : à venir d'abord, puis « Terminées » repliées
    const t = today();
    const up = list.filter((r) => r._end >= t).sort((a, b) => a._date - b._date);
    const past = list.filter((r) => r._end < t).sort((a, b) => b._date - a._date);
    return `<div class="grid">${up.map(card).join("")}</div>` +
      (past.length ? `<details class="done-section"><summary>Terminées <span class="n">${past.length}</span></summary><div class="grid">${past.map(card).join("")}</div></details>` : "");
  }

  /* ---------- onglets de vue (vrais tabs) ---------- */
  function syncTabs() {
    $$('[role="tab"][data-view]').forEach((b) => {
      const on = b.dataset.view === state.view;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on);
      b.tabIndex = on ? 0 : -1;
    });
  }

  /* ---------- URL + localStorage ---------- */
  function readURL() {
    const p = new URLSearchParams(location.search);
    state.view = URL_VIEW[p.get("view")] || URL_VIEW[store.get("v1:view", "cards")] || "grid";
    const dep = (p.get("dep") || "").split(",").map((d) => (d.toLowerCase() === "paris" ? "75" : d.trim())).filter((d) => DEPTS[d]);
    state.depts = new Set(dep);
    if (p.get("q")) state.q = p.get("q").slice(0, 80);
    const mo = Number(p.get("month"));
    if (p.has("month") && Number.isInteger(mo) && mo >= 0 && mo < 12) state.month = mo;
    const l = p.get("list");
    if (l === "favs" || l === "registered") { savedMain = snapshot(); Object.assign(state, blankFilters()); state.list = l; }
    else state.list = "all";
  }
  function syncURL() {
    const p = new URLSearchParams(location.search);
    p.set("view", VIEW_URL[state.view]);
    state.depts.size ? p.set("dep", [...state.depts].sort().join(",")) : p.delete("dep");
    state.list !== "all" ? p.set("list", state.list) : p.delete("list");
    p.delete("month"); p.delete("course");
    const qs = p.toString();
    if (currentSheet) { listURL = `/${qs ? "?" + qs : ""}`; }
    else history.replaceState(null, "", `/${qs ? "?" + qs : ""}`);
    store.set("v1:view", VIEW_URL[state.view]);
  }

  /* ---------- barre du haut : compteurs + minuteur ---------- */
  function nextRegistered() {
    const t = today();
    const r = RACES.filter((x) => registered.has(x.id) && x._end >= t).sort((a, b) => a._date - b._date)[0];
    if (r) r._startAt = r._date.getTime() + 9 * 3600000;
    return r || null;
  }
  function updateNav() {
    const set = (sel, n) => { const b = $(sel); b.textContent = n; b.classList.toggle("on", n > 0); };
    set("#fav-count", favs.size);
    set("#reg-count", registered.size);
    $("#nav-favs").classList.toggle("active", state.list === "favs");
    $("#nav-reg").classList.toggle("active", state.list === "registered");
    $("#nav-favs").setAttribute("aria-current", state.list === "favs" ? "page" : "false");
    $("#nav-reg").setAttribute("aria-current", state.list === "registered" ? "page" : "false");
    run("navUpdate", nextRegistered());
  }

  function calendarHTML(list) {
    const year = CFG.YEAR || 2027;
    const byMonth = Array.from({ length: 12 }, () => []);
    list.forEach((r) => r._date.getFullYear() === year && byMonth[r._date.getMonth()].push(r));
    const color = (r) => `var(${CAT_VAR[r.type] || "--cat-route"})`;
    return `<div class="calendar">` + byMonth.map((rs, i) => {
      if (!rs.length) return ""; // mois sans course : masqué
      rs.sort((a, b) => a._date - b._date);
      return `<section class="cal-month" data-month="${i}" aria-label="${MONTHS_LONG[i]}">
        <h4>${MONTHS_LONG[i]} <span>${rs.length} course${rs.length > 1 ? "s" : ""}</span></h4>
        ${rs.map((r) => `
          <button class="cal-item ${isReg(r) ? "is-registered" : ""}" data-id="${r.id}">
            <span class="cal-day num">${r._date.getDate()}<small>${WEEKDAYS[r._date.getDay()]}</small></span>
            <span class="cal-name">${esc(r.name)}${isReg(r) ? `<i class="cal-reg" aria-label="inscrit">${I.check}</i>` : ""}<small>${esc(r.city)} · ${esc(r._distLabel)}</small></span>
            <span class="cal-dot" style="--c:${color(r)}" aria-hidden="true"></span>
            <span class="cal-go" aria-hidden="true">${ARROW}</span>
          </button>`).join("")}
      </section>`;
    }).join("") + `</div>`;
  }

  let map = null, cluster = null, fitted = false;
  const markers = new Map();
  function destroyMap() {
    if (!map) return;
    map.remove(); map = null; cluster = null; fitted = false; markers.clear();
  }
  const mapRow = (r) => `<button class="map-row ${isReg(r) ? "is-registered" : ""}" data-id="${r.id}" style="--c:var(${CAT_VAR[r.type] || "--cat-route"})">
      <span class="mr-date num">${r._date.getDate()}<small>${MONTHS[r._date.getMonth()].replace(".", "")}</small></span>
      <span class="mr-name">${esc(r.name)}${isReg(r) ? `<i class="cal-reg" aria-label="inscrit">${I.check}</i>` : ""}<small>${esc(r.city)}${r.arr ? " " + esc(r.arr) : ""} · ${esc(r._distLabel)}</small></span>
      <span class="cal-dot" aria-hidden="true"></span>
    </button>`;
  const pinIcon = (r) => L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin ${r.type} ${isReg(r) ? "is-registered" : ""}" data-pin="${r.id}"><span>${r._date.getDate()}/${r._date.getMonth() + 1}</span></div>`,
    iconSize: [34, 34], iconAnchor: [4, 34], popupAnchor: [13, -30]
  });

  function renderMap(list, box) {
    if (!box.querySelector(".mapview")) {
      destroyMap();
      box.innerHTML = `<div class="mapview">
        <aside class="map-list drawer" id="map-list" aria-label="Courses affichées sur la carte">
          <div class="drawer-handle" aria-hidden="true"></div>
          <p class="drawer-title" id="map-list-title"></p>
          <div class="map-rows" id="map-rows" data-lenis-prevent></div>
        </aside>
        <div class="map-pane"><div id="map" data-lenis-prevent></div></div>
      </div>`;
    }
    $("#map-list-title").innerHTML = `<b class="num">${list.length}</b> course${list.length > 1 ? "s" : ""}`;
    $("#map-rows").innerHTML = list.map(mapRow).join("");

    if (!window.L || !L.markerClusterGroup) {
      const load = window.CALENDRUN && window.CALENDRUN.loadLeaflet;
      if (load && !renderMap._loading) {
        renderMap._loading = true;
        $("#map").innerHTML = '<p class="map-msg">Chargement de la carte…</p>';
        load().then(() => { if (state.view === "map" && $("#map")) { $("#map").innerHTML = ""; renderMap(filtered(), $("#results")); } })
          .catch(() => { if ($("#map")) $("#map").innerHTML = '<p class="map-msg">La carte n\'a pas pu se charger (connexion ?).</p>'; })
          .finally(() => { renderMap._loading = false; });
      }
      return;
    }
    if (!map) {
      map = L.map("map", { zoomControl: true, scrollWheelZoom: false, attributionControl: true }).setView([48.8566, 2.3522], 9);
      // tuiles OSM standard (sans clé), assombries en CSS (.tiles-dark) pour coller à la DA
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19, className: "tiles-dark"
      }).addTo(map);
      cluster = L.markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: 46, spiderfyOnMaxZoom: true,
        iconCreateFunction: (c) => {
          const n = c.getChildCount();
          const reg = c.getAllChildMarkers().some((m) => registered.has(m.options.raceId));
          return L.divIcon({ className: "cluster-wrap", html: `<div class="cluster ${reg ? "is-registered" : ""} ${n > 9 ? "big" : ""}"><span class="num">${n}</span></div>`, iconSize: [40, 40] });
        }
      }).addTo(map);
      map.on("click", () => map.scrollWheelZoom.enable());
    }
    cluster.clearLayers();
    markers.clear();
    const arr = [];
    list.forEach((r) => {
      if (r.lat == null) return;
      const m = L.marker([r.lat, r.lng], { icon: pinIcon(r), title: r.name, raceId: r.id, keyboard: true })
        .bindPopup(`<div class="pop-card"><span class="pop-date">${fmtLong(r._date)}</span><b>${esc(r.name)}</b>
          <div class="pop-meta">${esc(r.city)} · ${esc(r._distLabel)}</div>
          <button class="btn btn--primary pop-open" data-id="${r.id}">Voir la fiche ${ARROW}</button></div>`, { autoPanPadding: [40, 40] })
        .on("mouseover", () => hotRace(r.id, "map"))
        .on("mouseout", () => hotRace(null, "map"));
      markers.set(r.id, m);
      arr.push(m);
    });
    cluster.addLayers(arr);
    // cadre les résultats filtrés (animé après le premier affichage)
    requestAnimationFrame(() => {
      if (!map) return;
      map.invalidateSize();
      if (!arr.length) return;
      const b = L.latLngBounds(arr.map((m) => m.getLatLng()));
      const opt = { padding: [50, 50], maxZoom: 12 };
      fitted ? map.flyToBounds(b, { ...opt, duration: 0.8 }) : map.fitBounds(b, opt);
      fitted = true;
    });
  }

  /* survol liste ↔ marqueur */
  let hotId = null;
  function hotRace(id, from) {
    if (hotId === id) return;
    const mark = (x, on) => {
      if (!x) return;
      $$(`.map-row[data-id="${CSS.escape(x)}"]`).forEach((el) => el.classList.toggle("is-hot", on));
      const m = markers.get(x);
      const parent = m && cluster && cluster.getVisibleParent(m);
      const el = parent && parent.getElement && parent.getElement();
      el && el.classList.toggle("is-hot", on);
    };
    mark(hotId, false);
    hotId = id;
    if (!id) return;
    mark(id, true);
    const row = $(`.map-row[data-id="${CSS.escape(id)}"]`);
    if (row && from === "map") {
      const box = $("#map-rows"), top = row.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - row.offsetHeight) box.scrollTo({ top: top - box.clientHeight / 2, behavior: "smooth" });
    }
  }

  /* ---------- detail sheet ---------- */
  let lastFocus = null, currentSheet = null, listURL = null;
  const racePath = (id) => `/courses/${id}-2027/`;
  let transition = (fn) => fn(); // remplacé par la couche motion (View Transitions)
  function openSheet(id, focusAlert = false) {
    const r = RACES.find((x) => x.id === id);
    if (!r) return;
    if ($("#overlay").hidden) lastFocus = document.activeElement;
    currentSheet = r.id;
    const info = regInfo(r);
    const reg = r.registration || {};
    const anyApprox = r.distances.some((d) => d.elevApprox);

    let timeline = "";
    if (info.opens && info.closes) {
      const total = info.closes - info.opens, now = Date.now() - info.opens;
      const p = Math.max(0, Math.min(1, now / total));
      timeline = `<div class="reg-timeline">
        <div class="reg-track"><div class="reg-fill" style="width:${p * 100}%"></div><div class="reg-now" style="left:${p * 100}%"></div></div>
        <div class="reg-labels"><span>Ouverture<br/><b>${fmtShort(info.opens)}</b></span><span style="text-align:right">Clôture<br/><b>${fmtShort(info.closes)}</b></span></div>
      </div>`;
    }

    const sub = alerts[r.id];
    const lastEmail = store.get("email", "");
    const alertBlock = !ALERTS ? "" : sub
      ? `<div class="wl-done">${I.check}<div>Demande envoyée pour ${esc(sub.email)}<span>Confirme via le lien reçu par e-mail. Ensuite, on te prévient ${sub.alerts.includes("opening") ? "à l'ouverture des inscriptions" : ""}${sub.alerts.length > 1 ? " et " : ""}${sub.alerts.includes("reminder") ? "7 jours avant la course" : ""}. Chaque e-mail contient un lien de désinscription.</span></div></div>
         <button class="link-btn" data-unsub="${r.id}" style="justify-self:start">Oublier sur cet appareil</button>`
      : `<form class="wl" id="wl-form" data-id="${r.id}" novalidate>
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />
          <div class="wl-head"><div class="wl-bell">${I.bell}</div><div><h6>${isReg(r) ? "Rappel avant la course" : info.can ? "Rappels pour cette course" : "Préviens-moi à l'ouverture"}</h6><p>Un mail, pas de spam. Désinscription en un clic.</p></div></div>
          <div class="field"><input type="email" name="email" placeholder="ton@email.fr" required value="${esc(lastEmail)}" aria-label="Adresse email" /><button class="btn btn--primary" type="submit">M'alerter</button></div>
          <div class="checks">
            ${isReg(r)
              ? `<input type="checkbox" name="opening" hidden />`
              : `<label class="check"><input type="checkbox" name="opening" ${info.can ? "" : "checked"} />Ouverture des inscriptions / remise en vente de dossards</label>`}
            <label class="check"><input type="checkbox" name="reminder" checked />Rappel J-7 avant la course</label>
            <label class="check check--consent"><input type="checkbox" name="consent" /><span>J'accepte de recevoir ces e-mails. Un e-mail de confirmation te sera envoyé ; désinscription en un clic. <a href="/confidentialite/" target="_blank" rel="noopener noreferrer">Confidentialité</a></span></label>
          </div>
          <div class="wl-turnstile" id="wl-turnstile"></div>
          <p class="wl-error" id="wl-error" role="alert" hidden></p>
        </form>`;

    const wasOpen = !$("#overlay").hidden;
    const apply = () => {
    $("#sheet").innerHTML = `
      <div class="sheet-hero" data-type="${r.type}">
        <div class="big-date">${String(r._date.getDate()).padStart(2, "0")}.${String(r._date.getMonth() + 1).padStart(2, "0")}</div>
        <div class="sheet-actions-top">
          <button class="sheet-close" data-close aria-label="Fermer">${I.close}</button>
          <div>
            <button class="sheet-share" data-share="${r.id}" aria-label="Partager">${I.share}</button>
            <button class="fav" data-fav="${r.id}" aria-pressed="${favs.has(r.id)}" aria-label="Favori">${I.heart}</button>
          </div>
        </div>
        <div class="sheet-date" data-vt="date"><b class="num">${String(r._date.getDate()).padStart(2, "0")}${r.endDate && r.endDate !== r.date ? "–" + String(r._end.getDate()).padStart(2, "0") : ""}</b><span>${MONTHS_LONG[r._date.getMonth()]} · ${WEEKDAYS[r._date.getDay()]}</span></div>
        <div class="sponsor">${esc([r.sponsor, r.edition].filter(Boolean).join(" · ") || typeLabel(r))}</div>
        <h2 id="sheet-title" data-vt="title">${esc(r.name)}</h2>
        <p class="tagline">${esc(r.tagline || `${typeLabel(r)} à ${r.city}${r.arr ? " " + r.arr : ""} — ${r._distLabel}.`)}</p>
        <div class="sheet-meta">
          <span class="meta-pill">${I.cal}${fmtLong(r._date)}${r.endDate && r.endDate !== r.date ? " → " + fmtShort(r._end) : ""}</span>
          <span class="meta-pill">${I.pin}${esc(r.city)}${r.arr ? " " + esc(r.arr) : ""} (${esc(r.dept)})</span>
          <span class="meta-pill date-${(DATE_BADGE[r.dateStatus] || DATE_BADGE.listed).cls}">${I.clock}${(DATE_BADGE[r.dateStatus] || DATE_BADGE.listed).label}</span>
          ${reg.price ? `<span class="meta-pill">${I.euro}${esc(reg.price)}</span>` : ""}
        </div>
      </div>

      <div class="sheet-section">
        <h5>Dossard</h5>
        <div class="reg-card">
          <span class="status-pill ${info.key}">${esc(info.label)}</span>
          <p>${esc(info.sub)}</p>
          ${timeline}
          <div class="reg-buttons">
            ${regToggle(r, "block")}
            ${linksFor(r).map((l, i) => `<a class="btn ${i === 0 ? "btn--primary btn--block" : "btn--ghost btn--block"}" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.kind === "register" && info.key !== "lottery" ? "Prendre mon dossard" : l.label)} <span class="host">${esc(hostOf(l.href))}</span> ${ARROW}</a>`).join("")}
            <div id="alert-slot">${alertBlock}</div>
          </div>
        </div>
      </div>

      <div class="sheet-section">
        <h5>${r._hasElev ? "Distances & dénivelé" : "Formats"}</h5>
        <table class="dist-table">
          <thead><tr><th>Format</th><th>Distance</th><th>D+</th><th>D−</th></tr></thead>
          <tbody>${r.distances.length ? "" : `<tr><td colspan="4">Formats 2027 pas encore publiés — voir la page de la course.</td></tr>`}${r.distances.map((d) => `<tr><td>${esc(d.label)}</td><td>${d.km != null ? fmtKm(d.km) : "—"}</td><td class="up ${d.dplus == null ? "is-empty" : ""}">${elevVal(d.dplus, d.elevApprox)}</td><td class="down ${d.dminus == null ? "is-empty" : ""}">${elevVal(d.dminus, d.elevApprox)}</td></tr>`).join("")}</tbody>
        </table>
        ${anyApprox ? `<p class="approx-note">~ Dénivelé approximatif : le parcours officiel 2027 n'est pas encore publié.</p>` : ""}
      </div>

      <div class="sheet-section">
        <h5>Pratique</h5>
        <div class="reg-row">
          <button class="btn btn--ghost" data-ics="${r.id}">${I.cal} Ajouter à l'agenda</button>
        </div>
        ${(r.tags || []).length ? `<div class="tags" style="margin-top:18px">${r.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : ""}
        <p class="report-row">Une date, un lien ou un format est faux&nbsp;? <a class="report-link" href="/mentions-legales/#contact" data-mail="courses" data-mail-tpl="error" data-name="${esc(r.name)}" data-url="${esc(((window.BRAND || {}).SITE_URL || location.origin) + racePath(r.id))}">Signaler une erreur</a></p>
      </div>`;

    $("#overlay").hidden = false;
    document.body.classList.add("locked");
    if (!wasOpen) $("#sheet").scrollTop = 0;
    };
    if (wasOpen) apply(); else { transition(apply, r.id, "open"); run("openSheet", r); }
    if (ALERTS) requestAnimationFrame(() => { const f = $("#wl-form"); f && run("alertForm", f); });
    // URL stable et partageable de la fiche (page statique indexable générée au build)
    if (!wasOpen) listURL = location.pathname + location.search;
    history.replaceState(null, "", racePath(r.id));
    // le contenu peut arriver un peu plus tard (View Transition) : on attend qu'il soit là
    const focusIn = (tries = 10) => {
      const input = $("#wl-form input[type=email]"), close = $(".sheet-close");
      if (focusAlert && input) { $("#alert-slot").scrollIntoView({ behavior: "smooth", block: "center" }); input.focus({ preventScroll: true }); }
      else if (close) close.focus({ preventScroll: true });
      else if (tries) setTimeout(() => focusIn(tries - 1), 60);
    };
    setTimeout(focusIn, 80);
  }
  function closeSheet() {
    if ($("#overlay").hidden) return;
    const id = currentSheet;
    transition(() => {
      $("#overlay").hidden = true;
      document.body.classList.remove("locked");
    }, id, "close");
    run("closeSheet");
    currentSheet = null;
    history.replaceState(null, "", listURL || "/");
    syncURL();
    lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
  }

  /* ---------- waitlist ---------- */
  async function submitAlert(form) {
    const r = RACES.find((x) => x.id === form.dataset.id);
    const email = form.email.value.trim();
    const err = $("#wl-error");
    const sel = ["opening", "reminder"].filter((k) => form[k].checked);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = "Cet email n'a pas l'air valide."; err.hidden = false; return; }
    if (!sel.length) { err.textContent = "Choisis au moins un type d'alerte."; err.hidden = false; return; }
    if (!form.consent.checked) { err.textContent = "Coche la case de consentement pour recevoir les alertes."; err.hidden = false; return; }
    const turnstileToken = form.dataset.turnstile || "";
    if (!turnstileToken) { err.textContent = "Patiente une seconde : vérification anti-robot en cours."; err.hidden = false; return; }
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "…";
    const payload = { email, raceId: r.id, alerts: sel, consent: true, website: form.website.value, turnstileToken };
    try {
      const res = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.message || "HTTP " + res.status);
      alerts[r.id] = { email, alerts: sel, createdAt: new Date().toISOString(), pending: true };
      store.set("alerts", alerts); store.set("email", email);
      favs.add(r.id); store.set("favs", [...favs]);
      toast("Vérifie ta boîte mail pour confirmer 📬");
      openSheet(r.id);
      render();
    } catch (e) {
      err.textContent = e.message && !/^HTTP/.test(e.message) ? e.message : "Oups, l'envoi a échoué. Réessaie dans un instant.";
      err.hidden = false;
      btn.disabled = false; btn.textContent = "M'alerter";
      window.CALENDRUN.hooks && run("alertForm", form); // nouveau jeton Turnstile
    }
  }

  /* ---------- ics ---------- */
  function downloadIcs(id) {
    const r = RACES.find((x) => x.id === id);
    const d = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
    const icsEsc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
    const end = new Date(r._end.getTime() + DAY);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//${(window.BRAND || {}).SITE_NAME || "Site"}//Courses IDF//FR`, "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${r.id}-${r.date}@${location.hostname}`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d(r._date)}`, `DTEND;VALUE=DATE:${d(end)}`,
      `SUMMARY:🏃 ${icsEsc(r.name)}`,
      `LOCATION:${icsEsc(r.city + (r.arr ? " " + r.arr : ""))}`,
      `DESCRIPTION:${icsEsc(r.distances.map((x) => x.label).join(" / ") + (r.dateStatus !== "confirmed" ? " — date à reconfirmer auprès de l'orga" : "") + "\n" + linksFor(r)[0].href)}`,
      `URL:${linksFor(r)[0].href}`,
      "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", `DESCRIPTION:J-7 : ${icsEsc(r.name)}`, "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"
    ].filter(Boolean).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    a.download = `${r.id}-2027.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    toast("Ajouté à ton agenda 📅");
  }

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg, opt = {}) {
    const t = $("#toast");
    t.innerHTML = `<span>${esc(msg)}</span>${opt.action ? `<button class="toast-action" type="button">${esc(opt.action)}</button>` : ""}`;
    t.classList.toggle("has-action", !!opt.action);
    t.classList.add("show");
    if (opt.action) t.querySelector(".toast-action").onclick = () => { t.classList.remove("show"); opt.onAction && opt.onAction(); };
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), opt.action ? 5000 : 2600);
  }

  /* ---------- statut « inscrit » ---------- */
  function setRegistered(id, on, silent = false) {
    on ? registered.add(id) : registered.delete(id);
    store.set("v1:registered", [...registered]);
    refreshRace(id);
    run("registered", id, on);
    if (!silent) toast(on ? "C'est noté : tu es inscrit·e ✓" : "Retirée de tes courses inscrites", { action: "Annuler", onAction: () => setRegistered(id, !on, true) });
  }
  function refreshRace(id) {
    const r = RACES.find((x) => x.id === id);
    if (state.view === "grid" && state.list !== "registered") {
      const wrap = $(`.card-wrap[data-flip-id="${CSS.escape(id)}"]`);
      if (wrap) {
        const tmp = document.createElement("div");
        tmp.innerHTML = card(r);
        const nw = tmp.firstElementChild;
        nw.classList.add("seen");
        wrap.replaceWith(nw);
      }
      updateNav();
    } else render();
    if (!$("#overlay").hidden && currentSheet === id) openSheet(id);
  }

  /* synchronisation entre onglets */
  addEventListener("storage", (e) => {
    if (e.key === "calendrun:v1:registered") { registered = new Set(store.get("v1:registered", [])); render(); }
    if (e.key === "calendrun:favs") { favs = new Set(store.get("favs", [])); render(); }
  });

  function toggleFav(id, btn) {
    favs.has(id) ? favs.delete(id) : favs.add(id);
    store.set("favs", [...favs]);
    $$(`[data-fav="${id}"]`).forEach((b) => { b.setAttribute("aria-pressed", favs.has(id)); b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); });
    updateNav();
    toast(favs.has(id) ? "Ajoutée à tes favoris ❤️" : "Retirée de tes favoris");
    if (state.list === "favs") render();
  }

  /* ---------- events ---------- */
  function resetFilters() {
    const keepSort = state.sort;
    Object.assign(state, blankFilters(), { sort: keepSort });
    syncControls();
    render();
  }

  document.addEventListener("click", (e) => {
    const t = e.target;
    const fav = t.closest("[data-fav]");
    if (fav) { e.stopPropagation(); toggleFav(fav.dataset.fav, fav); return; }
    const regB = t.closest("[data-reg]");
    if (regB) { e.stopPropagation(); setRegistered(regB.dataset.reg, !registered.has(regB.dataset.reg)); return; }
    const lst = t.closest("[data-list]");
    if (lst) {
      e.preventDefault();
      setList(state.list === lst.dataset.list ? "all" : lst.dataset.list);
      render();
      window.CALENDRUN.scrollTo($("#results-count"));
      return;
    }
    if (t.closest("[data-reset]")) { resetFilters(); return; }
    if (t.closest("[data-list-exit]")) { setList("all"); render(); return; }
    if (t.closest("[data-dept-clear]")) { state.depts.clear(); render(); return; }
    if (t.closest("[data-stop]")) return; // external register link
    const al = t.closest("[data-alert]");
    if (al) { openSheet(al.dataset.alert, true); return; }
    const unsub = t.closest("[data-unsub]");
    if (unsub) { delete alerts[unsub.dataset.unsub]; store.set("alerts", alerts); toast("Alerte désactivée"); openSheet(unsub.dataset.unsub); render(); return; }
    const ics = t.closest("[data-ics]");
    if (ics) { downloadIcs(ics.dataset.ics); return; }
    const share = t.closest("[data-share]");
    if (share) {
      const r = RACES.find((x) => x.id === share.dataset.share);
      const url = location.origin + racePath(r.id);
      if (navigator.share) navigator.share({ title: r.name, text: `${r.name} — ${fmtShort(r._date)} 2027`, url }).catch(() => {});
      else navigator.clipboard.writeText(url).then(() => toast("Lien copié 🔗"));
      return;
    }
    if (t.closest("[data-close]") || t === $("#overlay")) { closeSheet(); return; }
    const open = t.closest(".card, .next-card, .next-mini, .cal-item, .map-row, .pop-open");
    if (open) { openSheet(open.dataset.id); return; }

    const cat = t.closest("[data-cat]");
    if (cat) { const c = cat.dataset.cat; if (!c) state.cats.clear(); else state.cats.has(c) ? state.cats.delete(c) : state.cats.add(c); render(); return; }
    const dept = t.closest("[data-dept]");
    if (dept) {
      const d = dept.dataset.dept;
      state.depts.has(d) ? state.depts.delete(d) : state.depts.add(d);
      render();
      // depuis la barre du haut : on descend jusqu'aux résultats
      const rc = $("#results-count").getBoundingClientRect();
      if (dept.closest(".nav") && (rc.top > innerHeight * 0.8 || rc.bottom < 0)) window.CALENDRUN.scrollTo($("#results-count"));
      return;
    }
    const mo = t.closest("[data-month]");
    if (mo) { const m = +mo.dataset.month; state.month = state.month === m ? null : m; render(); return; }
    const view = t.closest('[role="tab"][data-view]');
    if (view) { selectView(view.dataset.view); return; }
  });

  function selectView(v) {
    if (v === state.view) return;
    state.view = v;
    render();
    run("viewSelected", v);
  }
  // onglets : flèches / Début / Fin
  $(".view-switch").addEventListener("keydown", (e) => {
    const tabs = $$("[role=tab]", e.currentTarget);
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const k = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    const tgt = tabs[(k + tabs.length) % tabs.length];
    tgt.focus();
    selectView(tgt.dataset.view);
  });
  // survol liste ↔ carte
  $("#results").addEventListener("mouseover", (e) => { const row = e.target.closest(".map-row"); hotRace(row ? row.dataset.id : null, "list"); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("#q").focus(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches(".card, .next-card")) { e.preventDefault(); openSheet(e.target.dataset.id); }
  });

  document.addEventListener("submit", (e) => { if (e.target.id === "wl-form") { e.preventDefault(); submitAlert(e.target); } });

  let qT;
  $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 120); });
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") window.CALENDRUN.scrollTo($("#courses")); });
  $("#f-open").addEventListener("change", (e) => { state.open = e.target.checked; render(); });
  $("#f-confirmed").addEventListener("change", (e) => { state.confirmed = e.target.checked; render(); });
  $("#f-sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });


  /* ---------- API pour la couche motion & la scène 3D ---------- */
  const hooks = { afterAppend: [], beforeRender: [], afterRender: [], afterHero: [], openSheet: [], closeSheet: [], navUpdate: [], registered: [], viewSelected: [], alertForm: [] };
  const run = (k, ...a) => hooks[k].forEach((f) => { try { f(...a); } catch (e) { console.error("[site]", k, e); } });
  window.CALENDRUN = {
    races: RACES, openSheet, fmtShort, esc, hooks, state,
    setTransition(f) { transition = f; },
    setViewSwap(f) { viewSwap = f; },
    nextRegistered, activeFilterCount,
    // hero : clic sur un mois → filtre de ce mois dans la liste principale, puis défilement
    renderCatalog() { render(); this.catalogReady = true; this.hooks.catalogReady && this.hooks.catalogReady.forEach((f) => f()); },
    filterMonth(m) {
      setList("all");
      state.month = m;
      render();
      window.CALENDRUN.scrollTo($("#results-count"));
    },
    isRegistered: (id) => registered.has(id),
    scrollTo: (el) => el.scrollIntoView({ behavior: "smooth" }),
    favCount: () => favs.size,
    boot({ deferCatalog = false } = {}) {
      readURL();
      syncControls();
      renderHero();
      // le catalogue est sous la ligne de flottaison : rendu juste après le premier affichage du hero
      const deep = location.search.includes("course=") || /^#c\//.test(location.hash);
      if (deferCatalog && !deep) { renderFilters(); syncTabs(); updateNav(); } // main.js appellera renderCatalog()
      else render();
      const p = new URLSearchParams(location.search);
      const m = location.hash.match(/^#c\/(.+)$/) || location.pathname.match(/^\/courses\/(.+)-2027\/?$/);
      const id = p.get("course") || (m && decodeURIComponent(m[1]));
      if (id && RACES.some((r) => r.id === id)) {
        if (p.has("course")) { p.delete("course"); history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "")); }
        openSheet(id);
      }
    }
  };
})();
