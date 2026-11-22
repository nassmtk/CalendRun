// QA clavier : parcourt la page à la touche Tab et liste les éléments atteints (avec focus visible ?)
import puppeteer from "puppeteer-core";
const url = process.argv[2] || "http://127.0.0.1:4173/";
const n = Number(process.argv[3] || 60);
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 2500));
const seen = [];
for (let i = 0; i < n; i++) {
  await page.keyboard.press("Tab");
  seen.push(await page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
    const name = el.getAttribute("aria-label") || el.textContent.trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""} « ${name} » ${ring ? "" : "⚠ pas de focus visible"}`;
  }));
}
console.log(seen.map((s, i) => `${String(i + 1).padStart(2)} ${s}`).join("\n"));
await browser.close();
