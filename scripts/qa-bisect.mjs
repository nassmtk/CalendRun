// QA : bissection perf — injecte du CSS / JS avant chargement et mesure les tâches longues (mobile, CPU ×4)
import puppeteer from "puppeteer-core";

const url = "http://127.0.0.1:5173/";
const variants = {
  base: "",
  noGlow: ".hero-glow{display:none!important}",
  noGrain: ".grain{display:none!important}",
  noBlurNav: ".nav,.filters-fab,.hero-tip{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}",
  noAnim: "*{animation:none!important}",
  noHero3d: ".hero-3d{display:none!important}",
  noCards: "#results{display:none!important}"
};
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
for (const [name, css] of Object.entries(variants)) {
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluateOnNewDocument((css) => {
    window.__lt = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(e.duration))).observe({ type: "longtask", buffered: true });
    if (css) document.addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = css; document.head.append(s); });
  }, css);
  await page.goto(url, { waitUntil: "load" });
  await new Promise((r) => setTimeout(r, 7000));
  const lt = await page.evaluate(() => window.__lt);
  console.log(name.padEnd(10), "tasks", String(lt.length).padStart(3), " total", Math.round(lt.reduce((a, b) => a + b, 0)), "ms");
  await page.close();
}
await browser.close();
