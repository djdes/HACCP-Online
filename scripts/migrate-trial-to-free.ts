/**
 * Переводит legacy-тариф `trial` в `free`.
 *
 * Тестовый период отменён: бесплатный тариф больше не ограничен ни
 * сроком, ни записями — только численностью (`FREE_MAX_USERS`). Старые
 * аккаунты и организации ещё лежат с `subscriptionPlan: "trial"` и датой
 * `subscriptionEnd`, которую регистрация ставила как «конец теста».
 * Код читает `trial` как алиас `free`, но чтобы значение не жило вечно,
 * переписываем его явно и обнуляем дату окончания у организаций.
 *
 * Идемпотентен: повторный прогон ничего не находит. Без `--apply` —
 * сухой прогон.
 *
 *   npx tsx --env-file=.env.local scripts/migrate-trial-to-free.ts          # что будет сделано
 *   npx tsx --env-file=.env.local scripts/migrate-trial-to-free.ts --apply  # сделать
 */

import { db } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

async function main() {
  const accounts = await db.account.count({
    where: { subscriptionPlan: "trial" },
  });
  const organizations = await db.organization.count({
    where: { subscriptionPlan: "trial" },
  });
  const organizationsWithEnd = await db.organization.count({
    where: { subscriptionPlan: "trial", subscriptionEnd: { not: null } },
  });

  console.log(`аккаунтов на trial: ${accounts}`);
  console.log(
    `организаций на trial: ${organizations} (с датой окончания: ${organizationsWithEnd})`,
  );

  if (!APPLY) {
    console.log(
      `DRY-RUN. Будет переведено: аккаунтов ${accounts}, организаций ${organizations}. Запустите с --apply.`,
    );
    return;
  }

  const result = await db.$transaction(async (tx) => {
    const accountsUpdated = await tx.account.updateMany({
      where: { subscriptionPlan: "trial" },
      data: { subscriptionPlan: "free" },
    });
    const organizationsUpdated = await tx.organization.updateMany({
      where: { subscriptionPlan: "trial" },
      data: { subscriptionPlan: "free", subscriptionEnd: null },
    });
    return {
      accounts: accountsUpdated.count,
      organizations: organizationsUpdated.count,
    };
  });

  const leftAccounts = await db.account.count({
    where: { subscriptionPlan: "trial" },
  });
  const leftOrganizations = await db.organization.count({
    where: { subscriptionPlan: "trial" },
  });
  console.log(
    `переведено: аккаунтов ${result.accounts}, организаций ${result.organizations}; ` +
      `осталось на trial: аккаунтов ${leftAccounts}, организаций ${leftOrganizations}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
