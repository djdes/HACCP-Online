// Один вход на все фазы проверки: лимитер входа 5 попыток / 5 минут на IP,
// поэтому сессия сохраняется в storage.json и переиспользуется.
// Запуск: WESETUP_ROOT_PW='…' npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/login.ts
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

import { BASE, EMAIL, STORAGE } from "./config";

async function main() {
  const password = process.env.WESETUP_ROOT_PW;
  if (!password) throw new Error("WESETUP_ROOT_PW не задан");

  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "load" });

    // Ввод до гидрации React не попадает в state — дожидаемся, пока
    // значение реально осело в поле.
    for (let i = 0; i < 30; i += 1) {
      await page.fill("#email", EMAIL);
      await page.fill("#password", password);
      const filled = await page.inputValue("#email");
      if (filled === EMAIL) break;
      await page.waitForTimeout(300);
    }
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });

    const session = (await page.request.get(`${BASE}/api/auth/session`)).json();
    const data = ((await session) ?? {}) as { user?: { email?: string; isRoot?: boolean } };
    console.log("session:", JSON.stringify(data.user ?? null));
    if (!data.user?.email) throw new Error("Сессия не создалась");

    await context.storageState({ path: STORAGE });
    console.log("OK: сессия сохранена в", STORAGE);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
