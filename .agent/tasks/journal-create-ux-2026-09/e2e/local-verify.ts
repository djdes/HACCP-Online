/* eslint-disable no-console */
import { chromium, type Page } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3020";
const OUT = path.resolve(process.cwd(), ".agent/tasks/journal-create-ux-2026-09/shots");
fs.mkdirSync(OUT, { recursive: true });
const EMAIL = process.env.E2E_EMAIL!;
const PASSWORD = process.env.E2E_PASSWORD!;
const ORG = process.env.E2E_ORG ?? "cmoe6rpt4000097ts71yb922y"; // Кафе «Тестовое 1»: Повар×2, Официант×2

const results: Record<string, unknown> = {};
const shot = (p: Page, name: string) => p.screenshot({ path: path.join(OUT, `${name}.png`) });

async function openCreateDialog(page: Page) {
  await page.goto(`${BASE}/journals/cleaning`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const btn = page.getByRole("button", { name: /Создать документ/ }).first();
  await btn.waitFor({ state: "visible", timeout: 60_000 });
  await btn.click();
  await page.getByText("Создание документа").first().waitFor({ state: "visible", timeout: 30_000 });
}

async function listboxState(page: Page) {
  return page.evaluate(() => {
    const lb = document.querySelector('[role="listbox"]') as HTMLElement | null;
    if (!lb) return { open: false };
    const r = lb.getBoundingClientRect();
    const active = document.activeElement;
    return {
      open: true,
      focusInside: !!active && lb.contains(active),
      box: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right },
      viewportW: window.innerWidth,
      options: Array.from(lb.querySelectorAll('[role="option"]')).map((o) => (o as HTMLElement).innerText.trim()),
      groupLabels: Array.from(lb.querySelectorAll('[data-slot="select-label"]')).map((o) => (o as HTMLElement).innerText.trim()),
      panelClass: (lb.closest('[data-slot="select-content"]') as HTMLElement | null)?.className ?? "",
    };
  });
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome" });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  try {
    // 1. login as root
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#email").fill(EMAIL);
    await page.locator("#password").fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 120_000 });
    results.login = page.url();

    // 2. impersonate org
    const imp = await page.request.post(`${BASE}/api/root/impersonate`, { data: { organizationId: ORG } });
    results.impersonate = imp.status();

    // 3. cleaning create dialog: auto title
    await openCreateDialog(page);
    const titleInput = page.getByLabel("Название документа");
    const title = await titleInput.inputValue();
    results.ac1_title = title;
    await shot(page, "01-create-dialog");

    // 4. open position select (AC5 look) and pick a position with 2+ employees (AC4)
    const positionTrigger = page.getByRole("combobox").filter({ hasText: "Выберите должность" }).first();
    await positionTrigger.click();
    await page.waitForSelector('[role="listbox"]', { timeout: 10_000 });
    const posList = await listboxState(page);
    results.ac5_position_list = posList;
    await shot(page, "02-position-select-open");
    // choose "Повар" if present else the first non-empty option
    const opts = (posList as { options?: string[] }).options ?? [];
    const pick = opts.find((o) => o === "Повар") ?? opts.find((o) => o && !o.startsWith("Выберите")) ?? "";
    results.picked_position = pick;
    await page.getByRole("option", { name: pick, exact: true }).first().click();
    await page.waitForTimeout(700);
    const empList = await listboxState(page);
    results.ac4_employee_list_after_position = empList;
    await shot(page, "03-employee-auto-open");
    if ((empList as { open?: boolean }).open) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      results.ac4_escape_closes = !(await listboxState(page)).open;
    }
    // employee field value now (auto-pick if single)
    const employeeTrigger = page.getByRole("combobox").nth(1);
    results.employee_trigger_text = (await employeeTrigger.innerText()).trim();

    // 5. header user menu (DropdownMenu look)
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page.goto(`${BASE}/journals/cleaning`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const ell = page.locator('button:has(svg.lucide-ellipsis)').first();
    if (await ell.count()) {
      await ell.click();
      await page.waitForSelector('[data-slot="dropdown-menu-content"]', { timeout: 10_000 });
      results.dropdown_panel_class = await page.evaluate(() => (document.querySelector('[data-slot="dropdown-menu-content"]') as HTMLElement)?.className);
      await shot(page, "04-card-dropdown-menu");
      await page.keyboard.press("Escape");
    } else {
      results.dropdown_panel_class = "no-card-menu-button";
    }

    // 6. mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await openCreateDialog(page);
    await page.getByRole("combobox").filter({ hasText: "Выберите должность" }).first().click();
    await page.waitForSelector('[role="listbox"]', { timeout: 10_000 });
    const mob = await listboxState(page);
    results.ac6_mobile = { right: (mob as { box?: { right: number } }).box?.right, viewportW: (mob as { viewportW?: number }).viewportW, fits: ((mob as { box?: { right: number } }).box?.right ?? 9e9) <= ((mob as { viewportW?: number }).viewportW ?? 0) };
    await shot(page, "05-mobile-position-select");
    await page.keyboard.press("Escape");

    // 7. yearly journal: audit plan title
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/journals/audit_plan`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const btn2 = page.getByRole("button", { name: /Создать документ/ }).first();
    if (await btn2.count()) {
      await btn2.click();
      await page.getByText("Создание документа").first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
      results.ac2_audit_plan_title = await page.locator('[role="dialog"] input:not([type="date"]):not([type="checkbox"])').first().inputValue().catch(() => "n/a");
      await shot(page, "06-audit-plan-create");
      // change year -> title follows
      const yearTrigger = page.locator('[role="dialog"]').getByRole("combobox").first();
      await yearTrigger.click();
      const nextYear = page.getByRole("option", { name: "2027", exact: true }).first();
      if (await nextYear.count()) { await nextYear.click(); await page.waitForTimeout(300); }
      results.ac2_audit_plan_title_after_year = await page.locator('[role="dialog"] input:not([type="date"]):not([type="checkbox"])').first().inputValue().catch(() => "n/a");
      await page.keyboard.press("Escape");
    } else {
      results.ac2_audit_plan_title = "no-create-button";
    }
    // 8. PPE issuance (yearly, date-only) + disinfectant (perpetual)
    for (const [code, key] of [["ppe_issuance", "ac2_ppe_title"], ["disinfectant_usage", "ac3_disinfectant_title"]] as const) {
      await page.goto(`${BASE}/journals/${code}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      const b = page.getByRole("button", { name: /Создать документ/ }).first();
      const visible = await b.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false);
      if (!visible) { results[key] = "no-create-button"; continue; }
      await b.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 30_000 });
      await page.waitForTimeout(400);
      results[key] = await page.locator('[role="dialog"] input:not([type="date"]):not([type="checkbox"])').first().inputValue().catch(() => "n/a");
      await shot(page, `07-${code}-create`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
    // 9. AC7: hygiene «Настройки» dialog (migrated to PositionEmployeePicker)
    await page.goto(`${BASE}/journals/hygiene`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const hyEll = page.locator('button:has(svg.lucide-ellipsis)').first();
    if (await hyEll.waitFor({ state: "visible", timeout: 60_000 }).then(() => true).catch(() => false)) {
      await hyEll.click();
      const settingsItem = page.getByRole("menuitem", { name: /Настройки/ }).first();
      await settingsItem.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 30_000 });
      await page.waitForTimeout(400);
      const posTrig = page.locator('[role="dialog"]').getByRole("combobox").first();
      results.ac7_hygiene_position_before = (await posTrig.innerText()).trim();
      await posTrig.click();
      await page.waitForSelector('[role="listbox"]', { timeout: 10_000 });
      const optNames = await page.locator('[role="option"]').allInnerTexts();
      const target = optNames.find((o) => o.trim() === "Официант") ?? optNames.find((o) => o.trim() === "Повар");
      results.ac7_hygiene_pick = target ?? "none";
      if (target) {
        await page.getByRole("option", { name: target.trim(), exact: true }).first().click();
        await page.waitForTimeout(700);
        results.ac7_hygiene_employee_list = await listboxState(page);
        await shot(page, "08-hygiene-settings-auto-open");
        await page.keyboard.press("Escape");
      }
    } else {
      results.ac7_hygiene = "no-card";
    }
  } catch (e) {
    results.error = String(e);
    await shot(page, "99-error").catch(() => {});
  } finally {
    console.log(JSON.stringify(results, null, 2));
    await browser.close();
  }
}
main();
