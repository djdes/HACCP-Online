import { chromium } from "playwright";
import path from "node:path";
const BASE = "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/chat-alerts-partner-chat-2026-09/shots");
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then((c) => c.newPage());
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("wesetup-theme-auto-schedule", "0");
    localStorage.setItem("wesetup-theme-mode", "dark");
  });
  await page.reload({ waitUntil: "networkidle" });
  // Cookie-баннер закрываем, чтобы не перекрывал низ.
  await page.getByRole("button", { name: "OK" }).click().catch(() => {});
  const total = await page.evaluate(() => document.body.scrollHeight);
  let n = 0;
  for (let y = 0; y < total; y += 700) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" as ScrollBehavior }), y);
    await page.waitForTimeout(900);
    if (n % 2 === 0) await page.screenshot({ path: path.join(OUT, `dark-scroll-${String(n).padStart(2, "0")}.png`) });
    n++;
  }
  console.log("shots:", Math.ceil(n / 2), "height", total);
  await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "dark-pricing.png") });
  await page.goto(`${BASE}/journals-info`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, "dark-journals-info.png") });
  await browser.close();
}
main();
