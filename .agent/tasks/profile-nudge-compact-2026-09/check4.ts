/* eslint-disable no-console */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const BASE = "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/shots");
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const results: Record<string, unknown> = {};
async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 758 }, deviceScaleFactor: 2 })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message.slice(0, 160)));
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(creds.email); await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    await page.goto(`${BASE}/dashboard?welcome=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const dialog = page.locator('[role="dialog"][aria-labelledby="complete-profile-title"]');
    await dialog.waitFor({ state: "visible", timeout: 60_000 });
    await page.waitForTimeout(1200);
    // invalid phone -> border only, no text
    const phone = dialog.locator('input[inputmode="tel"]');
    await phone.fill("123"); await phone.blur();
    await dialog.locator('input[placeholder="ООО «Ромашка»"]').fill("Тестовость");
    await page.waitForTimeout(300);
    results.state = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-labelledby="complete-profile-title"]') as HTMLElement;
      const text = d.innerText;
      const phoneBox = (document.querySelector('input[inputmode="tel"]') as HTMLElement).closest("span.rounded-2xl") as HTMLElement;
      const demo = d.querySelector('[data-testid="complete-profile-demo"]') as HTMLElement;
      const done = Array.from(d.querySelectorAll("button")).find((b) => b.textContent?.trim() === "Готово") as HTMLElement;
      const dr = demo.getBoundingClientRect(), gr = done.getBoundingClientRect();
      const caption = demo.parentElement?.querySelector("p") as HTMLElement | null;
      const form = document.getElementById("complete-profile-form")!;
      return {
        hasFormatText: text.includes("Формат:"),
        hasStatusLine: /Осталось:|Всё заполнено/.test(text),
        phoneRedBorder: phoneBox.className.includes("border-[#ff8d7d]"),
        demoLeftOfDone: dr.left < gr.left && Math.abs(dr.top - gr.top) < 4,
        caption: caption?.innerText ?? null,
        captionUnderDemo: caption ? Math.abs(caption.getBoundingClientRect().left + caption.getBoundingClientRect().width / 2 - (dr.left + dr.width / 2)) < 8 : false,
        headerIcon: (d.querySelector("h2")?.parentElement?.previousElementSibling?.querySelector("svg") as SVGElement | null)?.getAttribute("class"),
        fits: form.scrollHeight <= form.clientHeight + 1,
        modalHeight: Math.round(d.firstElementChild!.getBoundingClientRect().height),
      };
    });
    await page.screenshot({ path: path.join(OUT, "07-mobile-v3.png") });
  } catch (e) {
    results.error = String(e);
    await page.screenshot({ path: path.join(OUT, "99-error-v3.png") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.resolve(process.cwd(), ".agent/tasks/profile-nudge-compact-2026-09/results-v3.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
