import {
  BILLING_TEST_MODE,
  FREE_MAX_USERS,
  isFreePlan,
} from "@/lib/plan-limits";
import { db } from "@/lib/db";

/**
 * Серверная часть тарифных лимитов.
 *
 * Отделена от `plan-limits.ts` намеренно: константы и подписи читает и
 * шапка кабинета — клиентский компонент. Если в том же модуле лежит
 * `db`, webpack тянет `pg` в браузерный бандл и сборка падает на `fs`.
 */

export type EnsurePlanResult = {
  /** Перевели ли организацию на платный прямо сейчас. */
  upgraded: boolean;
  /** Тариф после проверки. */
  plan: string;
  /** Сколько активных сотрудников насчитали. */
  activeUsers: number;
};

/**
 * Пересчитывает численность организации и, если бесплатный лимит
 * превышен, переводит её на платный тариф.
 *
 * Вызывается после КАЖДОГО создания пользователя. Идемпотентна:
 * повторный вызов на уже платной организации ничего не делает.
 *
 * @param organizationId — пока лимит считается по одной организации.
 *   Когда появится Account (Часть H плана), сюда придёт accountId и
 *   счёт станет суммарным по всем организациям аккаунта.
 * @param options.force — перевести на платный независимо от численности
 *   (ручное «Улучшить тариф» со страницы `/settings/subscription`).
 */
export async function ensurePlanForHeadcount(
  organizationId: string,
  options: { force?: boolean } = {}
): Promise<EnsurePlanResult> {
  // Динамический импорт: файл читают и клиентские компоненты (ради
  // FREE_MAX_USERS и planLabel), а `db`/`telegram` тянут server-only код.

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, subscriptionPlan: true },
  });

  if (!org) {
    return { upgraded: false, plan: "trial", activeUsers: 0 };
  }

  const activeUsers = await db.user.count({
    where: { organizationId, isActive: true },
  });

  const overLimit = activeUsers > FREE_MAX_USERS;
  const shouldUpgrade =
    isFreePlan(org.subscriptionPlan) && (options.force === true || overLimit);

  if (!shouldUpgrade) {
    return { upgraded: false, plan: org.subscriptionPlan, activeUsers };
  }

  await db.organization.update({
    where: { id: organizationId },
    data: {
      subscriptionPlan: "paid",
      // Платный тариф без даты окончания: в тестовом режиме нечего
      // продлевать, а «просроченная» дата ломала бы read-only-логику.
      subscriptionEnd: null,
      planAutoUpgradedAt: new Date(),
    },
  });

  // Аудит — best-effort, ошибка записи не должна валить создание сотрудника.
  try {
    await db.auditLog.create({
      data: {
        organizationId,
        action: "plan.auto_upgraded",
        entity: "organization",
        entityId: organizationId,
        details: {
          activeUsers,
          freeLimit: FREE_MAX_USERS,
          reason: options.force ? "manual" : "headcount",
          billingTestMode: BILLING_TEST_MODE,
        },
      },
    });
  } catch (err) {
    console.error("[plan-limits] audit write failed", err);
  }

  // Уведомление владельцу: переход тарифа — не то, о чём стоит узнавать
  // из счёта. В тестовом режиме прямо пишем, что оплата не требуется.
  try {
    const { notifyOrganization } = await import("@/lib/telegram");
    await notifyOrganization(
      organizationId,
      [
        BILLING_TEST_MODE ? "🧪" : "💳",
        ` Организация «${org.name}» перешла на платный тариф.`,
        `\nСотрудников: ${activeUsers} (бесплатно — до ${FREE_MAX_USERS}).`,
        BILLING_TEST_MODE
          ? "\nСайт в тестовом режиме — оплата не требуется."
          : "",
      ].join(""),
      ["owner"]
    );
  } catch (err) {
    console.error("[plan-limits] telegram notify failed", err);
  }

  return { upgraded: true, plan: "paid", activeUsers };
}
