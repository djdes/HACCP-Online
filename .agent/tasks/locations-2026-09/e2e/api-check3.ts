/* eslint-disable no-console */
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = "http://localhost:3020";
const creds = JSON.parse(fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"));
const state = JSON.parse(fs.readFileSync(".agent/tasks/locations-2026-09/e2e/state.json", "utf8"));

(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });

  const put = await page.request.put(`${BASE}/api/settings/buildings/${state.buildingB}/staff`, { data: { userIds: [creds.id] } });
  console.log("PUT staff:", put.status(), (await put.text()).slice(0, 120));

  const complete = await page.request.post(`${BASE}/api/profile/complete`, {
    data: {
      organizationName: "Кафе «Тестовое 1»",
      phone: "+7 999 123-45-67",
      sphere: "restaurant",
      ownershipKind: "private",
      locationsCount: 2,
      inn: "",
      address: "",
      name: "E2E Гайд",
      newPassword: "",
      asEmployee: false,
      positionName: "",
    },
  });
  console.log("POST complete:", complete.status(), (await complete.text()).slice(0, 300));

  await page.goto(`${BASE}/settings/buildings`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForTimeout(2000);
  const cardB = await page
    .locator("h2", { hasText: "E2E Точка Б" })
    .locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]")
    .elementHandle();
  const text = cardB ? await cardB.innerText() : "";
  const m = text.match(/здесь:\s*\d+[^\n]*/);
  console.log("card B staff line:", m ? m[0] : "n/a");
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((el) => el.remove()));
  await page.screenshot({ path: ".agent/tasks/locations-2026-09/smoke/r3-04-point-card.png" });

  const reset = await page.request.put(`${BASE}/api/settings/buildings/${state.buildingB}/staff`, { data: { userIds: [] } });
  console.log("PUT staff reset:", reset.status(), (await reset.text()).slice(0, 80));
  await browser.close();
})();
