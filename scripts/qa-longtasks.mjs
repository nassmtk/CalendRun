// QA : mesure les tâches longues (> 50 ms) après chargement, en émulation mobile (CPU ×4)
import puppeteer from "puppeteer-core";

const url = process.argv[2] || "http://127.0.0.1:4173/";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.evaluateOnNewDocument(() => {
  window.__lt = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: "longtask", buffered: true });
});
page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text()));
await page.goto(url, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 8000));
const lt = await page.evaluate(() => window.__lt);
console.log("long tasks:", lt.length, "total ms:", lt.reduce((a, [, d]) => a + d, 0));
console.log(lt.slice(0, 40).map(([s, d]) => `${s}+${d}`).join("  "));
await browser.close();
