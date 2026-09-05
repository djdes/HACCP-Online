/* eslint-disable no-console */
// Ставит e2e-организацию на паузу через БД, проверяет карточку и кнопку
// «Возобновить работу» через браузер, затем убеждается, что план вернулся.
//   npx tsx --env-file=.env.local .agent/tasks/free-plan-mobile-polish-2026-09/e2e/pause-flow.ts
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

const BASE = process.env.BASE ?? "http://localhost:3020";
const ORG = process.env.E2E_ORG ?? "cmoe6rpt4000097ts71yb922y";
const EMAIL = "e2e-previews@wesetup.local";
const PASSWORD = "E2e-Previews-2026!";
const OUT = path.resolve(process.cwd(), ".agent/tasks/free-plan-mobile-polish-2026-09/shots");

async function main() {
  const before = await db.organization.findUniqueOrThrow({ where: { id: ORG }, select: { subscriptionPlan: true } });
  await db.organization.update({
    where: { id: ORG },
    data: { subscriptionPlan: "paused", pausedFromPlan: before.subscriptionPlan, inactivityWarnedStage: 7 },
  });
  const results: Record<string, unknown> = { before: before.subscriptionPlan };
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 });

    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.waitForTimeout(2500);
    results.dashboardBanner = await page.getByText("Аккаунт на паузе").first().isVisible();
    await page.screenshot({ path: path.join(OUT, "30-paused-dashboard-mobile.png") });

    await page.goto(`${BASE}/settings/subscription`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    const btn = page.getByRole("button", { name: "Возобновить работу" });
    await btn.waitFor({ state: "visible", timeout: 30_000 });
    await page.screenshot({ path: path.join(OUT, "31-paused-subscription-mobile.png") });
    await btn.click();
    await page.getByText("Аккаунт снова активен").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForTimeout(2000);
    results.cardGoneAfterResume = (await page.getByRole("button", { name: "Возобновить работу" }).count()) === 0;
  } finally {
    await browser.close();
    const after = await db.organization.findUniqueOrThrow({
      where: { id: ORG },
      select: { subscriptionPlan: true, pausedFromPlan: true, inactivityWarnedStage: true, inactivityResumedAt: true },
    });
    results.after = after;
    const audit = await db.auditLog.findFirst({ where: { organizationId: ORG, action: "subscription.resumed" }, orderBy: { createdAt: "desc" } });
    results.auditResumed = Boolean(audit);
    // Safety: restore original plan if anything went wrong.
    if (after.subscriptionPlan === "paused") {
      await db.organization.update({ where: { id: ORG }, data: { subscriptionPlan: before.subscriptionPlan, pausedFromPlan: null } });
      results.restoredManually = true;
    }
    fs.writeFileSync(path.join(OUT, "pause-flow.json"), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
