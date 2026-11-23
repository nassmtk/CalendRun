/* =========================================================
   Flow global : Lenis, intro du hero, compteurs,
   compte à rebours roulant, mini-barre, apparitions par lots,
   FLIP des cartes, pastilles glissantes, CTA magnétiques,
   transition carte → fiche (View Transitions).
   ========================================================= */
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import Lenis from "lenis";
import { reduced, canHover, EASE } from "./env.js";
import { mountCountdown } from "./countdown.js";

gsap.registerPlugin(Flip);
// Les apparitions au scroll passent par IntersectionObserver (asynchrone, robuste au rendu
// progressif et à content-visibility) : pas de ScrollTrigger, pas de recalcul de positions.
gsap.defaults({ ease: EASE, duration: 0.6 });

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const fr = (n) => Math.round(n).toLocaleString("fr-FR");

let lenis = null;

/* ---------- smooth scroll ---------- */
export function initSmoothScroll(A) {
  if (reduced()) return;
  lenis = new Lenis({ duration: 1.1, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  A.lenis = lenis; // tiroirs du bas : pause du défilement doux
  A.scrollTo = (el) => lenis.scrollTo(el, { offset: -90, duration: 1.2 });
  A.hooks.openSheet.push(() => lenis.stop());
  A.hooks.closeSheet.push(() => lenis.start());
}

/* ---------- hero : titre en lignes masquées, puis le reste ---------- */
export function initHeroIntro() {
  const lines = $$("h1 .line > span");
  const rest = [".hero .eyebrow", ".hero .lede", ".hero-search", ".hero-stats"].map((s) => $(s)).filter(Boolean);
  if (reduced()) return;
  const tl = gsap.timeline({ defaults: { ease: EASE } });
  tl.from(".hero .eyebrow", { y: 16, opacity: 0, duration: 0.6 })
    .from(lines, { yPercent: 110, duration: 0.7, stagger: 0.09 }, "-=0.35")
    .from(rest.slice(1), { y: 22, opacity: 0, duration: 0.6, stagger: 0.08 }, "-=0.45");
}

/* ---------- stats : comptent une seule fois à l'entrée ---------- */
export function initStats() {
  const els = $$("#hero-stats [data-count]");
  if (reduced()) return;
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.4, ease: "power3.out", onUpdate: () => (el.textContent = fr(o.v)) });
  }), { rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => { el.textContent = "0"; io.observe(el); });
}

/* ---------- prochain départ : compte à rebours + mini-barre sticky ---------- */
export function initNextUp(A) {
  const m = $("#next-mini");
  let pastBanner = false, stop1 = null, stop2 = null;
  // la mini-barre ne s'affiche que si AUCUNE course inscrite n'est à venir (sinon : minuteur de la barre du haut)
  const sync = () => {
    const show = pastBanner && !A.nextRegistered();
    m.classList.toggle("show", show);
    m.setAttribute("aria-hidden", String(!show));
    m.tabIndex = show ? 0 : -1;
  };
  A.hooks.navUpdate.push(sync);

  A.hooks.afterHero.push((next) => {
    const box = $("#countdown"), mini = $("#mini-cd");
    if (!box || !next) return;
    box.innerHTML = [["d", "jours"], ["h", "h"], ["m", "min"], ["s", "sec"]]
      .map(([u, l]) => `<div class="cd-cell"><span data-unit="${u}"></span><span class="lbl">${l}</span></div>`).join("");
    mini.innerHTML = `<span data-unit="d"></span><small>j</small><span data-unit="h"></span><small>h</small><span data-unit="m"></span><small>min</small><span data-unit="s"></span><small>s</small>`;
    stop1 && stop1(); stop2 && stop2();
    stop1 = mountCountdown(box, next._startAt);
    stop2 = mountCountdown(mini, next._startAt);

    new IntersectionObserver(([e]) => {
      pastBanner = !e.isIntersecting && e.boundingClientRect.top < 0; // sorti par le haut
      sync();
    }, { rootMargin: "-90px 0px 0px 0px" }).observe($("#next-up"));
    m.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); A.openSheet(m.dataset.id); } });
  });
}

