/**
 * Раздаёт существующим организациям аккаунт-владельца.
 *
 * До multi-org тариф жил на организации, и «кто владелец» нигде не было
 * записано — подразумевалось, что организация одна. Скрипт восстанавливает
 * связь: владелец = первый заведённый управляющий, вокруг него создаётся
 * Account, тариф переезжает туда, членство фиксируется явной строкой.
 *
 * Идемпотентен: организации с `accountId` пропускаются, членство пишется
 * через upsert. Без `--apply` — сухой прогон.
 *
 *   npx tsx scripts/migrate-multi-org.ts          # что будет сделано
 *   npx tsx scripts/migrate-multi-org.ts --apply  # сделать
 */

import { db } from "../src/lib/db";

const APPLY = process.argv.includes("--apply");

/** Роли, из которых выбираем владельца, в порядке предпочтения. */
const OWNER_ROLES = ["owner", "manager", "head_chef", "technologist"];

async function main() {
  const organizations = await db.organization.findMany({
    where: { accountId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, subscriptionPlan: true, subscriptionEnd: true },
  });

  console.log(`организаций без аккаунта: ${organizations.length}`);

  let created = 0;
  let skipped = 0;

  for (const organization of organizations) {
    const candidates = await db.user.findMany({
      where: { organizationId: organization.id, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true, ownedAccount: { select: { id: true } } },
    });

    const owner =
      candidates.find((user) => OWNER_ROLES.includes(user.role)) ??
      candidates[0];

    if (!owner) {
      // Организация без единого пользователя — это мусор от прерванной
      // регистрации. Аккаунт ей не нужен, но и падать из-за неё нельзя.
      console.log(`  ПРОПУСК ${organization.name}: нет пользователей`);
      skipped += 1;
      continue;
    }

    console.log(
      `  ${organization.name} → владелец ${owner.email}${APPLY ? "" : " (dry-run)"}`,
    );
    if (!APPLY) {
      created += 1;
      continue;
    }

    await db.$transaction(async (tx) => {
      // У владельца уже может быть аккаунт: он владеет несколькими
      // организациями, и мы дошли до второй.
      const account =
        owner.ownedAccount ??
        (await tx.account.create({
          data: {
            ownerUserId: owner.id,
            subscriptionPlan: organization.subscriptionPlan,
            subscriptionEnd: organization.subscriptionEnd,
          },
          select: { id: true },
        }));

      await tx.organization.update({
        where: { id: organization.id },
        data: { accountId: account.id },
      });

      await tx.organizationMember.upsert({
        where: {
          userId_organizationId: {
            userId: owner.id,
            organizationId: organization.id,
          },
        },
        create: {
          userId: owner.id,
          organizationId: organization.id,
          role: "owner",
        },
        update: { role: "owner" },
      });
    });
    created += 1;
  }

  const left = await db.organization.count({ where: { accountId: null } });
  console.log(
    APPLY
      ? `обработано: ${created}, пропущено: ${skipped}, осталось без аккаунта: ${left}`
      : `DRY-RUN. Будет обработано: ${created}, пропущено: ${skipped}. Запустите с --apply.`,
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
