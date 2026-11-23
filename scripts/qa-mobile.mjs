// QA mobile tactile (Playwright) : barre du haut + tiroir des départements + menu compact
// Profils : iOS Safari (WebKit, iPhone 13) et Android Chrome (Chromium, Pixel 7), isMobile + hasTouch,
// largeurs 360 / 390 / 430 px. Captures dans qa/shots/mobile-*.png.
// Usage : npm run build && npx vite preview --port 4173 & node scripts/qa-mobile.mjs http://localhost:4173
import { chromium, webkit, devices } from "@playwright/test";
import fs from "node:fs";

const BASE = process.argv[2] || "http://localhost:4173";
const OUT = "qa/shots";
fs.mkdirSync(OUT, { recursive: true });
const PROFILES = [
  ["ios-safari", webkit, devices["iPhone 13"]],
  ["android-chrome", chromium, devices["Pixel 7"]]
];
const WIDTHS = [360, 390, 430];
let fails = 0;
const check = (ok, msg) => { console.log(`  ${ok ? "✓" : "✗"} ${msg}`); if (!ok) fails++; };

// attend la fin de l'animation d'ouverture (jusqu'à 1,5 s) avant de juger
async function sheetVisible(p, sel, { wait = true } = {}) {
  if (wait) await p.waitForFunction((sel) => { const el = document.querySelector(sel); if (!el || el.hidden) return true; const r = el.getBoundingClientRect(); return r.bottom <= innerHeight + 1; }, sel, { timeout: 1500 }).catch(() => {});
  return p.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= innerHeight + 1 && r.height > 100;
  }, sel);
}
const locked = (p) => p.evaluate(() => document.documentElement.classList.contains("scroll-locked"));

