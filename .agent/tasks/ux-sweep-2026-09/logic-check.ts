// Контроль двух исправлений: «-18,5» в холодильниках и время в чек-листе санитарного дня.
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
import { db } from "../journal-responsibles-org-2026-09/e2e/db";
const BASE = "http://localhost:3020"; const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));
const COLD = "cmu6pg3d50001309mb4xv4ipl";
(async () => {
  const today = new Date(); const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const before = await db.journalDocument.findUnique({ where: { id: COLD }, select: { dateTo: true } });
  await db.journalDocument.update({ where: { id: COLD }, data: { dateTo: new Date("2026-09-30") } });
  const browser = await chromium.launch({ headless: true }); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
  const errs: string[] = []; page.on("response", (r) => { if (r.status() >= 400 && /api\//.test(r.url())) errs.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 300000 }); await page.fill("#email", state.users.managerA.email); await page.fill("#password", state.password);
    await page.waitForLoadState("networkidle").catch(() => null); await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 300000 });
    await page.goto(`${BASE}/journals/cold_equipment_control/documents/${COLD}`, { waitUntil: "load", timeout: 300000 }); await page.waitForTimeout(2500);
    const ok = page.getByRole("button", { name: "Понятно", exact: true }).first(); if (await ok.isVisible().catch(() => false)) await ok.click();
    const input = page.locator('input[id^="today-temp-"]').first(); await input.waitFor({ timeout: 30000 });
    await input.fill("3,5"); await input.blur(); await page.waitForTimeout(3000);
    console.log("input shows:", await input.inputValue());
    const entries = await db.journalDocumentEntry.findMany({ where: { documentId: COLD, date: new Date(`${iso}T00:00:00.000Z`) }, select: { data: true } });
    console.log("db temperatures:", JSON.stringify(entries.map((e) => (e.data as any)?.temperatures)));
  } finally {
    console.log("api errors:", JSON.stringify(errs.slice(0, 5)));
    await db.journalDocument.update({ where: { id: COLD }, data: { dateTo: before!.dateTo } }); await browser.close(); await db.$disconnect();
  }
})().catch((e) => { console.log("FATAL", String(e).slice(0, 300)); process.exit(1); });
