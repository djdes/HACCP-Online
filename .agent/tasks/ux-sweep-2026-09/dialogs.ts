// Открывает окно «Добавить» в каждом документе журнала на ширине телефона и снимает его.
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
import { db } from "../journal-responsibles-org-2026-09/e2e/db";
const BASE = process.env.SWEEP_BASE ?? "http://localhost:3021";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = process.env.SWEEP_OUT!; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.SWEEP_ONLY ? new RegExp(process.env.SWEEP_ONLY) : null;
const PROBE = fs.readFileSync(path.join(HERE, "dialog-probe.js"), "utf8");
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));
(async () => {
  const user = await db.user.findUnique({ where: { email: state.users.managerA.email }, select: { organizationId: true } });
  const docs = await db.journalDocument.findMany({ where: { organizationId: user!.organizationId, status: "active" }, select: { id: true, template: { select: { code: true } } }, orderBy: { createdAt: "desc" } });
  const first = new Map<string, string>(); for (const d of docs) if (!first.has(d.template.code)) first.set(d.template.code, d.id);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 300000 }); await page.fill("#email", state.users.managerA.email); await page.fill("#password", state.password);
  await page.waitForLoadState("networkidle").catch(() => null); await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 300000 });
  const report: unknown[] = [];
  for (const [code, id] of first) {
    if (ONLY && !ONLY.test(code)) continue;
    try {
      await page.goto(`${BASE}/journals/${code}/documents/${id}`, { waitUntil: "load", timeout: 300000 }); await page.waitForTimeout(2000);
      for (const name of ["Понятно", "OK"]) { const b = page.getByRole("button", { name, exact: true }).first(); if (await b.isVisible().catch(() => false)) { await b.click().catch(() => null); await page.waitForTimeout(300); } }
      const btn = page.locator("main button, main a").filter({ hasText: /^\s*(Добавить|Заполнить)/ }).first();
      if (!(await btn.isVisible().catch(() => false))) { report.push({ code, note: "нет кнопки добавления" }); console.log(code, "no-add-button"); continue; }
      const label = ((await btn.textContent()) ?? "").trim(); await btn.click(); await page.waitForTimeout(900);
      const item = page.getByRole("menuitem").first(); if (await item.isVisible().catch(() => false)) { await item.click(); await page.waitForTimeout(900); }
      const m: any = await page.evaluate(PROBE); await page.screenshot({ path: path.join(OUT, `dlg_${code}.png`) });
      report.push({ code, button: label, ...m }); console.log(code, JSON.stringify({ label, dialog: m.dialog, off: m.off?.length, under16: m.inputsUnder16px }));
      await page.keyboard.press("Escape").catch(() => null);
    } catch (e) { report.push({ code, error: String(e).slice(0, 160) }); console.log(code, "ERR", String(e).slice(0, 100)); }
    fs.writeFileSync(path.join(OUT, "dialogs.json"), JSON.stringify(report, null, 1));
  }
  await browser.close(); await db.$disconnect();
})().catch((e) => { console.log("FATAL", String(e).slice(0, 300)); process.exit(1); });
