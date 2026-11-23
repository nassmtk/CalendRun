// QA de bout en bout des amis (Playwright, deux navigateurs) — mêmes prérequis que qa-accounts.mjs
// Usage : node scripts/qa-friends.mjs [http://127.0.0.1:8788]
// (crée 3 comptes : la limite de 5 inscriptions / heure / IP s'applique aussi en local ;
//  pour enchaîner les essais : wrangler d1 execute … --local --command "DELETE FROM rate_limits")
import { chromium, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] || "http://127.0.0.1:8788";
const OUT = "qa/shots";
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "✓" : "✗"} ${msg}`); if (!ok) fails++; };
const tag = Date.now().toString(36);
const PW = "une phrase de passe tres solide";
const errors = [];

const browser = await chromium.launch();
async function user(name, ctxOpts = { viewport: { width: 1440, height: 900 } }) {
  const ctx = await browser.newContext(ctxOpts);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  await p.goto(BASE + "/compte/");
  const r = await p.evaluate(async ([pseudo, password]) => (await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pseudo, password }) })).status, [name, PW]);
  if (r !== 201) throw new Error("inscription " + name + " : " + r);
  const me = await p.evaluate(() => fetch("/api/me").then((r) => r.json()));
  return { ctx, p, id: me.user.id, csrf: me.csrf, name };
}
const apiCall = (u, method, path, body) => u.p.evaluate(async ([m, pa, b, csrf]) => {
  const r = await fetch("/api/" + pa, { method: m, headers: { "content-type": "application/json", "x-csrf-token": csrf }, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, data: await r.json() };
}, [method, path, body, u.csrf]);

const alice = await user("alice_" + tag);
const bob = await user("bob_" + tag);
await apiCall(bob, "POST", "me/races/merge", { fav: ["semi-paris"], reg: ["marathon-paris", "paris-versailles"] });

/* ---------- demande → acceptation ---------- */
console.log("Demande d'ami");
await alice.p.goto(BASE + "/amis/");
await alice.p.waitForSelector("#view-friends:not([hidden])");
await alice.p.fill("#add-pseudo", bob.name.toUpperCase());
await alice.p.click("#form-add button[type=submit]");
await alice.p.waitForFunction(() => document.querySelector("#fr-status").textContent.length > 0);
check((await alice.p.textContent("#fr-status")).includes("Si ce pseudo existe"), "message générique après envoi");
await alice.p.waitForFunction((n) => document.querySelector("#list-out").textContent.includes(n), bob.name, { timeout: 5000 }).catch(() => {});
check((await alice.p.textContent("#list-out")).includes(bob.name), "demande envoyée listée");

await bob.p.goto(BASE + "/"); await bob.p.waitForTimeout(2000);
check((await bob.p.textContent(".nav .nav-account--user .dot").catch(() => "")) === "1", "badge « 1 demande » sur l'avatar de bob");
await bob.p.goto(BASE + "/amis/");
await bob.p.waitForSelector("#list-in .person");
await bob.p.screenshot({ path: `${OUT}/amis-demande-1440.png`, fullPage: true });
await bob.p.click(`#list-in [data-act="accept"]`);
await bob.p.waitForFunction(() => document.querySelector("#fr-status").textContent.includes("acceptée"));
await bob.p.waitForFunction((n) => document.querySelector("#list-friends").textContent.includes(n), alice.name, { timeout: 5000 }).catch(() => {});
check((await bob.p.textContent("#list-friends")).includes(alice.name), "acceptée : alice dans les amis de bob");

