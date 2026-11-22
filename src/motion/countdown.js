/* =========================================================
   Compte à rebours partagé : une seule horloge (1 tick/s) et un
   seul composant de chiffres roulants, utilisés par le bandeau
   « Prochain départ », sa mini-barre et le minuteur de la barre du haut.
   Chaque tick ne met à jour que les chiffres qui changent.
   ========================================================= */
import { gsap } from "gsap";
import { reduced } from "./env.js";

const DAY = 86400000;
const subs = new Set();
let timer = null;

/** s'abonne à l'horloge ; renvoie la fonction de désabonnement */
export function onTick(fn) {
  subs.add(fn);
  fn(Date.now());
  if (!timer) timer = setInterval(() => { const now = Date.now(); subs.forEach((f) => f(now)); }, 1000);
  return () => { subs.delete(fn); if (!subs.size) { clearInterval(timer); timer = null; } };
}

/** découpe une durée en [jours, heures, minutes, secondes] */
export function split(target, now = Date.now()) {
  const diff = Math.max(0, target - now);
  return [Math.floor(diff / DAY), Math.floor((diff % DAY) / 3600000), Math.floor((diff % 3600000) / 60000), Math.floor((diff % 60000) / 1000)];
}

/** transforme un élément en compteur à chiffres roulants ; renvoie set(value) */
export function makeRoll(el, digits) {
  el.classList.add("roll");
  el.innerHTML = Array.from({ length: digits }, () =>
    `<span class="roll-digit"><span>${"0123456789".split("").map((d) => `<i>${d}</i>`).join("")}</span></span>`).join("");
  const cols = [...el.querySelectorAll(".roll-digit > span")];
  let prev = "";
  return (value) => {
    const s = String(value).padStart(digits, "0").slice(-digits);
    if (s === prev) return;
    s.split("").forEach((d, i) => {
      if (prev[i] === d) return;
      const yPercent = -10 * +d; // colonne de 10 chiffres
      if (reduced() || !prev) gsap.set(cols[i], { yPercent });
      else gsap.to(cols[i], { yPercent, duration: 0.5, ease: "power3.out" });
    });
    prev = s;
  };
}

/**
 * Monte un compte à rebours dans un conteneur à partir d'un gabarit :
 * chaque élément [data-unit="d|h|m|s"] devient un compteur roulant.
 * Renvoie une fonction de nettoyage.
 */
export function mountCountdown(root, target, { onDay } = {}) {
  const idx = { d: 0, h: 1, m: 2, s: 3 };
  const rolls = [...root.querySelectorAll("[data-unit]")].map((el) => {
    const u = el.dataset.unit;
    const digits = u === "d" ? Math.max(2, String(split(target)[0]).length) : 2;
    return [idx[u], makeRoll(el, digits)];
  });
  let lastDay = null;
  return onTick((now) => {
    const v = split(target, now);
    rolls.forEach(([i, set]) => set(v[i]));
    if (onDay && v[0] !== lastDay) { lastDay = v[0]; onDay(v[0]); }
  });
}
