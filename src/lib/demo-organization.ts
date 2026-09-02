import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  computeAutoJournalCodes,
  getDemoStaffForType,
  getOnboardingPreset,
} from "@/lib/onboarding-presets";
import { sphereToPreset } from "@/lib/org-profile";
import { createOrganization } from "@/lib/create-organization";
import {
  DEMO_ORG_TTL_DAYS,
  demoExpiresAtFrom,
  demoOrgName,
} from "@/lib/demo-organization.shared";

export {
  DEMO_ORG_TTL_DAYS,
  demoDaysLeft,
  demoExpiresAtFrom,
  demoOrgName,
} from "@/lib/demo-organization.shared";

/**
 * Демо-организация — песочница «как это выглядит, когда уже работает».
 *
 * Два входа с одним заселением:
 *   • ROOT: `POST /api/root/seed-demo-org` — своя org + owner-пользователь,
 *     живёт пока ROOT не удалит.
 *   • Владелец аккаунта: кнопка «Посмотреть на демо-данных» в анкете после
 *     регистрации (`POST /api/organizations/demo`) — вторая организация
 *     того же аккаунта с `isDemo=true`, удаляется по кнопке или cron'ом
 *     `purge-demo-orgs` через DEMO_ORG_TTL_DAYS.
 *
 * Демо-сотрудники в тарифе не считаются (см. plan-limits.server.ts).
 * Чистые helper'ы (имя, срок, дни) — в demo-organization.shared.ts, их
 * импортируют и клиентские компоненты.
 */

function utcDayStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Returns plausible per-template entry data. Keeps it simple and
 *  template-aware for the few high-traffic journals; everything else
 *  gets a generic "filled" marker. */
function generateEntryData(
  templateCode: string,
  jitterSeed: number
): Record<string, unknown> {
  const rand = (min: number, max: number) =>
    min + (max - min) * (Math.sin(jitterSeed * 12.9898) * 43758.5453 - Math.floor(Math.sin(jitterSeed * 12.9898) * 43758.5453));
  switch (templateCode) {
    case "hygiene":
      return {
        status: "healthy",
        temperatureAbove37: false,
      };
    case "health_check":
      return {
        status: "healthy",
        skinCondition: "normal",
        notes: "",
      };
    case "cold_equipment_control":
      // Generic — server-side temperature populated through Equipment
      // sensor mapping in real life. For demo, write a stub data object;
      // compliance считает по entry-existence, не по temperatures count
      // в relaxed-mode (см. today-compliance.ts).
      return {
        notes: "Замер выполнен",
        markedAt: new Date().toISOString(),
      };
    case "cleaning":
      return {
        completed: true,
        notes: "По регламенту",
      };
    case "fryer_oil":
      return {
        condition: "good",
        polarity: Math.round((10 + rand(0, 8)) * 10) / 10,
        replaced: false,
      };
    case "intensive_cooling":
      return {
        dishName: "Демо-блюдо",
        startTemperature: Math.round((75 + rand(0, 8)) * 10) / 10,
        endTemperature: Math.round((4 + rand(0, 2)) * 10) / 10,
      };
    default:
      return { completed: true };
  }
}

export type SeedDemoResult = {
  positionsCreated: number;
  staffCreated: number;
  documentsCreated: number;
  entriesCreated: number;
};

/**
 * Заселяет УЖЕ созданную организацию: должности пресета с доступом к
 * журналам, 10–20 демо-сотрудников, JournalDocument на текущий месяц по
 * каждому ежедневному журналу и записи за последние `daysOfHistory` дней
 * с реалистичным jitter'ом — чтобы дашборд был «зелёным», а не пустым.
 *
 * Организация должна быть свежей: должности создаются без проверки на
 * дубли, записи вставляются пачками.
 */