/* ---------- minuteur « Inscrites » dans la barre du haut ---------- */
export function initNavTimer(A) {
  const btn = $("#nav-timer");
  let current = null, stop = null;
  A.hooks.navUpdate.push((next) => {
    if (!next) { stop && stop(); stop = null; current = null; btn.hidden = true; btn.removeAttribute("data-id"); return; }
    btn.hidden = false;
    if (current === next.id) return; // même course : l'horloge tourne déjà
    current = next.id;
    btn.dataset.id = next.id;
    const date = next._date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    btn.innerHTML = `<span class="t-j">J-<span data-unit="d"></span></span><span class="t-clock"><span class="t-sep">·</span><span data-unit="h"></span>:<span data-unit="m"></span>:<span data-unit="s"></span></span>
      <span class="nav-tip" role="tooltip"><b>${A.esc(next.name)}</b><span>${date} · ${A.esc(next.city)}</span></span>`;
    stop && stop();
    stop = mountCountdown(btn, next._startAt, {
      onDay: (d) => btn.setAttribute("aria-label", `${d} jour${d > 1 ? "s" : ""} avant ${next.name} — ouvrir la fiche`)
    });
    if (!reduced()) gsap.fromTo(btn, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2)", clearProps: "transform,opacity" });
  });
  btn.addEventListener("click", () => btn.dataset.id && A.openSheet(btn.dataset.id));
}

/* ---------- inscrit : petite animation de validation ---------- */
export function initRegisteredFx(A) {
  A.hooks.registered.push((id, on) => {
    if (reduced()) return;
    const badge = $("#reg-count");
    badge && gsap.fromTo(badge, { y: on ? 10 : -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: "power3.out", clearProps: "transform,opacity" });
    if (!on) return;
    requestAnimationFrame(() => {
      document.querySelectorAll(`[data-reg="${CSS.escape(id)}"]`).forEach((b) => {
        gsap.fromTo(b, { scale: 0.8 }, { scale: 1, duration: 0.5, ease: "back.out(3)", clearProps: "transform" });
        b.classList.remove("pulse-ok"); void b.offsetWidth; b.classList.add("pulse-ok");
      });
      const c = document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
      if (c) { c.classList.remove("pulse-ok"); void c.offsetWidth; c.classList.add("pulse-ok"); }
    });
  });
}

/* ---------- vues : fondu enchaîné dans un conteneur unique ---------- */
export function initViewSwap(A) {
  const box = $("#results");
  A.setViewSwap((draw, done) => {
    if (reduced()) { draw(); done(); return; }
    const h = box.offsetHeight;
    box.style.minHeight = h + "px"; // pas de saut de hauteur pendant la transition
    gsap.killTweensOf(box);
    gsap.to(box, {
      opacity: 0, y: -8, duration: 0.14, ease: "power2.in",
      onComplete: () => {
        draw(); done();
        gsap.fromTo(box, { opacity: 0, y: 12 }, {
          opacity: 1, y: 0, duration: 0.28, ease: EASE, clearProps: "transform,opacity",
          onComplete: () => { box.style.minHeight = ""; }
        });
      }
    });
  });
  // au changement de vue : si le haut des résultats est hors écran, on y retourne en douceur
  A.hooks.viewSelected.push(() => {
    const r = $("#results-count").getBoundingClientRect();
    if (r.top < 70 || r.top > innerHeight * 0.75) A.scrollTo($("#results-count"));
  });
}

