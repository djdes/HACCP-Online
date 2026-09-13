// Прод-проверка: повар открывает Mini App и получает СВОЙ экран.
// Заводим тестового повара в тестовой организации, входим им и смотрим,
// что отдают /api/mini/session и /api/mini/home.
// Запуск: npx tsx .agent/tasks/mini-explain-2026-09/verify-prod.ts
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

import { db } from "../partner-autonomy-2026-09/e2e/db";

const BASE = process.env.BASE ?? "https://wesetup.ru";
/** «Кафе „Тестовое 1“» — организация для проверок (см. память проекта). */
const ORG_ID = "cmoe6rpt4000097ts71yb922y";
const PASSWORD = "MiniCook!2026";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const email = `e2e-cook-${stamp}@example.com`;

  const position = await db.jobPosition.findFirst({
    where: { organizationId: ORG_ID, categoryKey: "staff" },
    select: { id: true, name: true, categoryKey: true, permissionsJson: true },
  });
  record("в тестовой организации есть должность персонала", Boolean(position), position?.name ?? "нет");
  if (!position) return;
  record(
    "у должности нет своих прав (значит работает дефолт)",
    position.permissionsJson === null,
    JSON.stringify(position.permissionsJson),
  );

  const cook = await db.user.create({
    data: {
      email,
      name: `Повар Проверкин ${stamp}`,
      passwordHash: bcrypt.hashSync(PASSWORD, 10),
      role: "cook",
      organizationId: ORG_ID,
      jobPositionId: position.id,
      isActive: true,
      journalAccessMigrated: false,
    },
    select: { id: true },
  });

  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript("window.__name = (fn) => fn;");
    const page = await context.newPage();

    await page.goto(`${BASE}/login`, { waitUntil: "load" });
    for (let i = 0; i < 40; i += 1) {
      await page.fill("#email", email);
      await page.fill("#password", PASSWORD);
      if ((await page.inputValue("#email")) === email) break;
      await page.waitForTimeout(300);
    }
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 90_000 });
    record("повар вошёл", true, page.url().replace(BASE, ""));

    // Сайт обязан увести линейного сотрудника в приложение. Проверяем
    // явным заходом: URL сразу после формы входа — ещё промежуточный,
    // цепочка редиректов на тот момент не завершена.
    for (const path of ["/dashboard", "/journals"]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(1500);
      record(
        `сайт уводит повара с ${path} в приложение`,
        page.url().includes("/mini"),
        page.url().replace(BASE, ""),
      );
    }

    const session = (await (await page.request.get(`${BASE}/api/mini/session`)).json()) as {
      mode?: string;
      permissions?: string[];
    };
    record("режим сессии = сотрудник", session.mode === "staff", String(session.mode));
    record(
      "право dashboard.view у повара есть (значит чинил не его отъём)",
      (session.permissions ?? []).includes("dashboard.view"),
    );
    record(
      "прав руководителя нет",
      !["staff.view", "staff.manage", "reports.view", "audit.view"].some((p) =>
        (session.permissions ?? []).includes(p),
      ),
    );

    const home = (await (await page.request.get(`${BASE}/api/mini/home`)).json()) as {
      mode?: string;
      summary?: unknown;
      now?: unknown[];
    };
    record("режим главной = сотрудник", home.mode === "staff", String(home.mode));
    record("сводки по заведению нет", home.summary === undefined);
    record("есть свой список задач", Array.isArray(home.now), `задач: ${home.now?.length ?? "—"}`);

    // Вкладка «Аудит» линейному больше не показывается, а её API закрыт.
    await page.goto(`${BASE}/mini`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const navText = await page.evaluate(() => document.body.innerText);
    record("вкладки «Аудит» в навигации нет", !navText.includes("Аудит"));
    const audit = await page.request.get(`${BASE}/api/mini/audit`);
    record("API аудита закрыт", audit.status() === 403, String(audit.status()));

    await page.screenshot({ path: ".agent/tasks/mini-explain-2026-09/mini-cook.png" });
  } finally {
    await browser.close();
    await db.user.delete({ where: { id: cook.id } }).catch(() => undefined);
    await db.$disconnect();
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n=== ${checks.length - failed.length}/${checks.length} ===`);
  if (failed.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
