// e2e: плакаты из журнала, где строки не связаны со справочником — понятное пустое состояние и ссылка на все плакаты.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { db, E2E_DATABASE_URL } from "../../journal-responsibles-org-2026-09/e2e/db";

const BASE = "http://localhost:3020";
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const T1 = path.join(HERE, "..", "..", "journal-responsibles-org-2026-09", "e2e");
const state = JSON.parse(fs.readFileSync(path.join(T1, "state.json"), "utf8"));
const checks: Array<{ name: string; ok: boolean; detail?: unknown }> = [];
const check = (name: string, ok: boolean, detail?: unknown) => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail !== undefined ? ` :: ${JSON.stringify(detail).slice(0, 400)}` : ""}`);
};

async function main() {
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  const template = await db.journalTemplate.findUniqueOrThrow({ where: { code: "climate_control" } });
  const doc = await db.journalDocument.create({
    data: {
      organizationId: state.orgA,
      templateId: template.id,
      title: "E2E климат без справочника",
      dateFrom: new Date("2026-09-01T00:00:00Z"),
      dateTo: new Date("2026-09-30T00:00:00Z"),
      status: "active",
      config: { rooms: [{ id: "free-row", name: "Склад без связи", temperature: { enabled: true, min: 15, max: 25 }, humidity: { enabled: true, min: 40, max: 70 } }] },
    },
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 180_000 });
    await page.fill("#email", state.users.managerA.email);
    await page.fill("#password", state.password);
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 180_000 });
    await page.goto(`${BASE}/settings/qr-posters?kind=rooms&doc=${doc.id}`, { waitUntil: "load", timeout: 300_000 });
    const main = page.locator("main");
    await page.getByText("В документе нет помещений из «Точек и помещений»").waitFor({ timeout: 60_000 });
    check("пустое состояние из журнала: объясняет, что показываются только строки документа", (await main.innerText()).includes("показываются только его строки"));
    await page.screenshot({ path: path.join(HERE, "..", "shots", "posters-empty-document-scope.png") });
    await page.getByRole("link", { name: "откройте плакаты всех помещений" }).click();
    await page.waitForURL((url) => !url.search.includes("doc="), { timeout: 60_000 });
    await page.locator("[data-qr-poster]").first().waitFor({ timeout: 60_000 });
    check("ссылка открывает плакаты всех помещений", (await page.locator("[data-qr-poster]").count()) > 0);
  } catch (error) {
    check("e2e без исключений", false, String(error).slice(0, 600));
  } finally {
    await browser.close();
    await db.journalDocument.delete({ where: { id: doc.id } }).catch(() => null);
    const passed = checks.filter((c) => c.ok).length;
    console.log(`\n${passed}/${checks.length} PASS`);
    await db.$disconnect();
    process.exit(passed === checks.length ? 0 : 1);
  }
}
main();