/* ---------- visibilité : cartes, fiche, filtre, profil ---------- */
console.log("Visibilité");
await alice.p.goto(BASE + "/?view=cards"); await alice.p.waitForTimeout(2500);
const pals = alice.p.locator('.card[data-id="marathon-paris"] .pals');
await pals.scrollIntoViewIfNeeded(); await alice.p.waitForTimeout(500);
check((await pals.textContent()).includes("1 pote inscrit"), `pastille sur la carte : « ${(await pals.textContent()).trim().replace(/\s+/g, " ")} »`);
check((await alice.p.locator('.card[data-id="semi-paris"] .pals').textContent()).includes("1 en favori"), "favori affiché");
await pals.click();
check(await alice.p.locator("#pals-pop").isVisible() && (await alice.p.textContent("#pals-pop")).includes(bob.name), "au clic : la liste des potes");
check(await alice.p.locator("#overlay").isHidden(), "le clic n'ouvre pas la fiche");
await alice.p.screenshot({ path: `${OUT}/amis-carte-1440.png` });
await alice.p.keyboard.press("Escape");
check(await alice.p.locator("#pals-pop").isHidden(), "Échap ferme la liste");
await alice.p.click("label.switch--pals"); await alice.p.waitForTimeout(800);
const n = await alice.p.textContent("#results-count");
check(/^3 courses/.test(n.trim()), `filtre « Courses de mes potes » : ${n.trim()}`);
await alice.p.click("#reset"); await alice.p.waitForTimeout(500);
check(!(await alice.p.isChecked("#f-pals")), "« Réinitialiser » décoche le filtre");
await alice.p.locator('.card[data-id="marathon-paris"]').click(); await alice.p.waitForTimeout(1200);
check(await alice.p.locator("#sheet .pals").isVisible(), "pastille dans la fiche");
await alice.p.keyboard.press("Escape");

await alice.p.goto(BASE + "/amis/?u=" + bob.id);
await alice.p.waitForSelector("#pf-reg li");
check((await alice.p.textContent("#pf-reg")).match(/J-\d+/) && (await alice.p.textContent("#pf-fav")).includes("Semi"), "profil : inscriptions à venir avec J-x + favoris");
await alice.p.screenshot({ path: `${OUT}/amis-profil-1440.png`, fullPage: true });

/* ---------- mobile ---------- */
for (const w of [390, 360]) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: w, height: 800 } });
  await ctx.addCookies(await alice.ctx.cookies());
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`mobile ${w}: ${e.message}`));
  await p.goto(BASE + "/amis/"); await p.waitForSelector("#view-friends:not([hidden])");
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  check(!overflow, `page Amis sans débordement à ${w} px`);
  await p.screenshot({ path: `${OUT}/amis-${w}.png`, fullPage: true });
  await p.goto(BASE + "/?view=cards"); await p.waitForTimeout(2500);
  await p.locator('.card[data-id="marathon-paris"] .pals').scrollIntoViewIfNeeded(); await p.waitForTimeout(400);
  await p.locator('.card[data-id="marathon-paris"] .pals').tap(); await p.waitForTimeout(300);
  check(await p.locator("#pals-pop").isVisible(), `liste des potes au tap (${w} px)`);
  await p.screenshot({ path: `${OUT}/amis-carte-${w}.png` });
  await ctx.close();
}

/* ---------- IDOR depuis le navigateur ---------- */
console.log("IDOR");
const carol = await user("carol_" + tag);
check((await apiCall(carol, "GET", "friends/profile/" + bob.id)).status === 404, "carol (non amie) ne voit pas le profil de bob");
check(Object.keys((await apiCall(carol, "GET", "friends/activity")).data.races).length === 0, "carol : aucune activité");

/* ---------- blocage ---------- */
console.log("Blocage");
await bob.p.goto(BASE + "/amis/"); await bob.p.waitForSelector("#list-friends .person");
await bob.p.click(`#list-friends [data-act="block"]`);
check((await bob.p.textContent(`#list-friends [data-act="block"]`)) === "Confirmer ?", "blocage : confirmation en deux temps");
await bob.p.click(`#list-friends [data-act="block"]`);
await bob.p.waitForFunction(() => document.querySelector("#fr-status").textContent.includes("bloqué"));
await bob.p.waitForFunction((n) => document.querySelector("#list-blocked").textContent.includes(n), alice.name, { timeout: 5000 }).catch(() => {});
check((await bob.p.textContent("#list-blocked")).includes(alice.name), "alice dans les bloqués");
await alice.p.goto(BASE + "/?view=cards"); await alice.p.waitForTimeout(2500);
check((await alice.p.locator(".pals").count()) === 0 && (await alice.p.locator("#f-pals").count()) === 0, "après blocage : plus aucune pastille ni filtre");
check((await apiCall(alice, "GET", "friends/profile/" + bob.id)).status === 404, "après blocage : profil 404");

check(errors.length === 0, `aucune erreur JS ${errors.join(" | ")}`);
await browser.close();
console.log(fails ? `\n✗ ${fails} vérification(s) en échec` : "\n✓ QA amis OK");
process.exit(fails ? 1 : 0);
