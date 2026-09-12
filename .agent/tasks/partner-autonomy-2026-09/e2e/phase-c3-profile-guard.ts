// Фаза C3 — анкета «Завершите регистрацию» в кабинете клиента (AC13, AC14).
// Проверяем обычным сотрудником партнёра, а не ROOT: у ROOT анкета не
// показывается по отдельному условию, и проверка была бы бессмысленной.
// Запуск: npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/phase-c3-profile-guard.ts
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

import { BASE, E2E_PARTNER_ID, HERE, STORAGE, type Check } from "./config";
import { db } from "./db";

const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const OWNED_ORG = "cmtjt28h20000t49mvzncgpte";
const PASSWORD = "E2eConsult!2026";

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const email = `e2e-consultant-${stamp}@example.com`;
  const browser = await chromium.launch({ channel: "chrome" });

  try {
    // ---------- Подготовка: сотрудник партнёра штатным путём ----------
    const rootCtx = await browser.newContext({ storageState: STORAGE });
    const teamRes = await rootCtx.request.post(`${BASE}/api/partner/team`, {
      data: { email, name: "Сергей Консультант" },
    });
    record("подготовка: сотрудник партнёра заведён", teamRes.status() === 200, `${teamRes.status()} ${(await teamRes.text()).slice(0, 120)}`);

    // Человек «принял приглашение»: задал пароль и активировался.
    // Телефон НЕ задаём — именно на него смотрит анкета регистрации.
    const consultant = await db.user.update({
      where: { email },
      data: { passwordHash: bcrypt.hashSync(PASSWORD, 10), isActive: true, phone: null },
      select: { id: true, organizationId: true, isActive: true, phone: true, isRoot: true },
    });
    record("подготовка: телефона у сотрудника нет", consultant.phone === null && consultant.isRoot !== true, JSON.stringify(consultant));

    // Уровень доступа — «редактирование»: иначе 403 на анкете нельзя
    // будет отличить от общего запрета записи в режиме просмотра.
    await rootCtx.request.patch(`${BASE}/api/partner/clients/${OWNED_ORG}/access-level`, {
      data: { accessLevel: "edit" },
    });
    const level = await db.partnerClient.findFirstOrThrow({
      where: { partnerId: E2E_PARTNER_ID, organizationId: OWNED_ORG, detachedAt: null },
      select: { accessLevel: true },
    });
    record("подготовка: уровень доступа = edit", level.accessLevel === "edit", level.accessLevel);
    await rootCtx.close();

    // ---------- Вход сотрудником ----------
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "load" });
    for (let i = 0; i < 30; i += 1) {
      await page.fill("#email", email);
      await page.fill("#password", PASSWORD);
      if ((await page.inputValue("#email")) === email) break;
      await page.waitForTimeout(300);
    }
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
    const session = ((await (await page.request.get(`${BASE}/api/auth/session`)).json()) ?? {}) as {
      user?: { email?: string; isRoot?: boolean };
    };
    record("вход сотрудником партнёра", session.user?.email === email, JSON.stringify(session.user ?? null));
    record("это не ROOT", session.user?.isRoot !== true, String(session.user?.isRoot));

    // ---------- Вход в кабинет клиента ----------
    const open = await page.request.post(`${BASE}/api/partner/clients/${OWNED_ORG}/open`);
    record("«Открыть кабинет» → 200", open.status() === 200, String(open.status()));

    await page.goto(`${BASE}/dashboard`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const inPartnerMode = ((await (await page.request.get(`${BASE}/api/auth/session`)).json()) ?? {}) as {
      user?: { partnerAccess?: { level?: string } | null; activeOrganizationId?: string | null };
    };
    record(
      "сессия в партнёрском режиме",
      inPartnerMode.user?.partnerAccess?.level === "edit",
      JSON.stringify(inPartnerMode.user?.partnerAccess ?? null),
    );

    // ---------- AC13: анкеты нет ----------
    const bodyText = await page.evaluate(() => document.body.innerText);
    record("AC13 нет баннера «Завершите регистрацию»", !bodyText.includes("Завершите регистрацию"));
    await page.screenshot({ path: path.join(SHOTS, "c3-client-dashboard.png"), fullPage: false });

    // ---------- AC13: путь записи закрыт ----------
    const orgBefore = await db.organization.findUniqueOrThrow({
      where: { id: OWNED_ORG },
      select: { name: true, type: true, inn: true, address: true, locationsCount: true },
    });
    const complete = await page.request.post(`${BASE}/api/profile/complete`, {
      data: {
        organizationName: "ЗАХВАЧЕНО КОНСУЛЬТАНТОМ",
        sphere: "bar",
        ownershipKind: "state",
        locationsCount: 9,
        inn: "9999999999",
        phone: "+7 999 999-99-99",
        name: "Захват",
      },
    });
    record("AC13 POST /api/profile/complete → 403", complete.status() === 403, `${complete.status()} ${(await complete.text()).slice(0, 160)}`);
    const orgAfter = await db.organization.findUniqueOrThrow({
      where: { id: OWNED_ORG },
      select: { name: true, type: true, inn: true, address: true, locationsCount: true },
    });
    record(
      "AC13 организация клиента не перезаписана",
      JSON.stringify(orgBefore) === JSON.stringify(orgAfter),
      `${orgBefore.name} / ${orgAfter.name}`,
    );

    // ---------- Контроль: обычная правка при edit по-прежнему работает ----------
    const allowed = await page.request.patch(`${BASE}/api/settings/organization`, {
      data: { phone: "+7 495 000-00-00" },
    });
    record(
      "контроль: разрешённая правка при edit → 200",
      allowed.status() === 200,
      `${allowed.status()} ${(await allowed.text()).slice(0, 120)}`,
    );

    // ---------- Выход из кабинета клиента ----------
    const exitRes = await page.request.post(`${BASE}/api/partner/exit`);
    record("выход из кабинета клиента → 200", exitRes.status() === 200, String(exitRes.status()));

    fs.writeFileSync(path.join(HERE, "phase-c3.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== Фаза C3: ${checks.length - failed.length}/${checks.length} ===`);
    console.log("сотрудник партнёра:", email);
    if (failed.length) process.exitCode = 1;
  } finally {
    await browser.close();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
