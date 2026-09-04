/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://wesetup.ru";
const OUT = path.resolve(process.cwd(), ".agent/tasks/chat-alerts-partner-chat-2026-09/shots-prod");
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.SMOKE_EMAIL!;
const PASSWORD = process.env.SMOKE_PASSWORD!;
const RUN = Date.now().toString(36);

const results: Array<{ check: string; ok: boolean; note: string }> = [];
function record(check: string, ok: boolean, note: string) {
  results.push({ check, ok, note });
  console.log(`${ok ? "PASS" : "FAIL"} ${check}: ${note}`);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
const ONLY = (process.env.SMOKE_ONLY ?? "").split(",").map((v) => v.trim()).filter(Boolean);
async function step(name: string, fn: () => Promise<void>) {
  if (ONLY.length && !ONLY.includes(name)) return;
  try {
    await fn();
  } catch (error) {
    record(name, false, `step failed: ${error instanceof Error ? error.message.split(String.fromCharCode(10))[0] : String(error)}`);
  }
}
async function waitPopup(page: Page, timeoutMs: number) {
  const popup = page.locator('[role="status"]', { hasText: "Новое сообщение" });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    if (await popup.isVisible().catch(() => false)) return popup;
    await page.waitForTimeout(4000);
  }
  throw new Error(`popup did not appear within ${timeoutMs / 1000}s`);
}

