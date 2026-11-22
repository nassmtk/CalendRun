// Statut d'inscription + liens d'une course (miroir de regInfo / linksFor de src/app.js) pour les pages statiques
const DAY = 86400000;
const parse = (s) => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const fmtShort = (d) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

export function regInfo(r, today = new Date()) {
  const t = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const reg = r.registration || {};
  const opens = parse(reg.opens), closes = parse(reg.closes);
  if (r._end < t) return { key: "past", label: "Course terminée", can: false };
  if (reg.status === "closed") return { key: "closed", label: "Inscriptions closes", can: false };
  if (opens && t < opens) return { key: "soon", label: `Ouverture le ${fmtShort(opens)}`, can: false };
  if (closes && t > closes) return { key: "closed", label: reg.status === "lottery" ? "Tirage au sort clos" : "Inscriptions closes", can: false };
  if (reg.status === "open") return { key: "open", label: "Inscriptions ouvertes", can: !!reg.url };
  if (reg.status === "lottery") return { key: "lottery", label: "Tirage au sort", can: !!reg.url };
  if (reg.status === "soon") return { key: "soon", label: "Ouverture bientôt", can: false };
  if (reg.status === "check") return { key: "check", label: reg.url ? "Inscriptions en ligne" : "Inscription chez l'organisateur", can: !!reg.url };
  return { key: "unknown", label: "Infos à venir", can: false };
}

export function linksFor(r, today) {
  const reg = r.registration || {}, info = regInfo(r, today), out = [];
  const add = (href, label, kind) => href && !out.some((l) => l.href === href) && out.push({ href, label, kind });
  if (info.can && reg.url) add(reg.url, info.key === "lottery" ? "Tenter le tirage" : "S'inscrire", "register");
  if (reg.preUrl && info.key !== "past") add(reg.preUrl, info.key === "closed" ? "Dossards solidaires" : "Pré-inscription", "prereg");
  if (reg.info) add(reg.info, out.length ? "Fiche de la course" : "Infos & inscription", "info");
  if (reg.url && !info.can) add(reg.url, "Site d'inscription", "info");
  if (r.website) add(r.website, "Site officiel", "site");
  if (!out.length) add(`https://www.google.com/search?q=${encodeURIComponent(r.name + " " + r.city + " 2027 inscription")}`, "Trouver l'inscription", "search");
  return out;
}

export const DATE_BADGE = {
  confirmed: { cls: "ok", label: "Date officielle", note: "" },
  listed: { cls: "listed", label: "Date annoncée", note: "Date publiée dans les calendriers de courses, à confirmer par l'organisateur." },
  estimated: { cls: "est", label: "Date estimée", note: "Date estimée d'après les éditions précédentes : elle peut changer." }
};
