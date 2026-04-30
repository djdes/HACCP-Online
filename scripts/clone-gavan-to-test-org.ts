/**
 * One-shot script: клонирует все настройки + должности + journal-access
 * из «Вкусной Гавани» в новую тестовую организацию + создаёт штат
 * (1 админ + 1 заведующая + 5 поваров + 2 продавца + 2 уборщика).
 *
 * Запуск через SSH на проде:
 *   set -a && . ./.env && set +a && npx tsx scripts/clone-gavan-to-test-org.ts
 */
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const SOURCE_ORG_ID = "cmofh4d7g0000r1tsnieusiyf"; // Ресторан «Вкусная Гавань»
const NEW_ORG_NAME = "Тест-копия Гавани";
const DOMAIN = "gavan-copy.test";
const TEMP_PASSWORD = "Test1234!";

async function main() {
  const source = await db.organization.findUnique({
    where: { id: SOURCE_ORG_ID },
  });
  if (!source) throw new Error(`Source org ${SOURCE_ORG_ID} not found`);

  // 1. Organization — копируем settings, новый id auto.
  const newOrg = await db.organization.create({
    data: {
      name: NEW_ORG_NAME,
      type: source.type,
      locale: source.locale,
      timezone: source.timezone,
      shiftEndHour: source.shiftEndHour,
      lockPastDayEdits: source.lockPastDayEdits,
      requireAdminForJournalEdit: source.requireAdminForJournalEdit,
      disabledJournalCodes: source.disabledJournalCodes ?? [],
      autoJournalCodes: source.autoJournalCodes ?? [],
      brandColor: source.brandColor,
      subscriptionPlan: source.subscriptionPlan,
      subscriptionEnd: source.subscriptionEnd,
      aiMonthlyMessagesLeft: source.aiMonthlyQuota,
      aiMonthlyQuota: source.aiMonthlyQuota,
      webhookUrls: source.webhookUrls ?? [],
    },
  });
  console.log("[org] created:", newOrg.id, newOrg.name);

  // 2. JobPositions — фиксированный набор по запросу пользователя.
  const positions = await Promise.all([
    db.jobPosition.create({
      data: {
        organizationId: newOrg.id,
        categoryKey: "management",
        name: "Админ",
        sortOrder: 0,
      },
    }),
    db.jobPosition.create({
      data: {
        organizationId: newOrg.id,
        categoryKey: "management",
        name: "Заведующий",
        sortOrder: 10,
      },
    }),
    db.jobPosition.create({
      data: {
        organizationId: newOrg.id,
        categoryKey: "staff",
        name: "Повар",
        sortOrder: 20,
      },
    }),
    db.jobPosition.create({
      data: {
        organizationId: newOrg.id,
        categoryKey: "staff",
        name: "Продавец",
        sortOrder: 30,
      },
    }),
    db.jobPosition.create({
      data: {
        organizationId: newOrg.id,
        categoryKey: "staff",
        name: "Уборщик",
        sortOrder: 40,
      },
    }),
  ]);
  const [posAdmin, posHead, posCook, posSeller, posCleaner] = positions;
  console.log(
    "[positions] created:",
    positions.map((p) => p.name).join(", ")
  );

  // 3. JobPositionJournalAccess — копируем по совпадению имён должностей
  //    из source. То что нет в source — оставляем пустым (ROOT настроит).
  const sourcePositions = await db.jobPosition.findMany({
    where: { organizationId: SOURCE_ORG_ID },
  });
  const byName = new Map(sourcePositions.map((p) => [p.name.toLowerCase(), p]));

  let accessCopied = 0;
  for (const newPos of positions) {
    // Ищем по нечёткому совпадению (admin → "Админ"/"Администратор",
    // head → "Заведующий"/"Управляющий", cook → "Повар", и т.д.).
    const cands = [newPos.name];
    if (newPos.name === "Заведующий") cands.push("Управляющий", "Заведующая");
    if (newPos.name === "Админ") cands.push("Администратор", "Owner");
    if (newPos.name === "Уборщик") cands.push("Клинер");
    let srcPos: (typeof sourcePositions)[number] | undefined;
    for (const c of cands) {
      const hit = byName.get(c.toLowerCase());
      if (hit) {
        srcPos = hit;
        break;
      }
    }
    if (!srcPos) continue;

    const access = await db.jobPositionJournalAccess.findMany({
      where: { organizationId: SOURCE_ORG_ID, jobPositionId: srcPos.id },
    });
    if (access.length === 0) continue;
    await db.jobPositionJournalAccess.createMany({
      data: access.map((a) => ({
        organizationId: newOrg.id,
        jobPositionId: newPos.id,
        templateId: a.templateId,
      })),
      skipDuplicates: true,
    });
    accessCopied += access.length;
    console.log(
      `[access] ${newPos.name} ← ${srcPos.name}: ${access.length} журналов`
    );
  }
  console.log(`[access] всего скопировано: ${accessCopied}`);

  // 4. Users — фиксированный список.
  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const userSpecs = [
    {
      role: "owner",
      name: "Главный Админ",
      email: `admin@${DOMAIN}`,
      pos: posAdmin,
    },
    {
      role: "manager",
      name: "Заведующая Анна Петрова",
      email: `head@${DOMAIN}`,
      pos: posHead,
    },
    { role: "cook", name: "Повар Иванов И.", email: `cook1@${DOMAIN}`, pos: posCook },
    { role: "cook", name: "Повар Сидорова О.", email: `cook2@${DOMAIN}`, pos: posCook },
    { role: "cook", name: "Повар Кузнецов А.", email: `cook3@${DOMAIN}`, pos: posCook },
    { role: "cook", name: "Повар Петров В.", email: `cook4@${DOMAIN}`, pos: posCook },
    { role: "cook", name: "Повар Смирнова Е.", email: `cook5@${DOMAIN}`, pos: posCook },
    { role: "waiter", name: "Продавец Орлова К.", email: `seller1@${DOMAIN}`, pos: posSeller },
    { role: "waiter", name: "Продавец Лебедев С.", email: `seller2@${DOMAIN}`, pos: posSeller },
    { role: "cook", name: "Уборщик Маркова Г.", email: `cleaner1@${DOMAIN}`, pos: posCleaner },
    { role: "cook", name: "Уборщик Захаров Б.", email: `cleaner2@${DOMAIN}`, pos: posCleaner },
  ];

  const created: Array<{ id: string; email: string; role: string; name: string }> = [];
  for (const u of userSpecs) {
    const r = await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash,
        role: u.role,
        organizationId: newOrg.id,
        jobPositionId: u.pos.id,
        positionTitle: u.pos.name,
        isActive: true,
        // ACL включаем сразу — иначе hasJournalAccess грантит всё подряд
        // и теряется смысл per-position access. Доступ управляется
        // должностью через JobPositionJournalAccess.
        journalAccessMigrated: true,
      },
    });
    created.push({ id: r.id, email: r.email, role: r.role, name: r.name });
  }

  // 5. ManagerScope — заведующая видит весь staff, может assign'ить любые
  //    журналы (assignableJournalCodes = []  означает «все доступные»).
  const headUser = created[1];
  const staffIds = created.slice(2).map((c) => c.id);
  await db.managerScope.create({
    data: {
      organizationId: newOrg.id,
      managerId: headUser.id,
      viewMode: "specific_users",
      viewUserIds: staffIds,
      viewJobPositionIds: [],
      assignableJournalCodes: [],
    },
  });
  console.log(`[scope] заведующая видит ${staffIds.length} сотрудников`);

  // 6. Output
  console.log("\n========== READY ==========");
  console.log(`Organization: ${newOrg.name} (${newOrg.id})`);
  console.log(`Login URL:    https://wesetup.ru/login`);
  console.log(`Password:     ${TEMP_PASSWORD}  (одинаковый для всех)\n`);
  console.log("Users:");
  for (const c of created) {
    console.log(`  ${c.email.padEnd(30)} ${c.role.padEnd(10)} ${c.name}`);
  }
  console.log("===========================\n");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
