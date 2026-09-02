import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import { DEFAULT_REWARD_RULE, type RewardRule } from "./rewards";

/**
 * То, что Prisma-схема выразить не умеет, но без чего инварианты партнёрки
 * держатся только на прикладном коде:
 *
 *  • у организации не больше одного активного партнёра — частичный
 *    уникальный индекс по `organizationId WHERE detachedAt IS NULL`;
 *  • правила вознаграждения v1 существуют всегда — иначе первой оплате
 *    не по чему начислять.
 *
 * Идемпотентно, вызывается лениво из первого запроса, которому это нужно
 * (`prisma db push` на деплое создаёт таблицы, но не частичные индексы).
 */
let ensured: Promise<void> | null = null;

export function ensurePartnerSchemaExtras(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await db.$executeRawUnsafe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "PartnerClient_one_active_per_org" ' +
          'ON "PartnerClient" ("organizationId") WHERE "detachedAt" IS NULL',
      );
      await ensureDefaultRewardRule();
    })().catch((error) => {
      ensured = null;
      throw error;
    });
  }
  return ensured;
}

export async function ensureDefaultRewardRule(): Promise<void> {
  const count = await db.partnerRewardRule.count();
  if (count > 0) return;
  await db.partnerRewardRule
    .create({
      data: {
        version: DEFAULT_REWARD_RULE.version,
        subscriptionPercent: new Prisma.Decimal(DEFAULT_REWARD_RULE.subscriptionPercent),
        subscriptionMonths: DEFAULT_REWARD_RULE.subscriptionMonths,
        hardwarePercent: new Prisma.Decimal(DEFAULT_REWARD_RULE.hardwarePercent),
        bonusAmountRub: new Prisma.Decimal(DEFAULT_REWARD_RULE.bonusAmountRub),
        bonusAfterPayments: DEFAULT_REWARD_RULE.bonusAfterPayments,
        minPayoutRub: new Prisma.Decimal(DEFAULT_REWARD_RULE.minPayoutRub),
        effectiveFrom: new Date(),
        comment: "Стартовые правила партнёрской программы",
      },
    })
    .catch((error: unknown) => {
      // Параллельный первый запрос мог успеть раньше — версия уникальна.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }
      throw error;
    });
}

export function toRewardRule(row: {
  version: number;
  subscriptionPercent: Prisma.Decimal | number;
  subscriptionMonths: number;
  hardwarePercent: Prisma.Decimal | number;
  bonusAmountRub: Prisma.Decimal | number;
  bonusAfterPayments: number;
  minPayoutRub: Prisma.Decimal | number;
}): RewardRule {
  return {
    version: row.version,
    subscriptionPercent: Number(row.subscriptionPercent),
    subscriptionMonths: row.subscriptionMonths,
    hardwarePercent: Number(row.hardwarePercent),
    bonusAmountRub: Number(row.bonusAmountRub),
    bonusAfterPayments: row.bonusAfterPayments,
    minPayoutRub: Number(row.minPayoutRub),
  };
}

/** Действующая версия правил — последняя по номеру. */
export async function getCurrentRewardRule(): Promise<RewardRule> {
  await ensurePartnerSchemaExtras();
  const row = await db.partnerRewardRule.findFirst({ orderBy: { version: "desc" } });
  return row ? toRewardRule(row) : DEFAULT_REWARD_RULE;
}