/* ---------- cartes : apparition par lots + FLIP au changement de filtre ---------- */
export function initGridFlow(A) {
  let flipState = null, prevView = null;

  A.hooks.beforeRender.push((state) => {
    flipState = null;
    if (reduced() || state.view !== "grid" || prevView !== "grid") return;
    const wraps = $$("#results .card-wrap");
    if (wraps.length) flipState = Flip.getState(wraps, { props: "opacity" });
  });

  A.hooks.afterRender.push((state, list, viewChanged) => {
    const view = state.view;
    if (view === "grid") {
      const wraps = $$("#results .card-wrap");
      if (flipState && wraps.length && !viewChanged) {
        // les cartes sont recréées : Flip les relie par data-flip-id
        wraps.forEach((w) => w.classList.add("seen"));
        Flip.from(flipState, {
          targets: wraps, duration: 0.6, ease: EASE, absolute: false, nested: false, prune: true,
          onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.02, clearProps: "transform,opacity" })
        });
      } else {
        reveal(wraps);
      }
    }
    if (view === "calendar") {
      reveal($$("#results .cal-month"));
      // mois choisi dans les filtres : on y va et on le met en avant
      if (state.month !== null) {
        const mEl = $(`#results .cal-month[data-month="${state.month}"]`);
        if (mEl) {
          mEl.classList.add("seen"); gsap.set(mEl, { clearProps: "all" });
          const r = mEl.getBoundingClientRect();
          if (r.top < 80 || r.top > innerHeight * 0.7) A.scrollTo(mEl);
          mEl.classList.remove("flash"); void mEl.offsetWidth; mEl.classList.add("flash");
        }
      }
    }
    prevView = view;
  });

  // cartes ajoutées par le rendu progressif
  A.hooks.afterAppend.push((els) => reveal(els, true));

  // apparition par lots : les éléments qui entrent à l'écran dans la même frame forment un lot animé en cascade
  let queue = [], raf = 0;
  const flush = () => {
    raf = 0;
    const batch = queue.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    queue = [];
    batch.forEach((b) => { b.classList.add("seen"); b.classList.remove("pre-reveal"); });
    // la légère rotation 3D n'existe que pendant l'animation, sur le lot visible
    gsap.fromTo(batch, { opacity: 0, y: 40, rotationX: -8, transformPerspective: 900, transformOrigin: "50% 0%" },
      { opacity: 1, y: 0, rotationX: 0, duration: 0.7, stagger: 0.06, ease: EASE, clearProps: "transform,opacity,transformPerspective,transformOrigin" });
  };
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    if (!e.target.isConnected) return;
    queue.push(e.target);
    raf = raf || requestAnimationFrame(flush);
  }), { rootMargin: "0px 0px -5% 0px" });

  function reveal(els, append = false) {
    if (reduced()) return;
    if (!append) io.takeRecords(); // la grille a été recréée : les anciennes cibles sont détachées
    els = els.filter((e) => !e.classList.contains("seen"));
    els.forEach((e) => { e.classList.add("pre-reveal"); io.observe(e); }); // classe CSS : pas de style inline ni de 3D sur toute la grille
  }
}

/* ---------- pastille flottante « Filtres · N actifs » ---------- */
export function initFiltersFab(A) {
  const fab = $("#filters-fab"), label = $("#filters-fab-label");
  const setLabel = () => {
    const n = A.activeFilterCount();
    label.textContent = n ? `Filtres · ${n} actif${n > 1 ? "s" : ""}` : "Filtres";
    fab.classList.toggle("on", n > 0);
  };
  A.hooks.afterRender.push(setLabel);
  const show = (on) => {
    fab.classList.toggle("show", on);
    fab.setAttribute("aria-hidden", String(!on));
    fab.tabIndex = on ? 0 : -1;
    document.documentElement.classList.toggle("has-fab", on);
  };
  // visible quand le panneau est sorti par le haut, tant qu'on est dans les résultats
  let toolbarAbove = false, catalogIn = false;
  new IntersectionObserver(([e]) => { toolbarAbove = !e.isIntersecting && e.boundingClientRect.top < 0; show(toolbarAbove && catalogIn); }, { rootMargin: "-80px 0px 0px 0px" }).observe($("#toolbar"));
  new IntersectionObserver(([e]) => { catalogIn = e.isIntersecting; show(toolbarAbove && catalogIn); }, { rootMargin: "0px 0px -40% 0px" }).observe($("#courses"));
  fab.addEventListener("click", () => A.scrollTo($("#toolbar")));
}

