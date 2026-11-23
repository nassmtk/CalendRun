// QA de bout en bout des comptes dans un vrai navigateur (Playwright + wrangler pages dev + D1 locale)
// Prérequis (voir docs/COMPTES.md §1.6) :
//   ACCOUNTS_ENABLED=true SITE_URL=http://127.0.0.1:8788 npm run build
//   npx wrangler d1 migrations apply calendrun-test --local --config tests/wrangler.test.toml --persist-to .wrangler/qa
//   npx wrangler pages dev dist --port 8788 --ip 127.0.0.1 --d1 DB=00000000-0000-0000-0000-000000000000 \
//       --persist-to .wrangler/qa --binding AUTH_PEPPER=poivre-dev SITE_URL=http://127.0.0.1:8788
// Usage : node scripts/qa-accounts.mjs [http://127.0.0.1:8788]
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8788";
const OUT = "qa/shots";
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "✓" : "✗"} ${msg}`); if (!ok) fails++; };
const pseudo = "qa_" + Date.now().toString(36);
const PW = "une phrase de passe tres solide";

const browser = await chromium.launch();
const apiCalls = (page) => { const calls = []; page.on("request", (r) => { if (new URL(r.url()).pathname.startsWith("/api/")) calls.push(`${r.method()} ${new URL(r.url()).pathname}`); }); return calls; };

/* ---------- 1. visiteur sans compte ---------- */
console.log("Visiteur sans compte");
let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let p = await ctx.newPage();
let calls = apiCalls(p);
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(BASE + "/", { waitUntil: "load" });
await p.evaluate(() => { localStorage.setItem("calendrun:favs", JSON.stringify(["semi-paris", "paris-versailles"])); localStorage.setItem("calendrun:v1:registered", JSON.stringify(["marathon-paris"])); });
await p.reload({ waitUntil: "load" }); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector("#courses").scrollIntoView()); await p.waitForTimeout(1500);
check(calls.length === 0, `aucune requête d'API (${calls.length})`);
check(await p.locator(".nav .nav-account--in").isVisible(), "« Connexion » dans la barre du haut");

/* ---------- 2. inscription → code de récupération → fusion du localStorage ---------- */
console.log("Inscription");
await p.click(".nav .nav-account--in");
await p.waitForURL("**/compte/");
await p.click("#tab-signup");
await p.fill("#su-pseudo", pseudo);
await p.fill("#su-password", "court");
check((await p.textContent("#su-strength")).includes("Trop court"), "indicateur de robustesse");
await p.fill("#su-password", PW);
check(/Solide|Très solide|Correct/.test(await p.textContent("#su-strength")), `robustesse : ${await p.textContent("#su-strength")}`);
await p.click("#form-signup button[type=submit]");
await p.waitForSelector("#view-code:not([hidden])");
const code = await p.textContent("#recovery-code");
check(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}$/.test(code), `code de récupération affiché (${code})`);
check(await p.isDisabled("#code-continue"), "« Continuer » bloqué tant que la case n'est pas cochée");
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#code-dl")]);
const txt = fs.readFileSync(await dl.path(), "utf8");
check(txt.includes(code) && txt.includes(pseudo), `téléchargement .txt (${dl.suggestedFilename()})`);
await p.screenshot({ path: `${OUT}/compte-code-1440.png`, fullPage: true });
await p.check("#code-ok");
await p.click("#code-continue");
await p.waitForURL(BASE + "/");
await p.waitForTimeout(2500);
let server = await p.evaluate(() => fetch("/api/me").then((r) => r.json()));
check(server.races.fav.sort().join() === "paris-versailles,semi-paris" && server.races.reg.join() === "marathon-paris", "localStorage fusionné dans le compte");
check(await p.locator(".nav .nav-account--user").isVisible(), "avatar dans la barre du haut");

/* ---------- 3. synchronisation groupée, pas de requête par carte ---------- */
console.log("Synchronisation");
calls = apiCalls(p);
await p.reload({ waitUntil: "load" }); await p.waitForTimeout(2500);
await p.evaluate(() => document.querySelector("#courses").scrollIntoView()); await p.waitForTimeout(1500);
check(calls.filter((c) => c === "GET /api/me").length === 1 && calls.length <= 2, `chargement connecté : ${calls.join(", ")}`);
calls.length = 0;
const favBtns = p.locator(".card .fav[aria-pressed=false]");
await favBtns.nth(0).click(); await favBtns.nth(0).click(); await favBtns.nth(0).click();
await p.waitForTimeout(1200);
check(calls.filter((c) => c === "POST /api/me/races").length === 1, `3 clics → 1 seul envoi groupé (${calls.join(", ")})`);
server = await p.evaluate(() => fetch("/api/me").then((r) => r.json()));
check(server.races.fav.length === 5, `favoris enregistrés en base (${server.races.fav.length})`);

