/* eslint-disable no-console */
// Автозаполнение и откат: включаем, считаем заполненные клетки, выключаем
// с откатом и проверяем, что журнал вернулся как был.
import { chromium } from "playwright";
import fs from "node:fs";
import { db } from "../../../../src/lib/db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ORG = "cmoe6rpt4000097ts71yb922y";
const CODE = process.env.CODE ?? "hygiene";
const creds = JSON.parse(
  fs.readFileSync(".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json", "utf8"),
);

function isEmpty(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (typeof data !== "object") return false;
  const values = Object.values(data as Record<string, unknown>);
  if (values.length === 0) return true;
  return values.every((v) => v === "" || v === null || v === undefined);
}

async function stats() {
  const documents = await db.journalDocument.findMany({
    where: { organizationId: ORG, status: "active", template: { code: CODE } },
    select: { id: true, config: true },
  });
  const ids = documents.map((d) => d.id);
  const entries = await db.journalDocumentEntry.findMany({
    where: { documentId: { in: ids } },
    select: { id: true, data: true },
  });
  const undoLogged = documents.filter((d) => {
    const config = d.config as Record<string, unknown> | null;
    return Boolean(config && config.autoFillUndo);
  }).length;
  return {
    documents: ids.length,
    entries: entries.length,
    filled: entries.filter((e) => !isEmpty(e.data)).length,
    undoLogged,
  };
}

(async () => {
  const out: Record<string, unknown> = { code: CODE };
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => {});
    await page.locator("#email").fill(creds.email);
    await page.locator("#password").fill(creds.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });

    out.before = await stats();

    const save = await page.request.put(`${BASE}/api/organizations/auto-journals`, {
      data: { items: [{ code: CODE, autoCreate: true, autoFill: true }] },
    });
    out.saveStatus = save.status();

    const apply = await page.request.post(`${BASE}/api/organizations/auto-journals/apply`, {
      data: { code: CODE },
    });
    out.applyStatus = apply.status();
    out.applyBody = await apply.json().catch(() => null);
    out.afterFill = await stats();

    const revert = await page.request.post(`${BASE}/api/organizations/auto-journals/revert`, {
      data: { code: CODE },
    });
    out.revertStatus = revert.status();
    out.revertBody = await revert.json().catch(() => null);
    out.afterRevert = await stats();

    // Возвращаем настройку организации в исходное положение.
    await page.request.put(`${BASE}/api/organizations/auto-journals`, {
      data: { items: [{ code: CODE, autoCreate: false, autoFill: false }] },
    });

    const before = out.before as { filled: number; entries: number };
    const after = out.afterRevert as { filled: number; entries: number };
    out.verdict =
      before.filled === after.filled && before.entries === after.entries
        ? "PASS — журнал вернулся как был"
        : `FAIL — было ${before.entries}/${before.filled}, стало ${after.entries}/${after.filled}`;
  } catch (e) {
    out.error = String(e).slice(0, 300);
  } finally {
    console.log(JSON.stringify(out, null, 1));
    await browser.close();
    await db.$disconnect();
  }
})();
