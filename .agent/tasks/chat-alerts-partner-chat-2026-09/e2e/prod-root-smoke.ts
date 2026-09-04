/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "https://wesetup.ru";
const OUT = path.resolve(process.cwd(), ".agent/tasks/chat-alerts-partner-chat-2026-09/shots-prod");
fs.mkdirSync(OUT, { recursive: true });
const RUN = Date.now().toString(36);
const ROOT_EMAIL = process.env.ROOT_EMAIL!;
const ROOT_PASSWORDS = (process.env.ROOT_PASSWORDS ?? "").split("|").filter(Boolean);
const USER_EMAIL = process.env.USER_EMAIL!;
const USER_PASSWORD = process.env.USER_PASSWORD!;

function log(ok: boolean, what: string, note: string) {
  console.log(`${ok ? "PASS" : "FAIL"} ${what}: ${note}`);
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function tryLogin(page: Page, email: string, password: string): Promise<boolean> {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();
  try {
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 25_000 });
    return true;
  } catch {
    return false;
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
  const root = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
  const user = await browser.newContext({ viewport: { width: 1280, height: 900 } }).then((c) => c.newPage());
  try {
    let usedPassword: string | null = null;
    for (const pw of ROOT_PASSWORDS) {
      if (await tryLogin(root, ROOT_EMAIL, pw)) {
        usedPassword = pw;
        break;
      }
    }
    log(Boolean(usedPassword), "root login", usedPassword ? `password #${ROOT_PASSWORDS.indexOf(usedPassword) + 1} → ${new URL(root.url()).pathname}` : "все пароли отклонены");
    if (!usedPassword) return;

    // Пользователь готовит ветку: пишет в чат, закрывает виджет.
    log(await tryLogin(user, USER_EMAIL, USER_PASSWORD), "user login", new URL(user.url()).pathname);
    await user.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await user.locator('button[aria-label^="Поддержка"]').click();
    await user.getByRole("button", { name: /Онлайн-чат/ }).click();
    await user.locator('textarea[placeholder="Сообщение"]').fill(`Смоук-тест ответа из админки ${RUN}`);
    await user.keyboard.press("Enter");
    await user.getByText(`Смоук-тест ответа из админки ${RUN}`).first().waitFor({ timeout: 20_000 });
    await user.waitForTimeout(1500);
    await user.locator('button[aria-label="Закрыть"]').click();
    const chat = await (await user.request.get(`${BASE}/api/support/chat`)).json();
    log(true, "user thread", `${chat.threadId}`);

    // ROOT: админка, ветка ООО БФС, ответ из композера.
    await root.goto(`${BASE}/root/feedback`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await root.getByText("Онлайн-чаты").first().waitFor({ timeout: 60_000 });
    const summary = await root.locator("section").filter({ hasText: "Онлайн-чаты" }).first().locator("p").first().textContent();
    log(true, "root inbox", (summary ?? "").replace(/\s+/g, " ").slice(0, 140));
    await shot(root, "root-inbox");
    const card = root.locator("details").filter({ hasText: `Смоук-тест ответа из админки ${RUN}` }).first();
    if ((await card.count()) === 0) {
      // Ветка могла не попасть в 30 последних — проверим по названию организации.
      log(false, "root inbox thread", "ветка с новым сообщением не найдена среди 30 последних");
      return;
    }
    await card.locator("summary").click();
    await card.locator("textarea").fill(`Ответ поддержки из админки ${RUN}`);
    await card.locator("textarea").press("Enter");
    // На /root/* тостер до этого не был смонтирован — проверяем факт ответа через API клиента.
    let delivered = false;
    for (let i = 0; i < 10 && !delivered; i++) {
      await root.waitForTimeout(3000);
      const after = await (await user.request.get(`${BASE}/api/support/chat`)).json();
      delivered = after.messages.some((m: { body: string }) => m.body.includes(`Ответ поддержки из админки ${RUN}`));
    }
    log(delivered, "root reply", delivered ? "ответ появился в ветке клиента" : "ответ не найден в ветке за 30 с");
    await shot(root, "root-reply-sent");
    if (!delivered) return;

    // У пользователя — всплывашка, бейдж, клик открывает переписку с ответом.
    const popup = await waitPopup(user, 90_000);
    const label = await user.locator('button[aria-label^="Поддержка"]').getAttribute("aria-label");
    log(true, "user popup", `${(await popup.textContent())?.slice(0, 90)} | launcher: ${label}`);
    await shot(user, "user-popup-from-root-reply");
    await popup.locator("button").first().click();
    await user.getByText(`Ответ поддержки из админки ${RUN}`).first().waitFor({ timeout: 20_000 });
    await user.waitForTimeout(1500);
    const status = await (await user.request.get(`${BASE}/api/support/chat/status`)).json();
    log(status.unreadForClient === 0, "user read", `unreadForClient=${status.unreadForClient} после открытия чата`);
    await shot(user, "user-chat-with-root-reply");
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
