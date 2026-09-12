// Фаза C2 — передача клиенту, правка организации, уровень доступа
// (AC9 потолок, AC10, AC11, AC12).
// Запуск: npx tsx .agent/tasks/partner-autonomy-2026-09/e2e/phase-c2-manage.ts
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

const PARTNER_INN = "7700000001";
/** Активный клиент чужого партнёра — «чужого не трогаем». */
const FOREIGN_ORG = "cmtwzyj0c0000pbtsxz6vqvw4";
/** Давний клиент e2e-партнёра: source=manual, владелец уже принял. */
const OWNED_ORG = "cmtjt28h20000t49mvzncgpte";

type Reply = { status: number; json: Record<string, unknown> | null; text: string };
async function call(
  api: APIRequestContext,
  method: "post" | "patch",
  url: string,
  data?: unknown,
): Promise<Reply> {
  const res = await api[method](url, data === undefined ? {} : { data });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* не JSON */
  }
  return { status: res.status(), json, text: text.slice(0, 200) };
}

async function main() {
  const stamp = Date.now().toString().slice(-6);
  const created = JSON.parse(fs.readFileSync(path.join(HERE, "created.json"), "utf8")) as Record<string, string>;
  const orgA = created.noOwner;
  const seeded: string[] = [];

  const browser = await chromium.launch({ channel: "chrome" });
  try {
    const context = await browser.newContext({ storageState: STORAGE, viewport: { width: 1440, height: 900 } });
    const api = context.request;

    // ---------- AC9: потолок непереданных организаций ----------
    // Лимитер 5/час уже израсходован в C1, но проверка потолка стоит
    // РАНЬШЕ лимитера — значит ответ должен быть именно 409, а не 429.
    const pendingNow = await db.partnerClient.count({
      where: { partnerId: E2E_PARTNER_ID, source: "manual", detachedAt: null, organization: { users: { none: { isActive: true } } } },
    });
    for (let i = pendingNow; i < 10; i += 1) {
      const org = await db.organization.create({
        data: { name: `E2E потолок ${stamp}-${i}`, type: "cafe", subscriptionPlan: "free" },
        select: { id: true },
      });
      await db.partnerClient.create({
        data: { partnerId: E2E_PARTNER_ID, organizationId: org.id, accessLevel: "edit", source: "manual" },
      });
      seeded.push(org.id);
    }
    const capped = await call(api, "post", `${BASE}/api/partner/clients`, { name: `E2E сверх потолка ${stamp}`, sphere: "cafe" });
    record(
      "AC9 десять непереданных → 409 too_many_pending",
      capped.status === 409 && capped.json?.code === "too_many_pending",
      `${capped.status} ${capped.text}`,
    );

    // Подпорки убираем сразу — они нужны были только для одного ответа.
    for (const id of seeded) {
      await db.partnerClient.deleteMany({ where: { organizationId: id } });
      await db.organization.delete({ where: { id } });
    }
    seeded.length = 0;
    record("AC9 подпорки потолка удалены", true, `${pendingNow} было, освобождено`);

    // ---------- AC10: передача клиенту ----------
    const firstEmail = `e2e-handover-${stamp}@example.com`;
    const handover = await call(api, "post", `${BASE}/api/partner/clients/${orgA}/owner`, {
      email: firstEmail,
      name: "Пётр Передача",
      phone: "+7 999 111-22-33",
    });
    record("AC10 передача клиенту → 200", handover.status === 200, `${handover.status} ${handover.text}`);
    const state = (handover.json?.handover ?? {}) as Record<string, unknown>;
    record("AC10 состояние стало «приглашение отправлено»", state.status === "invited", String(state.status));

    const afterHandover = await db.organization.findUniqueOrThrow({
      where: { id: orgA },
      select: {
        accountId: true,
        members: { select: { role: true, user: { select: { email: true, isActive: true, phone: true, inviteToken: { select: { usedAt: true, tokenHash: true } } } } } },
      },
    });
    record("AC10 у организации появился аккаунт", Boolean(afterHandover.accountId), String(afterHandover.accountId));
    const owner = afterHandover.members.find((m) => m.role === "owner");
    record("AC10 владелец записан", owner?.user.email === firstEmail, owner?.user.email ?? "нет");
    record("AC10 телефон владельца сохранён", Boolean(owner?.user.phone), String(owner?.user.phone));
    const firstHash = owner?.user.inviteToken?.tokenHash ?? "";
    record("AC10 приглашение выписано", firstHash.length > 0);

    // Повтор на тот же адрес в течение суток — отказ.
    const tooSoon = await call(api, "post", `${BASE}/api/partner/clients/${orgA}/owner`, {
      email: firstEmail,
      name: "Пётр Передача",
    });
    record(
      "AC10 повтор на тот же адрес → 429 too_soon",
      tooSoon.status === 429 && tooSoon.json?.code === "too_soon",
      `${tooSoon.status} ${tooSoon.text}`,
    );

    // Опечатка в адресе: другой адрес принимается сразу, токен меняется.
    const secondEmail = `e2e-handover-fix-${stamp}@example.com`;
    const changed = await call(api, "post", `${BASE}/api/partner/clients/${orgA}/owner`, {
      email: secondEmail,
      name: "Пётр Передача",
    });
    record("AC10 смена адреса до принятия → 200", changed.status === 200, `${changed.status} ${changed.text}`);
    const afterChange = await db.organization.findUniqueOrThrow({
      where: { id: orgA },
      select: { members: { where: { role: "owner" }, select: { user: { select: { email: true, inviteToken: { select: { tokenHash: true } } } } } } },
    });
    const secondHash = afterChange.members[0]?.user.inviteToken?.tokenHash ?? "";
    record("AC10 адрес заменён", afterChange.members[0]?.user.email === secondEmail, afterChange.members[0]?.user.email ?? "");
    record("AC10 старая ссылка перестала работать", secondHash !== firstHash && secondHash.length > 0);

    // Чужой клиент — 404.
    const foreign = await call(api, "post", `${BASE}/api/partner/clients/${FOREIGN_ORG}/owner`, {
      email: `e2e-foreign-${stamp}@example.com`,
      name: "Чужой Клиент",
    });
    record("AC10 передача чужого клиента → 404", foreign.status === 404, `${foreign.status} ${foreign.text}`);

    // Владелец уже принял — менять нельзя.
    const alreadyOwned = await call(api, "post", `${BASE}/api/partner/clients/${OWNED_ORG}/owner`, {
      email: `e2e-owned-${stamp}@example.com`,
      name: "Поздно Уже",
    });
    record(
      "AC10 у принявшего владельца → 409 already_owned",
      alreadyOwned.status === 409 && alreadyOwned.json?.code === "already_owned",
      `${alreadyOwned.status} ${alreadyOwned.text}`,
    );

    // ---------- AC11: правка реквизитов организации ----------
    const newName = `E2E Кафе переименованное ${stamp}`;
    const edit = await call(api, "patch", `${BASE}/api/partner/clients/${orgA}`, {
      name: newName,
      timezone: "Asia/Vladivostok",
      locationsCount: 3,
      inn: "7712345678",
    });
    record("AC11 правка организации → 200", edit.status === 200, `${edit.status} ${edit.text}`);
    const edited = await db.organization.findUniqueOrThrow({
      where: { id: orgA },
      select: { name: true, timezone: true, locationsCount: true, inn: true, perLocationJournals: true, buildings: { select: { name: true } } },
    });
    record("AC11 название изменилось", edited.name === newName, edited.name);
    record("AC11 часовой пояс изменился", edited.timezone === "Asia/Vladivostok", edited.timezone);
    record("AC11 ИНН записан", edited.inn === "7712345678", String(edited.inn));
    record("AC11 точки заведены", edited.buildings.length >= 3, `${edited.buildings.length}: ${edited.buildings.map((b) => b.name).join(", ")}`);
    record("AC11 журналы по точкам включились", edited.perLocationJournals === true, String(edited.perLocationJournals));

    const editAudit = await db.auditLog.findFirst({
      where: { organizationId: orgA, action: "partner.org_updated" },
      orderBy: { createdAt: "desc" },
      select: { userName: true, details: true },
    });
    const ed = (editAudit?.details ?? {}) as { changed?: Record<string, { from: unknown; to: unknown }> };
    record(
      "AC11 аудит правки с «было → стало»",
      Boolean(ed.changed?.name) && (editAudit?.userName ?? "").startsWith("партнёр:"),
      JSON.stringify(ed.changed?.name ?? null),
    );

    const ownInn = await call(api, "patch", `${BASE}/api/partner/clients/${orgA}`, { inn: PARTNER_INN });
    record(
      "AC11 свой ИНН клиенту → 409",
      ownInn.status === 409 && ownInn.json?.code === "own_organization",
      `${ownInn.status} ${ownInn.text}`,
    );

    const foreignEdit = await call(api, "patch", `${BASE}/api/partner/clients/${FOREIGN_ORG}`, { name: "Захват" });
    record("AC11 правка чужого клиента → 404", foreignEdit.status === 404, `${foreignEdit.status} ${foreignEdit.text}`);
    const foreignOrg = await db.organization.findUniqueOrThrow({ where: { id: FOREIGN_ORG }, select: { name: true } });
    record("AC11 чужая организация не тронута", foreignOrg.name !== "Захват", foreignOrg.name);

    const emptyPatch = await call(api, "patch", `${BASE}/api/partner/clients/${orgA}`, {});
    record("AC11 пустая правка → 400", emptyPatch.status === 400, `${emptyPatch.status} ${emptyPatch.text}`);

    // ---------- AC12: уровень доступа ----------
    const before = await db.partnerClient.findFirstOrThrow({
      where: { partnerId: E2E_PARTNER_ID, organizationId: OWNED_ORG, detachedAt: null },
      select: { accessLevel: true },
    });
    const next = before.accessLevel === "edit" ? "view" : "edit";
    const notifBefore = await db.notification.count({ where: { organizationId: OWNED_ORG, kind: "partner_access_level" } });

    const level = await call(api, "patch", `${BASE}/api/partner/clients/${OWNED_ORG}/access-level`, { accessLevel: next });
    record("AC12 смена уровня партнёром → 200", level.status === 200, `${level.status} ${level.text}`);
    const afterLevel = await db.partnerClient.findFirstOrThrow({
      where: { partnerId: E2E_PARTNER_ID, organizationId: OWNED_ORG, detachedAt: null },
      select: { accessLevel: true },
    });
    record("AC12 уровень записан", afterLevel.accessLevel === next, `${before.accessLevel} → ${afterLevel.accessLevel}`);

    const levelAudit = await db.auditLog.findFirst({
      where: { organizationId: OWNED_ORG, action: "partner.access_level" },
      orderBy: { createdAt: "desc" },
      select: { details: true, userName: true },
    });
    const la = (levelAudit?.details ?? {}) as Record<string, unknown>;
    record("AC12 в аудите by=partner", la.by === "partner", JSON.stringify(la));

    // Уведомление клиенту — колокольчик в его кабинете.
    await new Promise((r) => setTimeout(r, 2500));
    const notifAfter = await db.notification.count({ where: { organizationId: OWNED_ORG, kind: "partner_access_level" } });
    record("AC12 клиенту пришло уведомление", notifAfter > notifBefore, `${notifBefore} → ${notifAfter}`);

    const foreignLevel = await call(api, "patch", `${BASE}/api/partner/clients/${FOREIGN_ORG}/access-level`, { accessLevel: "edit" });
    record("AC12 уровень чужого клиента → 404", foreignLevel.status === 404, `${foreignLevel.status} ${foreignLevel.text}`);

    const badLevel = await call(api, "patch", `${BASE}/api/partner/clients/${OWNED_ORG}/access-level`, { accessLevel: "god" });
    record("AC12 несуществующий уровень → 400", badLevel.status === 400, `${badLevel.status} ${badLevel.text}`);

    // ---------- Карточка клиента глазами ----------
    const page = await context.newPage();
    await page.goto(`${BASE}/partner/clients/${orgA}`, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const cardText = await page.evaluate(() => document.body.innerText);
    record("AC10 на карточке блок «Владелец»", cardText.includes("Владелец"));
    record("AC12 на карточке выбор уровня доступа", cardText.includes("Что вам доступно в кабинете клиента"));
    await page.screenshot({ path: path.join(SHOTS, "c2-client-card.png"), fullPage: true });

    fs.writeFileSync(path.join(HERE, "phase-c2.json"), JSON.stringify(checks, null, 2), "utf8");
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== Фаза C2: ${checks.length - failed.length}/${checks.length} ===`);
    if (failed.length) process.exitCode = 1;
  } finally {
    // Подпорки потолка не должны пережить падение скрипта.
    for (const id of seeded) {
      await db.partnerClient.deleteMany({ where: { organizationId: id } }).catch(() => undefined);
      await db.organization.delete({ where: { id } }).catch(() => undefined);
    }
    await browser.close();
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