/* ---------- pastille active qui glisse (vues + mois) ---------- */
export function initPills(A) {
  const groups = [
    { box: ".view-switch", active: "button.active" },
    { box: "#f-month", active: '.month[aria-pressed="true"]' }
  ];
  const last = new Map();
  const place = () => {
    groups.forEach(({ box, active }) => {
      const b = $(box); if (!b) return;
      b.classList.add("has-pill");
      let pill = $(":scope > .pill-bg", b);
      if (!pill) { pill = document.createElement("span"); pill.className = "pill-bg"; b.prepend(pill); }
      const a = $(active, b);
      if (!a) { gsap.to(pill, { opacity: 0, duration: 0.2 }); last.delete(box); return; }
      const r = { x: a.offsetLeft, y: a.offsetTop, w: a.offsetWidth, h: a.offsetHeight };
      const from = last.get(box);
      if (!from || reduced()) gsap.set(pill, { x: r.x, y: r.y, width: r.w, height: r.h, opacity: 1 });
      else {
        gsap.set(pill, { x: from.x, y: from.y, width: from.w, height: from.h, opacity: 1 });
        gsap.to(pill, { x: r.x, y: r.y, width: r.w, height: r.h, duration: 0.45, ease: EASE });
      }
      last.set(box, r);
    });
  };
  A.hooks.afterRender.push(place);
  addEventListener("resize", () => { last.clear(); place(); });
}

/* ---------- CTA magnétiques ---------- */
export function initMagnetic() {
  if (!canHover() || reduced()) return;
  const S = 0.25, MAX = 8;
  let cur = null, qx, qy;
  document.addEventListener("pointermove", (e) => {
    const el = e.target.closest?.(".magnetic");
    if (el !== cur) {
      if (cur) { gsap.to(cur, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, .5)" }); }
      cur = el;
      if (el) { qx = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" }); qy = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" }); }
    }
    if (!el) return;
    const b = el.getBoundingClientRect();
    qx(gsap.utils.clamp(-MAX, MAX, (e.clientX - (b.left + b.width / 2)) * S));
    qy(gsap.utils.clamp(-MAX, MAX, (e.clientY - (b.top + b.height / 2)) * S));
  }, { passive: true });
}

/* ---------- carte → fiche : éléments partagés ---------- */
export function initSheetTransition(A) {
  const sheet = $("#sheet"), overlay = $("#overlay");
  const tag = (root, on) => {
    if (!root) return;
    const d = $('[data-vt="date"]', root), t = $('[data-vt="title"]', root);
    if (d) d.style.viewTransitionName = on ? "vt-date" : "";
    if (t) t.style.viewTransitionName = on ? "vt-title" : "";
  };
  const source = (id) => {
    const c = id && document.querySelector(`.card[data-id="${CSS.escape(id)}"]`);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return r.bottom > 0 && r.top < innerHeight ? c : null; // seulement si visible
  };

  const fallback = (fn, mode) => {
    fn();
    if (reduced()) return;
    if (mode === "open") {
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      gsap.fromTo(sheet, { x: 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.55, ease: EASE, clearProps: "transform" });
    }
  };

  A.setTransition((fn, id, mode) => {
    if (reduced() || !document.startViewTransition || document.hidden) return fallback(fn, mode);
    const card = source(id);
    if (mode === "open") {
      tag(card, true);
      const vt = document.startViewTransition(() => { tag(card, false); fn(); tag(sheet, true); });
      vt.finished.catch(() => {}).finally(() => tag(sheet, false));
      vt.ready.catch(() => {});
    } else {
      tag(sheet, true);
      const vt = document.startViewTransition(() => { tag(sheet, false); fn(); tag(card, true); });
      vt.finished.catch(() => {}).finally(() => tag(card, false));
      vt.ready.catch(() => {});
    }
  });
}
