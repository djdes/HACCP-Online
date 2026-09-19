// UX-sweep: обходит сайт на ширине телефона и собирает технические признаки проблем.
import fs from "node:fs"; import path from "node:path"; import { chromium, type Page } from "playwright";
import { db } from "../journal-responsibles-org-2026-09/e2e/db";
const BASE = process.env.SWEEP_BASE ?? "http://localhost:3021";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const OUT = process.env.SWEEP_OUT!; const ROLE = process.env.SWEEP_ROLE ?? "managerA"; const W = Number(process.env.SWEEP_W ?? 390);
const ONLY = process.env.SWEEP_ONLY ? new RegExp(process.env.SWEEP_ONLY) : null;
const state = JSON.parse(fs.readFileSync(path.join(HERE, "..", "journal-responsibles-org-2026-09", "e2e", "state.json"), "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const PROBE = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "probe.js"), "utf8");
async function probe(page: Page): Promise<any> { return page.evaluate(PROBE); }

(async () => {
  const email = state.users[ROLE].email;
  const user = await db.user.findUnique({ where: { email }, select: { organizationId: true } });
  const orgId = user!.organizationId;
  const templates = await db.journalTemplate.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: { sortOrder: "asc" } }).catch(async () => db.journalTemplate.findMany({ select: { code: true, name: true } }));
  const docs = await db.journalDocument.findMany({ where: { organizationId: orgId, status: "active" }, select: { id: true, template: { select: { code: true } } }, orderBy: { createdAt: "desc" } });
  const firstDoc = new Map<string, string>(); for (const d of docs) if (!firstDoc.has(d.template.code)) firstDoc.set(d.template.code, d.id);
  const urls: string[] = (process.env.SWEEP_URLS ?? "").split(",").filter(Boolean).map((u) => (u.startsWith("/") ? u : `/${u}`));
  if (urls.length === 0) {
    urls.push("/dashboard", "/journals");
    for (const t of templates) { urls.push(`/journals/${t.code}`); const id = firstDoc.get(t.code); if (id) urls.push(`/journals/${t.code}/documents/${id}`); }
    for (const p of ["batches","bonuses","capa","changes","competencies","control-board","ideas","journals-progress","losses","plans","reports","sanpin","staff","team","verifications","settings","settings/users","settings/journals","settings/journal-responsibles","settings/buildings","settings/equipment","settings/areas","settings/schedule","settings/notifications","settings/organization","settings/permissions","settings/subscription","settings/qr-posters","settings/products","settings/integrations/tasksflow","settings/journal-periods","settings/security"]) urls.push(`/${p}`);
    for (const p of ["mini", "mini/today", "mini/journals", "mini/reports", "mini/me", "mini/staff", "mini/equipment", "mini/shift"]) urls.push(`/${p}`);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 1, isMobile: W < 700, hasTouch: W < 700 });
  const page = await ctx.newPage();
  let errs: string[] = []; page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 220)); }); page.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 220)));
  page.on("response", (r) => { if (r.status() >= 400 && !/favicon|_next\/static/.test(r.url())) errs.push(`http ${r.status()} ${r.url().replace(BASE, "").slice(0, 120)}`); });
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 300000 }); await page.fill("#email", email); await page.fill("#password", state.password);
  await page.waitForLoadState("networkidle").catch(() => null); await page.click('button[type="submit"]'); await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 300000 });
  await page.evaluate(() => { try { localStorage.setItem("wesetup.last-seen-build-sha", "zzz"); } catch {} });
  const report: unknown[] = [];
  for (const url of urls) {
    if (ONLY && !ONLY.test(url)) continue;
    errs = []; const t0 = Date.now(); let status = 0;
    try {
      const resp = await page.goto(`${BASE}${url}`, { waitUntil: "load", timeout: 300000 }); status = resp?.status() ?? 0; await page.waitForTimeout(1800);
      for (const name of ["Понятно", "Закрыть", "Позже"]) { const b = page.locator('[role="dialog"]').getByRole("button", { name }).first(); if (await b.isVisible().catch(() => false)) { await b.click().catch(() => null); await page.waitForTimeout(300); } }
      const m = await probe(page); const file = url.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 90) + `.${ROLE}.${W}.png`;
      await page.screenshot({ path: path.join(OUT, file), fullPage: true }).catch(() => null);
      const row = { url, status, final: page.url().replace(BASE, ""), ms: Date.now() - t0, ...m, errs: errs.filter((e) => !/hydrat|Download the React DevTools/i.test(e)).slice(0, 6), shot: file };
      report.push(row); console.log(JSON.stringify({ url, status, sw: m.pageScrollW, off: m.off.length, small: m.small.length, errs: row.errs.length }));
    } catch (e) { report.push({ url, status, error: String(e).slice(0, 200) }); console.log("ERR", url, String(e).slice(0, 120)); }
    fs.writeFileSync(path.join(OUT, `report.${ROLE}.${W}.json`), JSON.stringify(report, null, 1));
  }
  await browser.close(); await db.$disconnect();
})().catch((e) => { console.log("FATAL", String(e).slice(0, 400)); process.exit(1); });
