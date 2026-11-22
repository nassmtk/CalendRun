// Test de non-régression de la logique (jsdom) : filtres, vues, listes, inscrit, liens.
// Usage : node scripts/test-logic.cjs   (jsdom requis : npm i -D jsdom, ou JSDOM_PATH=...)
const { JSDOM, VirtualConsole } = require(process.env.JSDOM_PATH || "jsdom");
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..") + "/";
const html = fs.readFileSync(root + "index.html", "utf8").replace(/<script[^>]*><\/script>/g, "");
const vc = new VirtualConsole(); const errs = [];
vc.on("jsdomError", (e) => errs.push(e.message));
const dom = new JSDOM(html, { runScripts: "outside-only", virtualConsole: vc, url: "http://localhost/" });
const w = dom.window, d = w.document;
w.matchMedia = () => ({ matches: false, addEventListener() {} });
w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
w.HTMLElement.prototype.scrollIntoView = function () {};
w.CSS = { escape: (s) => s };
for (const f of ["config.js", "data/races.js", "src/app.js"]) w.eval(fs.readFileSync(root + f, "utf8"));
const A = w.ALLURE; A.boot();
const $ = (s) => d.querySelector(s), $$ = (s) => [...d.querySelectorAll(s)];
const click = (el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
let fails = 0;
const ok = (cond, label, extra = "") => { console.log(cond ? "  ✓" : "  ✗", label, extra); if (!cond) fails++; };
const count = () => +($("#results-count b") || {}).textContent;

console.log("Liste principale");
ok(count() === 149, "149 courses au départ");
click($('[data-cat="semi"]')); ok(count() === 13, "filtre semi = 13"); click($('[data-cat="semi"]'));
click($('[data-month="2"]')); ok(count() === 34, "mars = 34"); click($('[data-month="2"]'));
ok($$("#results .card").every((c) => c.querySelector(".cta-row a[href]")), "chaque carte a un lien");

console.log("Phase 1 — Favoris / Inscrites ignorent les filtres de la liste");
click($('[data-fav="paris-versailles"]')); click($('[data-fav="semi-paris"]'));
click($('[data-reg="marathon-paris"]'));
click($('[data-month="0"]')); ok(count() === 22, "janvier sélectionné = 22");
click($("#nav-favs"));
ok(count() === 2, "Favoris : 2 courses malgré janvier", $("#results-count").textContent);
ok(A.state.month === null, "Favoris : filtres locaux vierges");
click($('[data-month="8"]')); ok(count() === 1, "filtre local septembre dans Favoris = 1");
click($('[data-month="0"]'));
ok($("#results .empty") && /2 courses masquées/.test($("#results .empty").textContent), "état vide intelligent : « 2 courses masquées »");
click($("#nav-reg"));
ok(count() === 1 && A.state.month === null, "Inscrites : repart de zéro (1 course)");
click($("#nav-reg"));
ok(A.state.list === "all" && A.state.month === 0 && count() === 22, "retour liste principale : janvier restauré (22)");
click($('[data-month="0"]'));

console.log("Vues");
click($("#tab-calendar")); ok($$("#results .card").length === 0 && $$("#results .cal-month").length > 0, "calendrier seul");
click($("#tab-map")); ok($$("#results .cal-month").length === 0 && $("#results .mapview"), "carte seule");
click($("#tab-grid")); ok($$("#results .card").length === 149, "cartes seules");

console.log("Erreurs JS :", errs.length ? errs : "aucune");
w.localStorage.clear();
process.exitCode = fails || errs.length ? 1 : 0;
console.log(fails ? `${fails} échec(s)` : "Tout est OK");
