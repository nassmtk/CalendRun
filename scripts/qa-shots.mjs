// QA visuelle : captures d'écran de scénarios à plusieurs largeurs (puppeteer-core + Chrome installé)
// Usage : node scripts/qa-shots.mjs [base-url] [scénario…]
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:5173";
const only = process.argv.slice(3);
const OUT = "qa/shots";
fs.mkdirSync(OUT, { recursive: true });
const WIDTHS = [[1440, 900], [1024, 768], [390, 844]];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const SCENARIOS = {
  home: async (p) => { await p.goto(BASE + "/", { waitUntil: "load" }); await wait(3500); },
  filters: async (p) => {
    await p.goto(BASE + "/?view=cards", { waitUntil: "load" }); await wait(800);
    await p.evaluate(() => document.querySelector("#toolbar").scrollIntoView()); await wait(1200);
  },
  calendar: async (p) => {
    await p.goto(BASE + "/?view=calendar", { waitUntil: "load" }); await wait(600);
    await p.evaluate(() => document.querySelector("#toolbar").scrollIntoView()); await wait(1500);
  },
  map: async (p) => {
    await p.goto(BASE + "/?view=map", { waitUntil: "load" }); await wait(600);
    await p.evaluate(() => document.querySelector("#results-count").scrollIntoView()); await wait(2500);
  },
  favsMonth: async (p) => {
    await p.goto(BASE + "/?view=cards", { waitUntil: "load" });
    await p.evaluate(() => { localStorage.setItem("allure:favs", JSON.stringify(["paris-versailles", "semi-paris"])); localStorage.setItem("allure:v1:registered", JSON.stringify(["marathon-paris"])); });
    await p.reload({ waitUntil: "load" }); await wait(500);
    await p.evaluate(() => document.querySelector('[data-month="0"]').click()); await wait(400);
    await p.evaluate(() => document.querySelector("#nav-favs").click()); await wait(1800);
  },
  sheet: async (p) => {
    await p.goto(BASE + "/?view=cards", { waitUntil: "load" }); await wait(500);
    await p.evaluate(() => window.ALLURE.openSheet("paris-versailles")); await wait(1200);
  },
  notfound: async (p) => { await p.goto(BASE + "/page-qui-n-existe-pas", { waitUntil: "load" }); await wait(800); },
  legal: async (p) => { await p.goto(BASE + "/mentions-legales/", { waitUntil: "load" }); await wait(500); },
  privacy: async (p) => { await p.goto(BASE + "/confidentialite/", { waitUntil: "load" }); await wait(500); },
  race: async (p) => { await p.goto(BASE + "/courses/paris-versailles-2027/", { waitUntil: "load" }); await wait(1500); }
};

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
for (const [name, run] of Object.entries(SCENARIOS)) {
  if (only.length && !only.includes(name)) continue;
  for (const [w, h] of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1, isMobile: w < 500, hasTouch: w < 500 });
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") errors.push(`[${name} ${w}] ${m.type()}: ${m.text()}`); });
    page.on("pageerror", (e) => errors.push(`[${name} ${w}] pageerror: ${e.message}`));
    try { await run(page); } catch (e) { errors.push(`[${name} ${w}] scenario: ${e.message}`); }
    await page.screenshot({ path: `${OUT}/${name}-${w}.png` });
    await page.close();
  }
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "Aucune erreur console.");
