import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { BILLING_TEST_MODE } from "@/lib/plan-limits";
import { orgTodayKey } from "@/lib/timezone";
import {
  TRIAL_DAILY_LIMIT_CODE,
  TRIAL_LIMITS,
  TRIAL_SENSOR_LIMIT_CODE,
  decideTrialWrite,
  getTrialStatus,
  trialDailyLimitMessage,
  trialSensorLimitMessage,
  type TrialStatus,
  type TrialWriteDecision,
} from "@/lib/trial";

/**
 * Серверная часть тестового периода: счётчик ручных записей, гейты для
 * write-эндпоинтов и данные для карточки на дашборде.
 *
 * Отделена от `trial.ts` по той же причине, что `plan-limits.server.ts`:
 * чистый модуль читают клиентские компоненты, а `db` в браузерный бандл
 * тянуть нельзя.
 *
 * Дневной лимит считаем СЧЁТЧИКОМ на организации (`trialWritesDayKey`,
 * `trialWritesCount`), а не подсчётом строк в БД: автозаполнение кроном
 * и IoT-замеры тоже создают записи, и подсчёт строк исчерпывал бы квоту
 * к 06:00 без участия человека. Счётчик растёт только там, где стоит
 * `trialWriteGate` — то есть на ручных записях.
 */

const ORG_TRIAL_SELECT = {
  subscriptionPlan: true,
  subscriptionEnd: true,
  createdAt: true,
  timezone: true,
  trialWritesDayKey: true,
  trialWritesCount: true,
  account: { select: { subscriptionPlan: true } },
} as const;

type OrgTrialRow = {
  subscriptionPlan: string;
  subscriptionEnd: Date | null;
  createdAt: Date;
  timezone: string;
  trialWritesDayKey: string | null;
  trialWritesCount: number;
  account: { subscriptionPlan: string } | null;
};

/**
 * Тариф живёт на аккаунте, организация — legacy-зеркало (см. схему).
 * Даты теста при этом свои у каждой организации.
 */
function statusOf(org: OrgTrialRow, now: Date): TrialStatus {
  return getTrialStatus(
    {
      subscriptionPlan: org.account?.subscriptionPlan ?? org.subscriptionPlan,
      subscriptionEnd: org.subscriptionEnd,
      createdAt: org.createdAt,
    },
    now
  );
}

function usedToday(org: OrgTrialRow, dayKey: string): number {
  return org.trialWritesDayKey === dayKey ? org.trialWritesCount : 0;
}

/** Статус теста организации без счётчиков — для Mini App и лёгких проверок. */
export async function getOrgTrialStatus(
  organizationId: string,
  now: Date = new Date()
): Promise<TrialStatus | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: ORG_TRIAL_SELECT,
  });
  return org ? statusOf(org, now) : null;
}

/**
 * Пропускает ли бесплатный тариф ещё `count` ручных записей — и, если
 * да, учитывает их в дневном счётчике. Вызывать непосредственно перед
 * записью в БД, после всех проверок доступа и валидации.
 */
export async function consumeTrialWrite(
  organizationId: string,
  count: number = 1,
  now: Date = new Date()
): Promise<TrialWriteDecision> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: ORG_TRIAL_SELECT,
  });
  // Нет организации — не наше дело, эндпоинт сам ответит 404.
  if (!org) {
    return {
      allowed: true,
      used: 0,
      limit: TRIAL_LIMITS.entriesPerDay,
      softExceeded: false,
    };
  }

  const status = statusOf(org, now);
  const dayKey = orgTodayKey(org.timezone, now);
  const used = usedToday(org, dayKey);
  const decision = decideTrialWrite({
    limited: status.limited,
    used,
    count,
    testMode: BILLING_TEST_MODE,
  });
  if (!decision.allowed || !status.limited) return decision;

  const increment = Math.max(1, Math.trunc(count));
  if (org.trialWritesDayKey === dayKey) {
    await db.organization.update({
      where: { id: organizationId },
      data: { trialWritesCount: { increment } },
    });
  } else {
    await db.organization.update({
      where: { id: organizationId },
      data: { trialWritesDayKey: dayKey, trialWritesCount: increment },
    });
  }
  return decision;
}

/**
 * Гейт для write-эндпоинтов: `null` — пишите дальше, иначе готовый 402.
 *
 *   const limited = await trialWriteGate(organizationId, entries.length);
 *   if (limited) return limited;
 */
