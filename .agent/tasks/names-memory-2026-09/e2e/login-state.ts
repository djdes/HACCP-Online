/* eslint-disable no-console */
// Один вход → storageState для остальных скриптов (лимитер 5/5 мин на IP).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const BASE = process.env.BASE ?? "http://localhost:3020";
const STATE = path.resolve(process.cwd(), ".agent/tasks/names-memory-2026-09/e2e/state.json");
const creds = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json"), "utf8")) as { email: string; password: string };
(async () => {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 240_000 });
  await page.waitForTimeout(3000);
  await page.locator("#email").fill(creds.email);
  await page.locator("#password").fill(creds.password);
  await page.waitForTimeout(800);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/auth/login")),
    page.locator('button[type="submit"]').first().click(),
  ]);
  console.log("login status:", response.status());
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
  await ctx.storageState({ path: STATE });
  console.log("state saved");
  await browser.close();
})();
