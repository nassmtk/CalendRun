// QA : trace de performance (mobile, CPU ×4) → décompose chaque tâche longue du thread principal
import puppeteer from "puppeteer-core";
import fs from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:4173/";
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await page.createCDPSession();
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.tracing.start({ path: "qa/trace.json", categories: ["devtools.timeline", "disabled-by-default-devtools.timeline"] });
await page.goto(url, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 6000));
await page.tracing.stop();
await browser.close();

const { traceEvents } = JSON.parse(fs.readFileSync("qa/trace.json", "utf8"));
const mains = traceEvents.filter((e) => e.name === "thread_name" && e.args.name === "CrRendererMain");
const main = mains.map((m) => [m, traceEvents.filter((e) => e.pid === m.pid && e.tid === m.tid && e.name === "RunTask").length]).sort((a, b) => b[1] - a[1])[0][0];
const ev = traceEvents.filter((e) => e.pid === main.pid && e.tid === main.tid && e.ph === "X");
const tasks = ev.filter((e) => e.name === "RunTask" && e.dur > 50000);
const t0 = Math.min(...ev.map((e) => e.ts));
for (const t of tasks) {
  const inside = ev.filter((e) => e !== t && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e.dur > 8000);
  const agg = {};
  inside.forEach((e) => {
    const k = e.name === "FunctionCall" || e.name === "EvaluateScript" ? `${e.name}(${(e.args.data?.url || "").split("/").pop()}:${e.args.data?.functionName || ""})` : e.name;
    agg[k] = (agg[k] || 0) + e.dur / 1000;
  });
  const top = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(0)}ms`).join(" | ");
  console.log(`+${((t.ts - t0) / 1000).toFixed(0)}ms  ${(t.dur / 1000).toFixed(0)}ms  ${top}`);
}