export async function seedDemoOrganizationData(input: {
  organizationId: string;
  /** Сфера или legacy-тип — прогоняется через sphereToPreset(). */
  sphere: string;
  /** Кто «создал» документы. */
  createdById: string;
  /** Дополнительные люди в ростере записей (ROOT добавляет своего owner'а). */
  extraEmployees?: Array<{ id: string; name: string }>;
  daysOfHistory?: number;
}): Promise<SeedDemoResult> {
  const orgId = input.organizationId;
  const orgType = sphereToPreset(input.sphere);
  const preset = getOnboardingPreset(orgType);
  const days = input.daysOfHistory ?? DEMO_ORG_TTL_DAYS;
  const emailSlug = `demo-${orgId.slice(-8).toLowerCase()}`;

  // 1. Должности пресета + доступ к журналам.
  const positionByName = new Map<string, string>();
  let sortOrder = 0;
  for (const pos of preset.positions) {
    const created = await db.jobPosition.create({
      data: {
        organizationId: orgId,
        categoryKey: pos.category,
        name: pos.name,
        sortOrder: sortOrder++,
      },
      select: { id: true },
    });
    positionByName.set(pos.name, created.id);
  }
  const allCodes = Array.from(
    new Set(preset.positions.flatMap((p) => p.journalCodes))
  );
  const templates = await db.journalTemplate.findMany({
    where: { code: { in: allCodes } },
    select: { id: true, code: true, name: true },
  });
  const tplByCode = new Map(templates.map((t) => [t.code, t.id]));
  const tplNameByCode = new Map(templates.map((t) => [t.code, t.name]));
  const codeByTplId = new Map(templates.map((t) => [t.id, t.code]));
  for (const pos of preset.positions) {
    const positionId = positionByName.get(pos.name);
    if (!positionId) continue;
    const ids = pos.journalCodes
      .map((c) => tplByCode.get(c))
      .filter((id): id is string => Boolean(id));
    if (ids.length === 0) continue;
    await db.jobPositionJournalAccess.createMany({
      data: ids.map((templateId) => ({
        organizationId: orgId,
        jobPositionId: positionId,
        templateId,
      })),
      skipDuplicates: true,
    });
  }

  // 2. Демо-сотрудники. Активные — иначе не попадут ни в ростер журналов,
  // ни в список команды; в тарифе они не считаются по флагу isDemo.
  const demoStaff = getDemoStaffForType(orgType);
  const staff: Array<{ id: string; name: string }> = [];
  for (const s of demoStaff) {
    const positionId = positionByName.get(s.positionName);
    if (!positionId) continue;
    const created = await db.user.create({
      data: {
        organizationId: orgId,
        name: s.fullName,
        email: `${emailSlug}-${s.phone.replace(/\D/g, "")}@wesetup.local`,
        passwordHash: "",
        role: "cook",
        phone: s.phone,
        jobPositionId: positionId,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    staff.push(created);
  }

  const allEmployees = [...(input.extraEmployees ?? []), ...staff];

  // 3. Документы ежедневных журналов на текущий месяц.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  monthEnd.setUTCHours(23, 59, 59, 999);
  const autoCodes = computeAutoJournalCodes(preset);
  const docByTemplateId = new Map<string, string>();
  for (const code of autoCodes) {
    const templateId = tplByCode.get(code);
    if (!templateId) continue;
    const tplName = tplNameByCode.get(code) ?? code;
    const doc = await db.journalDocument.create({
      data: {
        organizationId: orgId,
        templateId,
        title: `${tplName} (демо)`,
        dateFrom: monthStart,
        dateTo: monthEnd,
        status: "active",
        autoFill: true,
        config: {} as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
      select: { id: true },
    });
    docByTemplateId.set(templateId, doc.id);
  }

  // 4. Последние N дней: 70–100% ростера в каждый день. Гигиена и
  // осмотр — все, остальное — подмножество, чтобы compliance был не 100%.
  let entriesCreated = 0;
  const today = utcDayStart(now);
  for (const [templateId, documentId] of docByTemplateId.entries()) {
    const tplCode = codeByTplId.get(templateId) ?? "";
    const rows: Prisma.JournalDocumentEntryCreateManyInput[] = [];
    for (let i = 1; i <= days; i++) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - i);
      const roster =
        tplCode === "hygiene" || tplCode === "health_check"
          ? allEmployees
          : allEmployees.filter((_, idx) => (idx + i) % 3 !== 2);
      for (const emp of roster) {
        rows.push({
          documentId,
          employeeId: emp.id,
          date: day,
          data: generateEntryData(tplCode, emp.id.charCodeAt(0) + i) as Prisma.InputJsonValue,
        });
      }
    }
    if (rows.length === 0) continue;
    const result = await db.journalDocumentEntry.createMany({
      data: rows,
      skipDuplicates: true,
    });
    entriesCreated += result.count;
  }

  return {
    positionsCreated: positionByName.size,
    staffCreated: staff.length,
    documentsCreated: docByTemplateId.size,
    entriesCreated,
  };
}

/**
 * Демо для аккаунта владельца. Одно на аккаунт: живое — возвращаем как
 * есть; протухшее (cron ещё не дошёл) — удаляем и создаём заново.
 */
export async function createDemoOrganization(input: {
  accountId: string;
  ownerUserId: string;
  sphere: string;
}): Promise<{ organizationId: string; created: boolean; seed: SeedDemoResult | null }> {
  const now = new Date();
  const existing = await db.organization.findFirst({
    where: { accountId: input.accountId, isDemo: true },
    select: { id: true, demoExpiresAt: true },
  });
  if (existing) {
    if (!existing.demoExpiresAt || existing.demoExpiresAt > now) {
      return { organizationId: existing.id, created: false, seed: null };
    }
    await deleteDemoOrganization(existing.id);
  }

  const { organizationId } = await createOrganization({
    name: demoOrgName(input.sphere),
    sphere: input.sphere,
    accountId: input.accountId,
    ownerUserId: input.ownerUserId,
  });

  const preset = getOnboardingPreset(sphereToPreset(input.sphere));
  await db.organization.update({
    where: { id: organizationId },
    data: {
      isDemo: true,
      demoExpiresAt: demoExpiresAtFrom(now),
      // Ежедневные журналы продолжают заводиться cron'ом, как у ROOT-демо.
      autoJournalCodes: computeAutoJournalCodes(preset) as never,
    },
  });

  const seed = await seedDemoOrganizationData({
    organizationId,
    sphere: input.sphere,
    createdById: input.ownerUserId,
  });

  return { organizationId, created: true, seed };
}

export type DeleteDemoResult = { staff: number; documents: number; entries: number };

/** Счётчики для тоста «Удалено: …» — без удаления. */
export async function countDemoOrganization(organizationId: string): Promise<DeleteDemoResult> {
  const [staff, documents, entries] = await Promise.all([
    db.user.count({ where: { organizationId } }),
    db.journalDocument.count({ where: { organizationId } }),
    db.journalDocumentEntry.count({ where: { document: { organizationId } } }),
  ]);
  return { staff, documents, entries };
}

/**
 * Удаляет демо целиком. Все org-скоупные таблицы каскадятся с
 * Organization; TF-интеграции у демо не бывает, поэтому обход задач в
 * TasksFlow (как у ROOT-удаления) не нужен.
 */
export async function deleteDemoOrganization(organizationId: string): Promise<DeleteDemoResult> {
  const counts = await countDemoOrganization(organizationId);
  // `isDemo: true` в where — страховка от удаления боевой организации
  // по подставленному id: Prisma бросит P2025, а не снесёт данные.
  await db.organization.delete({ where: { id: organizationId, isDemo: true } });
  return counts;
}