export async function trialWriteGate(
  organizationId: string,
  count: number = 1
): Promise<NextResponse | null> {
  const decision = await consumeTrialWrite(organizationId, count);
  if (decision.allowed) return null;
  return NextResponse.json(
    {
      error: trialDailyLimitMessage(decision.limit),
      code: TRIAL_DAILY_LIMIT_CODE,
      used: decision.used,
      limit: decision.limit,
    },
    { status: 402 }
  );
}

/**
 * Гейт на привязку Tuya-датчика. `excludeEquipmentId` — оборудование,
 * которое сейчас редактируют: его собственный датчик в счёт не идёт.
 */
export async function trialSensorGate(
  organizationId: string,
  options: { excludeEquipmentId?: string } = {}
): Promise<NextResponse | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: ORG_TRIAL_SELECT,
  });
  if (!org) return null;
  const status = statusOf(org, new Date());
  if (!status.limited || BILLING_TEST_MODE) return null;

  const linked = await db.equipment.count({
    where: {
      area: { organizationId },
      tuyaDeviceId: { not: null },
      ...(options.excludeEquipmentId
        ? { id: { not: options.excludeEquipmentId } }
        : {}),
    },
  });
  if (linked < TRIAL_LIMITS.tuyaSensors) return null;

  return NextResponse.json(
    {
      error: trialSensorLimitMessage(TRIAL_LIMITS.tuyaSensors),
      code: TRIAL_SENSOR_LIMIT_CODE,
      used: linked,
      limit: TRIAL_LIMITS.tuyaSensors,
    },
    { status: 402 }
  );
}

export type TrialUsage = {
  status: TrialStatus;
  entriesToday: number;
  entriesLimit: number;
  sensors: number;
  sensorsLimit: number;
  aiLeft: number;
  aiQuota: number;
  billingTestMode: boolean;
};

/**
 * Данные для карточки тестового периода. `null` — тариф платный или
 * приостановлен: показывать нечего.
 */
export async function getTrialUsage(
  organizationId: string,
  now: Date = new Date()
): Promise<TrialUsage | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      ...ORG_TRIAL_SELECT,
      aiMonthlyMessagesLeft: true,
      aiMonthlyQuota: true,
    },
  });
  if (!org) return null;
  const status = statusOf(org, now);
  if (!status.limited) return null;

  const sensors = await db.equipment.count({
    where: { area: { organizationId }, tuyaDeviceId: { not: null } },
  });

  return {
    status,
    entriesToday: usedToday(org, orgTodayKey(org.timezone, now)),
    entriesLimit: TRIAL_LIMITS.entriesPerDay,
    sensors,
    sensorsLimit: TRIAL_LIMITS.tuyaSensors,
    aiLeft: Math.max(0, org.aiMonthlyMessagesLeft),
    aiQuota: org.aiMonthlyQuota,
    billingTestMode: BILLING_TEST_MODE,
  };
}

/**
 * «Сократить функционал»: остаться на бесплатном тарифе после теста.
 * Пишем и в аккаунт, и в организацию — тем же правилом, что
 * `ensurePlanForHeadcount`, чтобы зеркало не разъехалось.
 */
export async function reduceTrialToFreePlan(
  organizationId: string,
  actor: { id: string; name: string | null }
): Promise<{ plan: string; changed: boolean }> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      accountId: true,
      subscriptionPlan: true,
      account: { select: { subscriptionPlan: true } },
    },
  });
  if (!org) return { plan: "trial", changed: false };

  const current = org.account?.subscriptionPlan ?? org.subscriptionPlan;
  if (current !== "trial") return { plan: current, changed: false };

  await db.$transaction(async (tx) => {
    if (org.accountId) {
      await tx.account.update({
        where: { id: org.accountId },
        data: { subscriptionPlan: "free" },
      });
    }
    await tx.organization.updateMany({
      where: org.accountId ? { accountId: org.accountId } : { id: organizationId },
      data: { subscriptionPlan: "free" },
    });
  });

  try {
    await db.auditLog.create({
      data: {
        organizationId,
        userId: actor.id,
        userName: actor.name,
        action: "plan.trial_reduced",
        entity: "organization",
        entityId: organizationId,
        details: { from: "trial", to: "free", limits: TRIAL_LIMITS },
      },
    });
  } catch (err) {
    console.error("[trial] audit write failed", err);
  }

  return { plan: "free", changed: true };
}
