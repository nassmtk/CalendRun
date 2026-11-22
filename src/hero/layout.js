/* =========================================================
   ALLURE — hero 3D : la saison 2027 en ligne de temps
   Janvier → décembre. Une colonne = une course.
   Hauteur = distance · couleur = catégorie · survol = infos · clic = fiche
   ========================================================= */

export const A = window.ALLURE;
export const css = getComputedStyle(document.documentElement);
export const tokHex = (n) => css.getPropertyValue(n).trim();
export const MONTHS = ["JANV", "FÉVR", "MARS", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEPT", "OCT", "NOV", "DÉC"];
export const CAT = { route: "--cat-route", trail: "--cat-trail", cross: "--cat-trail", urban: "--cat-urban", backyard: "--cat-ultra", relais: "--cat-relais" };

export const L = 30;                 // demi-longueur de la ligne de temps
export const STACK = 0.9;            // écart en profondeur entre courses du même jour
export const yearStart = new Date(2027, 0, 1).getTime();
export const dayOf = (d) => Math.round((d.getTime() - yearStart) / 86400000);
export const xOf = (day) => -L + (day / 364) * 2 * L;
export const heightOf = (r) => (r._maxKm ? 1.2 + Math.log2(1 + r._maxKm) * 1.9 : r.type === "backyard" ? 11 : 4.5);

/* ---------- placement commun (3D et repli SVG) ---------- */
export function layout(races) {
  const perDay = new Map();
  return races.filter((r) => r._date.getFullYear() === 2027).map((r) => {
    const day = dayOf(r._date);
    const k = perDay.get(day) || 0;
    perDay.set(day, k + 1);
    const z = k === 0 ? 0 : (k % 2 ? -1 : 1) * Math.ceil(k / 2) * STACK;
    return { r, day, x: xOf(day), z, h: heightOf(r), cat: CAT[r.type] || "--cat-route" };
  });
}

