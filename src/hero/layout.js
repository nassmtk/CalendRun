/* Données du hero : 12 mois × catégories (partagé par la scène WebGL et le repli SVG) */
export const A = window.ALLURE;
const css = getComputedStyle(document.documentElement);
export const tokHex = (n) => css.getPropertyValue(n).trim();

export const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
export const MONTHS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// ordre d'empilement (du bas vers le haut) et couleurs de catégorie existantes
export const CATS = [
  { id: "route", label: "Route", token: "--cat-route" },
  { id: "trail", label: "Trail & cross", token: "--cat-trail" },
  { id: "urban", label: "Urban trail", token: "--cat-urban" },
  { id: "ultra", label: "Ultra & backyard", token: "--cat-ultra" },
  { id: "relais", label: "Relais", token: "--cat-relais" }
];
const CAT_OF = { route: "route", trail: "trail", cross: "trail", urban: "urban", backyard: "ultra", relais: "relais" };

/** [{ m, total, parts: { route: n, … } }] pour les 12 mois (toutes les courses de l'année) */
export function monthStats(races, year = 2027) {
  const out = Array.from({ length: 12 }, (_, m) => ({ m, total: 0, parts: Object.fromEntries(CATS.map((c) => [c.id, 0])) }));
  races.forEach((r) => {
    if (r._date.getFullYear() !== year) return;
    const s = out[r._date.getMonth()];
    s.total++;
    s.parts[CAT_OF[r.type] || "route"]++;
  });
  return out;
}

/** contenu HTML de l'info-bulle d'un mois */
export function tipHTML(s) {
  const rows = CATS.filter((c) => s.parts[c.id]).map((c) =>
    `<li><i style="--c:var(${c.token})"></i>${c.label}<b class="num">${s.parts[c.id]}</b></li>`).join("");
  return `<span class="ht-date">${MONTHS_LONG[s.m]} 2027</span><b><span class="num">${s.total}</span> course${s.total > 1 ? "s" : ""}</b><ul class="ht-parts">${rows}</ul><span class="ht-cta">Cliquer pour voir ce mois →</span>`;
}
