// Создаёт по одному документу на каждый журнал без активного документа (стенд e2e).
import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
import { db } from "../journal-responsibles-org-2026-09/e2e/db";
const BASE = process.env.SWEEP_BASE ?? "http://localhost:3021";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));
(async () => {
  const user = await db.user.findUnique({ where: { email: state.users.managerA.email }, select: { organizationId: true } });
  const templates = await db.journalTemplate.findMany({ select: { id: true, code: true } });
  const docs = await db.journalDocument.findMany({ where: { organizationId: user!.organizationId, status: "active" }, select: { templateId: true } });
  const have = new Set(docs.map((d) => d.templateId));
  const browser = await chromium.launch({ headless: true }); const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 300000 }); await page.fill("#email", state.users.managerA.email); await page.fill("#password", state.password);
  await page.waitForLoadState("networkidle").catch(() => null); await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 300000 });
  for (const t of templates) {
    if (have.has(t.id)) continue;
    const r = await ctx.request.post(`${BASE}/api/journal-documents`, { data: { templateCode: t.code, title: `Проверка ${t.code}`, dateFrom: "2026-09-01", dateTo: "2026-09-30", force: true }, timeout: 120000 });
    console.log(t.code, r.status(), r.ok() ? "" : (await r.text()).slice(0, 120));
  }
  await browser.close(); await db.$disconnect();
})().catch((e) => { console.log("FATAL", String(e).slice(0, 300)); process.exit(1); });