/* ---------- 4. menu du compte + Mon compte ---------- */
console.log("Mon compte");
await p.click(".nav .nav-account--user");
check(await p.locator("#acct-pop").isVisible(), "menu du compte ouvert");
await p.keyboard.press("Escape");
check(await p.locator("#acct-pop").isHidden(), "Échap le referme");
await p.goto(BASE + "/compte/"); await p.waitForSelector("#view-account:not([hidden])");
check((await p.textContent("#acct-pseudo")) === pseudo, "page Mon compte");
await p.check('#form-vis input[value="none"]'); await p.waitForTimeout(800);
check((await p.textContent("#vis-status")).includes("personne"), "réglage de visibilité enregistré");
await p.check('#form-vis input[value="friends"]'); await p.waitForTimeout(800);
await p.fill("#pw-current", "mauvais mot de passe");
await p.fill("#pw-next", "un autre mot de passe solide");
await p.click("#form-pw button[type=submit]");
await p.waitForSelector("#pw-error:not([hidden])");
check((await p.textContent("#pw-error")).includes("incorrect") && (await p.getAttribute("#pw-error", "role")) === "alert", "erreur annoncée (role=alert)");
check(await p.locator(".nav .nav-account--user").isVisible(), "toujours connecté après une erreur de mot de passe");
await p.screenshot({ path: `${OUT}/compte-1440.png`, fullPage: true });

/* ---------- 5. déconnexion : appareil vidé ; reconnexion ailleurs : tout revient ---------- */
console.log("Déconnexion / reconnexion");
await p.goto(BASE + "/"); await p.waitForTimeout(1500);
await p.click(".nav .nav-account--user"); await p.click("#acct-pop [data-logout]");
await p.waitForURL(BASE + "/"); await p.waitForTimeout(1500);
const local = await p.evaluate(() => [localStorage.getItem("calendrun:favs"), localStorage.getItem("calendrun:v1:registered")]);
check(local.every((v) => v === "[]" || v === null), "favoris / inscrites vidés de l'appareil");
check((await p.evaluate(() => fetch("/api/me").then((r) => r.status))) === 401, "session invalidée côté serveur");
await ctx.close();

ctx = await browser.newContext({ ...devices["Pixel 7"] });
p = await ctx.newPage();
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(BASE + "/compte/");
await p.fill("#li-pseudo", pseudo); await p.fill("#li-password", "faux mot de passe");
await p.click("#form-login button[type=submit]");
await p.waitForSelector("#li-error:not([hidden])");
check((await p.textContent("#li-error")) === "Pseudo ou mot de passe incorrect.", "mauvais mot de passe : message générique");
await p.fill("#li-password", PW);
await p.click("#form-login button[type=submit]");
await p.waitForURL(BASE + "/"); await p.waitForTimeout(2500);
check((await p.textContent("#menu-sheet [data-count=favs]")) === "5", "reconnexion sur un autre appareil : favoris retrouvés");
await p.tap("#menu-toggle"); await p.waitForTimeout(600);
check(await p.locator("#menu-account .menu-user").isVisible(), "menu mobile : pseudo + Amis / Mon compte / Déconnexion");
await p.screenshot({ path: `${OUT}/compte-menu-390.png` });
await p.goto(BASE + "/compte/"); await p.waitForSelector("#view-account:not([hidden])");
await p.screenshot({ path: `${OUT}/compte-390.png`, fullPage: true });

/* ---------- 6. récupération par code ---------- */
console.log("Récupération");
await p.goto(BASE + "/compte/oubli/");
await p.fill("#rv-pseudo", pseudo); await p.fill("#rv-code", code.toLowerCase()); await p.fill("#rv-password", "nouvelle phrase de passe solide");
await p.click("#form-recover button[type=submit]");
await p.waitForSelector("#view-code:not([hidden])");
const code2 = await p.textContent("#recovery-code");
check(code2 !== code && /^[0-9A-Z-]{23}$/.test(code2), "nouveau code affiché après récupération");
await p.screenshot({ path: `${OUT}/compte-oubli-390.png`, fullPage: true });

/* ---------- 7. suppression ---------- */
console.log("Suppression");
await p.goto(BASE + "/compte/"); await p.waitForSelector("#view-account:not([hidden])");
await p.fill("#del-password", "nouvelle phrase de passe solide");
await p.click("#form-del button[type=submit]");
check((await p.textContent("#del-error")).includes("Coche"), "confirmation exigée");
await p.check("#del-ok");
await p.click("#form-del button[type=submit]");
await p.waitForSelector("#bye");
check((await p.evaluate(() => fetch("/api/me").then((r) => r.status))) === 401, "compte supprimé");

check(errors.length === 0, `aucune erreur JS ${errors.join(" | ")}`);
await browser.close();
console.log(fails ? `\n✗ ${fails} vérification(s) en échec` : "\n✓ QA comptes OK");
process.exit(fails ? 1 : 0);
