import fs from "node:fs"; import path from "node:path"; import { chromium } from "playwright";
import { db } from "../journal-responsibles-org-2026-09/e2e/db";
const BASE = process.env.SWEEP_BASE ?? "http://localhost:3021";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));
(async () => {
  const user = await db.user.findUnique({ where: { email: state.users.managerA.email }, select: { organizationId: true } });
  const orgId = user!.organizationId;
  const orgBefore = await db.organization.findUnique({ where: { id: orgId }, select: { perLocationJournals: true } });
  await db.organization.update({ where: { id: orgId }, data: { perLocationJournals: true } });
  const before = await db.building.count({ where: { organizationId: orgId } });
  const made: string[] = [];
  for (const name of ["Какая то там вторая точка ленина 10 допустим очень длинное название", "Третья"]) {
    made.push((await db.building.create({ data: { organizationId: orgId, name } })).id);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180000 }); await page.fill("#email", state.users.managerA.email); await page.fill("#password", state.password);
    await page.waitForLoadState("networkidle").catch(() => null); await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 300000 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: "load", timeout: 300000 }); await page.waitForTimeout(2500);
    const strip = page.locator('section[aria-label="Сводка по точкам"]');
    const m = await strip.evaluate((el) => { const vw = document.documentElement.clientWidth; const btns = Array.from(el.querySelectorAll("button")).map((b) => Math.round(b.getBoundingClientRect().right)); return { vw, sectionRight: Math.round(el.getBoundingClientRect().right), maxButtonRight: Math.max(...btns), pageScrollW: document.documentElement.scrollWidth }; });
    console.log(JSON.stringify(m)); console.log(m.maxButtonRight <= m.sectionRight && m.pageScrollW <= m.vw ? "PASS" : "FAIL");
    await strip.screenshot({ path: path.join(HERE, "strip-390.png") });
  } finally { await browser.close(); await db.organization.update({ where: { id: orgId }, data: { perLocationJournals: orgBefore?.perLocationJournals ?? false } }); if (made.length) await db.building.deleteMany({ where: { id: { in: made } } }); await db.$disconnect(); }
})().catch((e) => { console.log("ERR", String(e).slice(0, 300)); process.exit(1); });
