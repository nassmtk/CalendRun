// Audit des liens « Infos & inscription » : quelles courses pointent vers un agrégateur
// plutôt que vers le site officiel de l'organisateur ? (lecture seule : ne modifie aucune donnée)
import fs from "node:fs";
import { loadRaces, primaryLink } from "./lib/races.mjs";

const AGGREGATORS = {
  "running.life": "calendrier running.life",
  "milesrepublic.com": "Miles Republic",
  "finishers.com": "Finishers",
  "le-sportif.com": "Le Sportif",
  "sortiraparis.com": "Sortiraparis (média)",
  "paris.fr": "agenda Ville de Paris",
  "google.com": "recherche Google (aucun lien connu)"
};
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, "").replace(/^fr\./, ""); } catch { return ""; } };
const races = loadRaces();
const rows = races.map((r) => {
  const link = primaryLink(r) || `https://www.google.com/search?q=${encodeURIComponent(r.name + " 2027 inscription")}`;
  const h = host(link);
  const agg = Object.keys(AGGREGATORS).find((k) => h === k || h.endsWith("." + k));
  return { r, link, h, agg };
});
const bad = rows.filter((x) => x.agg);
const by = {};
bad.forEach((x) => (by[x.agg] = (by[x.agg] || 0) + 1));

let md = `# Audit des liens d'inscription\n\nGénéré le ${new Date().toISOString().slice(0, 10)} par \`node scripts/audit-links.mjs\` — **aucune donnée n'a été modifiée**.\n\n`;
md += `**${bad.length} / ${races.length}** courses ont un lien principal qui pointe vers un agrégateur ou une page tierce, et non vers le site officiel de l'organisateur.\n\n`;
md += `| Source | Courses |\n|---|---|\n` + Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${AGGREGATORS[k]} | ${n} |`).join("\n") + "\n\n";
md += `## À vérifier / remplacer par le site officiel\n\n| Date | Course | Ville | Lien actuel | Source |\n|---|---|---|---|---|\n`;
md += bad.map(({ r, link, agg }) => `| ${r.date} | ${r.name.replace(/\|/g, "/")} | ${r._place} | ${link} | ${AGGREGATORS[agg]} |`).join("\n") + "\n";
fs.writeFileSync("LINKS_AUDIT.md", md);
console.log(`LINKS_AUDIT.md : ${bad.length} / ${races.length} liens vers un agrégateur`, by);
