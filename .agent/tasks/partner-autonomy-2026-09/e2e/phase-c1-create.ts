// Фаза C1 — партнёр заводит организации клиентов (AC8, AC9).
// Запуск: npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/phase-c1-create.ts
import fs from "node:fs";
import path from "node:path";
import { chromium, type APIRequestContext } from "playwright";

import { BASE, E2E_PARTNER_ID, HERE, STORAGE, type Check } from "./config";
import { db } from "./db";

const checks: Check[] = [];
function record(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

const SHOTS = path.join(HERE, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

/** ИНН партнёра — им же проверяем «собственная организация не клиент». */
const PARTNER_INN = "7700000001";
/** Активный пользователь вне команды партнёра. */
const OUTSIDER_EMAIL = "deliciouschef@yandex.ru";
/** Участник команды партнёра (он же ROOT). */
const TEAM_EMAIL = "admin@wesetup.ru";

async function create(api: APIRequestContext, body: Record<string, unknown>) {
  const res = await api.post(`${BASE}/api/partner/clients`, { data: body });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* не JSON */
  }
  return { status: res.status(), json, text: text.slice(0, 220) };
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const created: Record<string, string> = {};
  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ storageState: STORAGE, viewport: { width: 1440, height: 900 } });
    const api = context.request;

    // --- AC8: организация без владельца.
    const noOwner = await create(api, {
      name: `E2E Кафе без владельца ${stamp}`,
      sphere: "cafe",
      ownershipKind: "private",
      address: "Москва, ул. Тестовая, 1",
      phone: "+7 999 000-11-22",
      locationsCount: 1,
    });
    record("AC8 создание без владельца → 200", noOwner.status === 200, `${noOwner.status} ${noOwner.text}`);
    const orgA = String(noOwner.json?.organizationId ?? "");
    created.noOwner = orgA;

    if (orgA) {
      const row = await db.organization.findUniqueOrThrow({
        where: { id: orgA },
        select: {
          name: true,
          type: true,
          accountId: true,
          subscriptionPlan: true,
          disabledJournalCodes: true,
          journalAutomationJson: true,
          members: { select: { role: true } },
          partnerClients: { select: { source: true, accessLevel: true, detachedAt: true } },
        },
      });
      record("AC8 организация без аккаунта (не передана)", row.accountId === null, String(row.accountId));
      record("AC8 владельца ещё нет", row.members.length === 0, `${row.members.length} участников`);
      record("AC8 привязка source=manual", row.partnerClients[0]?.source === "manual", row.partnerClients[0]?.source);
      record("AC8 уровень доступа по умолчанию edit", row.partnerClients[0]?.accessLevel === "edit", row.partnerClients[0]?.accessLevel);
      record("AC8 тариф бесплатный", row.subscriptionPlan === "free", row.subscriptionPlan);
      record("AC8 сфера сохранена", row.type === "cafe", row.type);
      record(
        "AC8 набор журналов и автоматика заполнены",
        Array.isArray(row.disabledJournalCodes) && row.journalAutomationJson !== null,
        `disabled=${Array.isArray(row.disabledJournalCodes) ? (row.disabledJournalCodes as unknown[]).length : "?"}`,
      );

      const audit = await db.auditLog.findFirst({
        where: { organizationId: orgA, action: "partner.client_org_created" },
        select: { userName: true, details: true },
      });
      record("AC8 аудит создания записан", Boolean(audit), audit?.userName ?? "нет записи");
      record(
        "AC8 в аудите видно, что это партнёр",
        (audit?.userName ?? "").startsWith("партнёр:"),
        audit?.userName ?? "",
      );
    }

    // --- AC8: организация сразу с владельцем.
    const ownerEmail = `e2e-owner-${stamp}@example.com`;
    const withOwner = await create(api, {
      name: `E2E Кафе с владельцем ${stamp}`,
      sphere: "restaurant",
      locationsCount: 1,
      owner: { email: ownerEmail, name: "Иван Тестовый", phone: "+7 999 000-33-44" },
    });
    record("AC8 создание с владельцем → 200", withOwner.status === 200, `${withOwner.status} ${withOwner.text}`);
    const orgB = String(withOwner.json?.organizationId ?? "");
    created.withOwner = orgB;
    created.ownerEmail = ownerEmail;

    if (orgB) {
      const row = await db.organization.findUniqueOrThrow({
        where: { id: orgB },
        select: {
          accountId: true,
          members: { select: { role: true, user: { select: { email: true, isActive: true, passwordHash: true } } } },
        },
      });
      record("AC8 у организации появился свой аккаунт", Boolean(row.accountId), String(row.accountId));
      const owner = row.members.find((m) => m.role === "owner");
      record("AC8 владелец назначен", owner?.user.email === ownerEmail, owner?.user.email ?? "нет");
      record("AC8 владелец пока не активен", owner?.user.isActive === false, String(owner?.user.isActive));
      record("AC8 пароль не задан", owner?.user.passwordHash === "", `«${owner?.user.passwordHash}»`);

      const invite = await db.inviteToken.findFirst({
        where: { user: { email: ownerEmail } },
        select: { expiresAt: true, usedAt: true },
      });
      record("AC8 приглашение выписано", Boolean(invite), invite ? `до ${invite.expiresAt.toISOString()}` : "нет");
      record("AC8 приглашение ещё не использовано", invite?.usedAt === null, String(invite?.usedAt));

      const account = row.accountId
        ? await db.account.findUnique({ where: { id: row.accountId }, select: { subscriptionPlan: true, owner: { select: { email: true } } } })
        : null;
      record(
        "AC8 аккаунт принадлежит клиенту, не партнёру",
        account?.owner.email === ownerEmail,
        account?.owner.email ?? "нет",
      );
    }

    // --- AC9: отказы. Они срабатывают ДО лимитера, токены не тратятся.
    const ownInn = await create(api, { name: `E2E свой ИНН ${stamp}`, sphere: "cafe", inn: PARTNER_INN });
    record(
      "AC9 свой ИНН → 409 own_organization",
      ownInn.status === 409 && ownInn.json?.code === "own_organization",
      `${ownInn.status} ${ownInn.text}`,
    );

    const teamEmail = await create(api, {
      name: `E2E почта команды ${stamp}`,
      sphere: "cafe",
      owner: { email: TEAM_EMAIL, name: "Админ Тестов" },
    });
    record(
      "AC9 почта сотрудника партнёра → 409 partner_team_email",
      teamEmail.status === 409 && teamEmail.json?.code === "partner_team_email",
      `${teamEmail.status} ${teamEmail.text}`,
    );

    const taken = await create(api, {
      name: `E2E занятая почта ${stamp}`,
      sphere: "cafe",
      owner: { email: OUTSIDER_EMAIL, name: "Занятый Пользователь" },
    });
    record(
      "AC9 занятая почта → 409 email_taken",
      taken.status === 409 && taken.json?.code === "email_taken",
      `${taken.status} ${taken.text}`,
    );

    const shortName = await create(api, { name: "X", sphere: "cafe" });
    record("AC9 короткое название → 400", shortName.status === 400, `${shortName.status} ${shortName.text}`);

    const badInn = await create(api, { name: `E2E кривой ИНН ${stamp}`, sphere: "cafe", inn: "12345" });
    record("AC9 кривой ИНН → 400", badInn.status === 400, `${badInn.status} ${badInn.text}`);

    // Отказы не должны были создать ни одной организации.
    const junk = await db.organization.count({
      where: { name: { in: [`E2E свой ИНН ${stamp}`, `E2E почта команды ${stamp}`, `E2E занятая почта ${stamp}`, `E2E кривой ИНН ${stamp}`] } },
    });
    record("AC9 после отказов организаций не создано", junk === 0, `${junk}`);

    // --- AC9: лимитер 5 в час. Две попытки уже потрачены.
    const rateStatuses: number[] = [];
    for (let i = 3; i <= 6; i += 1) {
      const res = await create(api, { name: `E2E лимит ${stamp}-${i}`, sphere: "cafe" });
      rateStatuses.push(res.status);
      if (res.status === 200) created[`rate${i}`] = String(res.json?.organizationId ?? "");
      if (res.status === 429) break;
    }
    record(
      "AC9 шестое создание за час → 429",
      rateStatuses.includes(429),
      rateStatuses.join(", "),
    );

    // --- Обзор: бейдж «не передана клиенту».
    const page = await context.newPage();
    await page.goto(`${BASE}/partner`, { waitUntil: "load" });
    await page.waitForTimeout(1200);
    const badge = await page.evaluate(() => document.body.innerText.includes("не передана клиенту"));
    record("AC8 в списке клиентов есть пометка «не передана клиенту»", badge);
    await page.screenshot({ path: path.join(SHOTS, "c1-overview.png"), fullPage: false });

    fs.writeFileSync(path.join(HERE, "created.json"), JSON.stringify(created, null, 2), "utf8");
    fs.writeFileSync(path.join(HERE, "phase-c1.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== Фаза C1: ${checks.length - failed.length}/${checks.length} ===`);
    console.log("созданные организации:", JSON.stringify(created));
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
