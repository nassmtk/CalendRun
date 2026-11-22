// Lighthouse mobile ×N sur une URL → médiane des scores et des métriques clés
// Usage : node scripts/qa-lighthouse.mjs [url] [runs] [fichier-sortie.json]
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:4173/";
const runs = Number(process.argv[3] || 3);
const out = process.argv[4] || "qa/lighthouse.json";
const chrome = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const res = [];
for (let i = 0; i < runs; i++) {
  const file = `qa/lh-run-${i}.json`;
  execFileSync(process.execPath, ["node_modules/lighthouse/cli/index.js", url, "--quiet", "--chrome-flags=--headless=new",
    "--only-categories=performance,accessibility,best-practices,seo", "--output=json", `--output-path=${file}`], { env: { ...process.env, CHROME_PATH: chrome }, stdio: "ignore" });
  const r = JSON.parse(fs.readFileSync(file, "utf8"));
  res.push({
    scores: Object.fromEntries(Object.entries(r.categories).map(([k, v]) => [k, Math.round(v.score * 100)])),
    m: Object.fromEntries(["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"].map((id) => [id, r.audits[id].numericValue]))
  });
}
const summary = {
  url, runs,
  scores: Object.fromEntries(Object.keys(res[0].scores).map((k) => [k, median(res.map((x) => x.scores[k]))])),
  metrics: Object.fromEntries(Object.keys(res[0].m).map((k) => [k, Math.round(median(res.map((x) => x.m[k])) * 1000) / 1000]))
};
fs.writeFileSync(out, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
