// Garde-fou : plus aucun ancien domaine (sources suivies par git + dist/ s'il existe),
// et le domaine / les adresses viennent bien de brand.config.js.
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BRAND } from "../brand.config.js";

const OLD = /calendrun\.fr|calendrun\.pages\.dev|exemple\.fr/i;
// fichiers qui citent volontairement l'ancien domaine (redirection documentée, ce test)
const ALLOW = new Set(["scripts/test-domain.mjs", "README.md", "LAUNCH_CHECKLIST.md", ".env.example", "docs/COMPTES.md", "wrangler.toml"]);
const SKIP = /^(qa\/|package-lock\.json$|public\/.*\.(png|ico)$)/;
const bad = [];
const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
for (const f of files) {
  if (SKIP.test(f) || !fs.existsSync(f)) continue;
  const txt = fs.readFileSync(f, "utf8");
  txt.split("\n").forEach((line, i) => {
    if (!OLD.test(line)) return;
    // dans les fichiers autorisés, seules les mentions de calendrun.pages.dev (source de la redirection) sont permises
    if (ALLOW.has(f) && !/calendrun\.fr|exemple\.fr/i.test(line)) return;
    bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
if (fs.existsSync("dist")) {
  for (const f of walk("dist").filter((f) => /\.(html|js|css|xml|txt|webmanifest|json)$|_headers$|_redirects$/.test(f))) {
    const txt = fs.readFileSync(f, "utf8");
    if (OLD.test(txt)) bad.push(`${f}: ancien domaine`);
    // adresses e-mail jamais en clair dans le build
    for (const m of [BRAND.CONTACT_EMAIL, BRAND.COURSES_EMAIL, BRAND.SENDER_EMAIL]) if (txt.includes(m)) bad.push(`${f}: adresse en clair ${m}`);
  }
}
const ok = (c, m) => { if (!c) bad.push(m); };
ok(BRAND.SITE_URL === "https://calend.run", "BRAND.SITE_URL doit valoir https://calend.run");
ok(BRAND.CONTACT_EMAIL === "contact@calend.run", "CONTACT_EMAIL");
ok(BRAND.COURSES_EMAIL === "courses@calend.run", "COURSES_EMAIL");
ok(BRAND.SENDER_EMAIL === "alertes@calend.run", "SENDER_EMAIL");
// tous les liens mail du code passent par data-mail="contact|courses" (jamais un mailto: écrit en dur)
for (const f of files.filter((f) => /\.(html|js|mjs)$/.test(f) && !f.startsWith("scripts/") && !f.startsWith("functions/") && !f.startsWith("workers/"))) {
  const txt = fs.readFileSync(f, "utf8");
  if (/href=["']mailto:/i.test(txt)) bad.push(`${f}: mailto écrit en dur (utiliser data-mail)`);
}
if (bad.length) { console.error("✗ domaine / e-mails :\n  " + bad.join("\n  ")); process.exit(1); }
console.log("✓ domaine calend.run partout, adresses issues de la config, aucune en clair dans dist/");