for (const [name, engine, dev] of PROFILES) {
  const browser = await engine.launch();
  for (const w of WIDTHS) {
    console.log(`\n${name} @ ${w}px`);
    const ctx = await browser.newContext({ ...dev, viewport: { width: w, height: 800 }, screen: { width: w, height: 800 } });
    const p = await ctx.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(BASE + "/", { waitUntil: "load" });
    // une course inscrite pour afficher le minuteur
    await p.evaluate(() => localStorage.setItem("calendrun:v1:registered", JSON.stringify(["marathon-paris"])));
    await p.reload({ waitUntil: "load" });
    await p.waitForTimeout(1800);
    await p.evaluate(() => window.scrollTo(0, 600)); await p.waitForTimeout(400);

    /* --- barre du haut --- */
    const nav = await p.evaluate(() => {
      const n = document.querySelector(".nav");
      const r = n.getBoundingClientRect();
      const kids = [...n.querySelectorAll(".brand-mark, #dept-toggle, #nav-timer:not([hidden]), #menu-toggle")].map((e) => e.getBoundingClientRect());
      const mark = document.querySelector(".brand-mark").getBoundingClientRect();
      const timer = document.querySelector("#nav-timer");
      return {
        h: r.height, overflow: n.scrollWidth > n.clientWidth + 1,
        oneLine: kids.every((k) => k.top >= r.top - 1 && k.bottom <= r.bottom + 1),
        noOverlap: kids.every((a, i) => kids.every((b, j) => i >= j || a.right <= b.left + 0.5 || b.right <= a.left + 0.5)),
        logo: mark.width > 20 && mark.left >= r.left,
        // chiffres roulants : on lit le jour dans l'aria-label et on vérifie que l'horloge h:m:s est masquée
        timer: timer.hidden ? "(caché)"
          : getComputedStyle(timer.querySelector(".t-clock")).display === "none" && getComputedStyle(timer.querySelector(".t-j")).display !== "none"
            ? `J-${parseInt(timer.getAttribute("aria-label"), 10)}` : "horloge visible"
      };
    });
    check(nav.h <= 58 && nav.oneLine && !nav.overflow, `barre sur une seule ligne (h=${nav.h}px)`);
    check(nav.noOverlap, "aucun chevauchement (logo, Départements, minuteur, menu)");
    check(nav.logo, "logo visible");
    check(/^J-\d+$/.test(nav.timer), `minuteur affiche « ${nav.timer} »`);

    /* --- tiroir des départements --- */
    const y0 = await p.evaluate(() => scrollY);
    await p.tap("#dept-toggle"); await p.waitForTimeout(450);
    check(await sheetVisible(p, "#dept-sheet"), "tiroir ouvert, entièrement dans l'écran");
    check(await locked(p), "défilement de la page bloqué");
    const cells = await p.$$eval("#dept-grid .dcell", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left }; }));
    check(cells.length === 8, `8 départements (${cells.length})`);
    check(cells.every((c) => c.h >= 44 && c.w >= 44), "cibles tactiles ≥ 44 px");
    check(new Set(cells.map((c) => Math.round(c.x))).size === 2, "grille de 2 colonnes");
    const hit = await p.evaluate(() => {
      const c = document.querySelector('#dept-grid .dcell[data-dept="92"]'); const r = c.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".dcell") === c;
    });
    check(hit, "rien ne recouvre les départements (elementFromPoint)");
    await p.tap('#dept-grid .dcell[data-dept="92"]'); await p.waitForTimeout(200);
    await p.tap('#dept-grid .dcell[data-dept="75"]'); await p.waitForTimeout(200);
    const sel = await p.evaluate(() => ({
      pressed: [...document.querySelectorAll("#dept-grid .dcell[aria-pressed=true]")].map((e) => e.dataset.dept),
      badge: document.querySelector("#dept-count").textContent, see: document.querySelector("#dept-see").textContent
    }));
    check(sel.pressed.join() === "75,92" && sel.badge === "2", `sélection au tap (75 + 92, badge ${sel.badge})`);
    check(/Voir les \d+ courses/.test(sel.see), `bouton « ${sel.see} »`);
    await p.screenshot({ path: `${OUT}/mobile-${name}-${w}-depts.png` });

    await p.keyboard.press("Escape"); await p.waitForTimeout(400);
    check(!(await sheetVisible(p, "#dept-sheet")) && !(await locked(p)), "Échap ferme et rend le défilement");
    check(Math.abs((await p.evaluate(() => scrollY)) - y0) < 2, "position de défilement conservée");

    await p.tap("#dept-toggle"); await p.waitForTimeout(450);
    await p.tap(".sheet-scrim", { position: { x: w / 2, y: 30 } }); await p.waitForTimeout(400);
    check(!(await sheetVisible(p, "#dept-sheet")), "tap sur le fond ferme");

    await p.tap("#dept-toggle"); await p.waitForTimeout(450);
    const head = await p.locator("#dept-sheet .bsheet-head").boundingBox();
    await p.mouse.move(head.x + 40, head.y + 12); await p.mouse.down();
    for (let i = 1; i <= 8; i++) { await p.mouse.move(head.x + 40, head.y + 12 + i * 30); await p.waitForTimeout(16); }
    await p.mouse.up(); await p.waitForTimeout(450);
    check(!(await sheetVisible(p, "#dept-sheet")) && !(await locked(p)), "glisser vers le bas ferme");

    await p.tap("#dept-toggle"); await p.waitForTimeout(450);
    await p.tap("#dept-clear-btn"); await p.waitForTimeout(150);
    check((await p.$eval("#dept-count", (e) => e.hidden)), "« Effacer » vide la sélection");
    await p.tap('#dept-grid .dcell[data-dept="78"]');
    await p.tap("#dept-see"); await p.waitForTimeout(1400);
    const res = await p.evaluate(() => ({ open: !document.querySelector("#dept-sheet").hidden, top: document.querySelector("#results-count").getBoundingClientRect().top }));
    check(!res.open && res.top < 400, "« Voir les X courses » ferme et montre les résultats");

    /* --- menu compact --- */
    await p.tap("#menu-toggle"); await p.waitForTimeout(450);
    check(await sheetVisible(p, "#menu-sheet"), "menu ouvert");
    await p.screenshot({ path: `${OUT}/mobile-${name}-${w}-menu.png` });
    await p.tap('#menu-sheet [data-list="registered"]'); await p.waitForTimeout(800);
    check(!(await sheetVisible(p, "#menu-sheet")) && p.url().includes("list=registered"), "Inscrites depuis le menu");
    await p.screenshot({ path: `${OUT}/mobile-${name}-${w}-nav.png`, clip: { x: 0, y: 0, width: w, height: 90 } });

    check(errors.length === 0, `aucune erreur JS ${errors.length ? errors.join(" | ") : ""}`);
    await ctx.close();
  }
  await browser.close();
}
console.log(fails ? `\n✗ ${fails} vérification(s) en échec` : "\n✓ QA mobile OK");
process.exit(fails ? 1 : 0);
