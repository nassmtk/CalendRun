import "./lib/env.mjs";
// Après `vite build` : pages statiques des courses (SEO), images Open Graph, sitemap.xml, robots.txt
import fs from "node:fs";
import path from "node:path";
import { BRAND, siteUrl, fill } from "../brand.config.js";
import { loadRaces, TYPE_LABEL, DEPTS } from "./lib/races.mjs";
import { regInfo, linksFor, DATE_BADGE } from "./lib/race-info.mjs";
import { raceOg, homeOg } from "./og.mjs";

const DIST = "dist";
const SITE = siteUrl();
const host = SITE.replace(/^https?:\/\//, "");
const races = loadRaces();
const count = races.length;
const today = new Date();
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const fmtKm = (km) => (Number.isInteger(km) ? String(km) : Math.abs(km - 42.195) < 0.01 ? "42,195" : km.toFixed(1).replace(".", ",")) + " km";

const t0 = Date.now();
const template = fs.readFileSync(path.join(DIST, "course-template.html"), "utf8");
fs.mkdirSync(path.join(DIST, "og"), { recursive: true });

for (const r of races) {
  const url = `${SITE}/courses/${r._slug}/`;
  const ogImg = `${SITE}/og/${r._slug}.png`;
  const info = regInfo(r, today);
  const badge = DATE_BADGE[r.dateStatus] || DATE_BADGE.listed;
  const m = r._date.getUTCMonth();
  const desc = `${r.name} : ${r._dateLong} à ${r._place} (${DEPTS[r.dept] || r.dept}). ${r._distLabel}. ${info.label}, liens d'inscription et alertes.${r.dateStatus !== "confirmed" ? " " + badge.label + "." : ""}`.slice(0, 300);
  const links = linksFor(r, today);
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: r.name,
    sport: "Course à pied",
    startDate: r.date,
    ...(r.endDate ? { endDate: r.endDate } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    url,
    image: [ogImg],
    description: desc,
    location: {
      "@type": "Place",
      name: r._place,
      address: { "@type": "PostalAddress", addressLocality: r.city, addressRegion: DEPTS[r.dept] || BRAND.REGION, addressCountry: "FR" },
      ...(r.lat != null ? { geo: { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lng } } : {})
    },
    ...(r.website && !/running\.life|milesrepublic|finishers|sortiraparis|paris\.fr/.test(r.website) ? { organizer: { "@type": "Organization", name: r.sponsor ? `${r.name} (${r.sponsor})` : r.name, url: r.website } } : {})
  };
  const vars = {
    TITLE: esc(`${r.name} ${BRAND.YEAR} — ${r._date.getUTCDate()} ${MONTHS_LONG[m]}, ${r._place} | ${BRAND.SITE_NAME}`),
    OG_TITLE: esc(`${r.name} — ${r._date.getUTCDate()} ${MONTHS_LONG[m]} ${BRAND.YEAR}`),
    OG_ALT: esc(`${r.name}, ${r._dateLong}, ${r._place}`),
    DESCRIPTION: esc(desc),
    URL: esc(url),
    OG_IMAGE: esc(ogImg),
    JSONLD: JSON.stringify(jsonld).replace(/</g, "\\u003c"),
    ID: esc(r.id),
    TYPE: esc(r.type),
    NAME: esc(r.name),
    KICKER: esc([r.sponsor, r.edition].filter(Boolean).join(" · ") || TYPE_LABEL[r.type] || "Course"),
    MONTH_INDEX: String(m),
    MONTH_NAME: MONTHS_LONG[m],
    MONTH_SHORT: MONTHS_SHORT[m],
    DAY: `${r._date.getUTCDate()}${r.endDate && r.endDate !== r.date ? "–" + r._end.getUTCDate() : ""}`,
    WEEKDAY: WEEKDAYS[r._date.getUTCDay()],
    DATE_LONG: esc(r._dateLong),
    PLACE: esc(r._place),
    DEPT: esc(r.dept),
    DATE_CLS: badge.cls,
    DATE_BADGE: badge.label,
    DATE_NOTE: esc(badge.note),
    TAGLINE: esc(r.tagline || `${TYPE_LABEL[r.type] || "Course"} à ${r._place} — ${r._distLabel}.`),
    STATUS_KEY: info.key,
    STATUS_LABEL: esc(info.label),
    LINKS: links.map((l, i) => `<a class="btn ${i === 0 ? "btn--primary" : "btn--ghost"} btn--block" href="${esc(l.href)}" target="_blank" rel="noopener noreferrer">${esc(l.kind === "register" && info.key !== "lottery" ? "Prendre mon dossard" : l.label)} <span class="host">${esc(hostOf(l.href))}</span></a>`).join(""),
    DIST_ROWS: r.distances.length
      ? r.distances.map((d) => `<tr><td>${esc(d.label)}</td><td>${d.km != null ? fmtKm(d.km) : "—"}</td><td class="${d.dplus == null ? "is-empty" : ""}">${d.dplus == null ? "—" : (d.elevApprox ? "~" : "") + d.dplus + " m"}</td><td class="${d.dminus == null ? "is-empty" : ""}">${d.dminus == null ? "—" : (d.elevApprox ? "~" : "") + d.dminus + " m"}</td></tr>`).join("")
      : `<tr><td colspan="4">Formats ${BRAND.YEAR} pas encore publiés.</td></tr>`
  };
  const html = template.replace(/\[\[(\w+)\]\]/g, (mm, k) => (k in vars ? vars[k] : mm));
  const dir = path.join(DIST, "courses", r._slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html);
  fs.writeFileSync(path.join(DIST, "og", `${r._slug}.png`), await raceOg(r, host));
}
fs.unlinkSync(path.join(DIST, "course-template.html"));

// image OG de l'accueil
fs.writeFileSync(path.join(DIST, "og", "home.png"), await homeOg(races, count, fill(BRAND.SUBTAGLINE, { count }), host));

// sitemap + robots
const lastmod = today.toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, pr: "1.0", cf: "daily" },
  ...races.map((r) => ({ loc: `${SITE}/courses/${r._slug}/`, pr: "0.8", cf: "weekly" })),
  { loc: `${SITE}/contact/`, pr: "0.3", cf: "yearly" },
  { loc: `${SITE}/mentions-legales/`, pr: "0.1", cf: "yearly" },
  { loc: `${SITE}/confidentialite/`, pr: "0.1", cf: "yearly" }
];
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${lastmod}</lastmod><changefreq>${u.cf}</changefreq><priority>${u.pr}</priority></url>`).join("\n")}\n</urlset>\n`);
fs.writeFileSync(path.join(DIST, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /alertes/\n\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`postbuild : ${races.length} pages course + ${races.length + 1} images OG + sitemap (${urls.length} URL) en ${((Date.now() - t0) / 1000).toFixed(1)} s — SITE_URL=${SITE}`);
