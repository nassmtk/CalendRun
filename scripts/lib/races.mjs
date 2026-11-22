// Charge data/races.js (fichier navigateur) dans Node et normalise comme le front
// (même expansion du format compact que src/app.js). Utilisé par les scripts de build.
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const WEEKDAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const TYPE_LABEL = { route: "Route", trail: "Trail", urban: "Urban trail", cross: "Cross", backyard: "Backyard & ultra", relais: "Relais" };
export const DEPTS = { "75": "Paris", "77": "Seine-et-Marne", "78": "Yvelines", "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis", "94": "Val-de-Marne", "95": "Val-d'Oise" };

const fmtKm = (km) => (Number.isInteger(km) ? String(km) : Math.abs(km - 42.195) < 0.01 ? "42,195" : km.toFixed(1).replace(".", ",")) + " km";
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };

export function loadRaces() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "data/races.js"), "utf8"), ctx);
  const W = ctx.window;
  const races = (W.RACES || []).map((r) => ({ ...r }));
  const ids = new Set(races.map((r) => r.id));
  for (const [date, end, name, place, type, dists, slug, opt = {}] of W.RACES_COMPACT || []) {
    if (ids.has(slug)) continue;
    ids.add(slug);
    const c = W.CITIES[place] || ["", 48.8566, 2.3522];
    const isParis = place.startsWith("Paris ");
    const [city, arr] = isParis ? ["Paris", place.slice(6)] : [place, ""];
    races.push({
      id: slug, name, sponsor: "", date, endDate: end || undefined, dateStatus: opt.dateStatus || "listed",
      city, arr, dept: c[0], lat: c[1], lng: c[2], type,
      distances: dists.map((d) => (typeof d === "number" ? { label: fmtKm(d), km: d } : { label: d, km: null })),
      registration: { status: opt.status || "check", note: opt.note, url: opt.url, info: "https://running.life/en/event/" + slug },
      website: "", tagline: "", tags: opt.note ? [opt.note] : [], compact: true
    });
  }
  for (const r of races) {
    r._date = parse(r.date);
    r._end = r.endDate ? parse(r.endDate) : r._date;
    r._distLabel = r.distances.length ? r.distances.map((d) => (d.km != null ? fmtKm(d.km) : d.label)).slice(0, 4).join(" / ") : "Formats à venir";
    r._dateLong = `${WEEKDAYS[r._date.getUTCDay()]} ${r._date.getUTCDate()} ${MONTHS_LONG[r._date.getUTCMonth()]} ${r._date.getUTCFullYear()}`;
    r._slug = `${r.id}-2027`;
    r._place = `${r.city}${r.arr ? " " + r.arr : ""}`;
  }
  return races.sort((a, b) => a._date - b._date);
}

/** premier lien utile d'une course (même priorité que le front) */
export function primaryLink(r) {
  const reg = r.registration || {};
  return reg.url || reg.preUrl || reg.info || r.website || "";
}
