// QA : profil CPU (mobile émulé) → fonctions les plus coûteuses
import puppeteer from "puppeteer-core";

const url = process.argv[2] || "http://127.0.0.1:5173/";
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send("Profiler.enable");
await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
await cdp.send("Profiler.start");
await page.goto(url, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 6000));
const { profile } = await cdp.send("Profiler.stop");
const self = new Map();
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  const n = byId.get(id), f = n.callFrame;
  const key = `${f.functionName || "(anon)"} ${f.url.split("/").slice(-1)[0]}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) || 0) + (dt[i] || 0));
});
[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log((v / 1000).toFixed(0).padStart(6), "ms ", k));
await browser.close();