async function main() {
  const browser = await chromium.launch();
  const guest = await browser.newContext({ viewport: { width: 1280, height: 800 } }).then((c) => c.newPage());
  const user = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());

  try {
    await step("theme", async () => {
      await guest.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      const t = await guest.evaluate(() => ({
        cls: document.body.className,
        theme: document.body.getAttribute("data-app-theme"),
        hour: new Date().getHours(),
        font: getComputedStyle(document.body).fontFamily,
      }));
      const expected = t.hour >= 7 && t.hour < 19 ? "light" : "dark";
      record("theme default", t.cls.includes("public-theme") && t.theme === expected && !/manrope/i.test(t.font), `theme=${t.theme} hour=${t.hour} expected=${expected}`);
      await guest.evaluate(() => {
        localStorage.setItem("wesetup-theme-auto-schedule", "0");
        localStorage.setItem("wesetup-theme-mode", "dark");
      });
      await guest.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
      record("theme dark", (await guest.evaluate(() => document.body.getAttribute("data-app-theme"))) === "dark", "mode=dark → dark");
      await shot(guest, "landing-dark");
      await guest.goto(`${BASE}/pricing`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await shot(guest, "pricing-dark");
      await guest.evaluate(() => {
        localStorage.removeItem("wesetup-theme-auto-schedule");
        localStorage.removeItem("wesetup-theme-mode");
      });
    });

    await step("guest chat", async () => {
      await guest.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await guest.locator('button[aria-label^="Связаться с нами"]').click();
      await guest.locator('input[type="tel"]').fill("+79990000000");
      await guest.getByRole("button", { name: "Продолжить" }).click();
      await guest.getByRole("button", { name: /Онлайн-чат/ }).click();
      await guest.locator('textarea[placeholder="Сообщение"]').fill(`Смоук-тест гостевого чата ${RUN}, отвечать не нужно`);
      await guest.keyboard.press("Enter");
      await guest.getByText(`Смоук-тест гостевого чата ${RUN}`).first().waitFor({ timeout: 20_000 });
      const info = await guest.evaluate(async () => {
        const id = localStorage.getItem("wesetup.support-guest-id")!;
        const st = await (await fetch(`/api/public/support-chat/status?guestId=${id}`)).json();
        return { flag: localStorage.getItem("wesetup.support-guest-has-thread"), st };
      });
      record("guest chat send + status", info.flag === "1" && Boolean(info.st.threadId), `thread ${info.st.threadId}, unread=${info.st.unreadForClient}`);
      await shot(guest, "guest-chat");
      await guest.locator('button[aria-label="Закрыть"]').click();
    });

    await step("login", async () => {
      await user.goto(`${BASE}/login`);
      await user.locator("#email").fill(EMAIL);
      await user.locator("#password").fill(PASSWORD);
      await user.locator('button[type="submit"]').click();
      await user.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });
      record("login", true, `landed on ${new URL(user.url()).pathname}`);
    });

    await step("dashboard chat", async () => {
      await user.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      const status = await (await user.request.get(`${BASE}/api/support/chat/status`)).json();
      record("status endpoint", "unreadForClient" in status, JSON.stringify(status).slice(0, 160));
      await user.locator('button[aria-label^="Поддержка"]').click();
      await shot(user, "dashboard-support-menu");
      const chatItem = user.getByRole("button", { name: /Онлайн-чат/ });
      if ((await chatItem.count()) === 0) {
        record("dashboard chat", true, "пункт «Онлайн-чат» скрыт (режим партнёра в кабинете клиента)");
        await user.locator('button[aria-label="Закрыть"]').click();
        return;
      }
      await chatItem.click();
      await user.locator('textarea[placeholder="Сообщение"]').fill(`Смоук-тест чата кабинета ${RUN}, отвечать не нужно`);
      await user.keyboard.press("Enter");
      await user.getByText(`Смоук-тест чата кабинета ${RUN}`).first().waitFor({ timeout: 20_000 });
      const chat = await (await user.request.get(`${BASE}/api/support/chat`)).json();
      record("dashboard chat send", Boolean(chat.threadId), `thread ${chat.threadId}, messages=${chat.messages.length}, last author=${chat.messages.at(-1)?.authorName}`);
      await shot(user, "dashboard-chat");
      await user.locator('button[aria-label="Закрыть"]').click();
    });

    await step("ai popup", async () => {
      await user.locator('button[aria-label="AI помощник по СанПиН"]').click();
      const input = user.locator('input[placeholder], textarea[placeholder]').last();
      await input.fill("Смоук-тест: ответь одним словом «готово»");
      await input.press("Enter");
      await user.waitForTimeout(1500);
      await user.locator('button[aria-label="Закрыть"]').last().click();
      const popup = await waitPopup(user, 110_000);
      record("ai popup", true, (await popup.textContent())?.slice(0, 120) ?? "");
      await shot(user, "ai-popup");
      await popup.locator("button").first().click();
      await user.waitForTimeout(800);
      await shot(user, "ai-panel-after-popup");
      await user.locator('button[aria-label="Закрыть"]').last().click();
    });

    await step("partner cabinet", async () => {
      await user.goto(`${BASE}/partner/chats`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      const p = new URL(user.url()).pathname;
      if (p !== "/partner/chats") {
        record("partner cabinet", false, `redirected to ${p} — пользователь не активный партнёр`);
        await shot(user, "partner-redirect");
        return;
      }
      await user.getByRole("heading", { name: "Чаты" }).waitFor();
      const list = await (await user.request.get(`${BASE}/api/partner/chats`)).json();
      const status = await (await user.request.get(`${BASE}/api/partner/chats/status`)).json();
      record("partner chats", true, `threads=${list.threads?.length}, clients=${list.clients?.length}, waiting=${status.unreadForClient}`);
      await shot(user, "partner-chats");
      await user.getByRole("button", { name: "Написать" }).first().click();
      await user.getByText("Написать клиенту").waitFor();
      await shot(user, "partner-compose-dialog");
      await user.keyboard.press("Escape");
      if (list.threads?.length) {
        await user.goto(`${BASE}/partner/chats?thread=${list.threads[0].id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await shot(user, "partner-thread");
        record("partner thread view", true, `opened ${list.threads[0].organizationName}`);
      }
      await user.goto(`${BASE}/partner`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await shot(user, "partner-overview");
    });
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
