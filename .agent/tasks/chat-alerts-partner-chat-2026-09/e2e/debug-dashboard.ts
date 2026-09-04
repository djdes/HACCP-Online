import { chromium } from "playwright";
const BASE = "http://localhost:3020";
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
  page.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text().slice(0, 200)); });
  page.on("request", (r) => { if (r.url().includes("/api/support/chat")) console.log("REQ", r.method(), r.url()); });
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(process.env.E2E_ROOT_EMAIL!);
  await page.locator("#password").fill(process.env.E2E_ROOT_PASSWORD!);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  console.log("close buttons:", await page.locator('button[aria-label="Закрыть"]').count());
  await page.locator('button[aria-label^="Поддержка"]').click();
  await page.getByRole("button", { name: /Онлайн-чат/ }).click();
  await page.locator('textarea[placeholder="Сообщение"]').fill("debug вопрос");
  await page.keyboard.press("Enter");
  await page.getByText("debug вопрос").waitFor({ timeout: 20_000 });
  console.log("close buttons while open:", await page.locator('button[aria-label="Закрыть"]').count());
  await page.locator('button[aria-label="Закрыть"]').first().click();
  await page.waitForTimeout(500);
  console.log("panel open after close?", await page.locator('textarea[placeholder="Сообщение"]').count());
  const chat = await (await page.request.get(`${BASE}/api/support/chat`)).json();
  const reply = await page.request.post(`${BASE}/api/root/support/threads/${chat.threadId}/messages`, { data: { message: "debug ответ" } });
  console.log("reply", reply.status());
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.waitForTimeout(3000);
    const state = await page.evaluate(async () => {
      const st = await (await fetch("/api/support/chat/status", { cache: "no-store" })).json();
      return {
        status: st,
        alerted: localStorage.getItem("wesetup.support.alerted:org"),
        popups: Array.from(document.querySelectorAll('[role="status"]')).map((e) => e.textContent?.slice(0, 40)),
        label: document.querySelector('button[aria-label^="Поддержка"]')?.getAttribute("aria-label"),
      };
    });
    console.log(i, JSON.stringify(state));
    if (state.popups.some((t) => t?.includes("Новое"))) break;
  }
  await browser.close();
}
main();
