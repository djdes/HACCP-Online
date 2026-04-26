/**
 * Сид-скрипт «Ресторан «Вкусная Гавань»» — полная демо-компания со
 * всеми сущностями, готовыми к проверке user-flow.
 *
 * Запускать на проде:
 *   npx tsx prisma/seed-restaurant.ts
 *
 * Что делает:
 *   1. Удаляет старую org с тем же именем (если есть).
 *   2. Создаёт Organization (type=restaurant) + admin user.
 *   3. Канонические должности (16 шт).
 *   4. 20 сотрудников разных ролей с уникальными телефонами +7991...
 *   5. Зоны (areas) — 7 шт.
 *   6. Оборудование (equipment) — 18 шт по зонам.
 *   7. Документы для всех 35 журналов (через resolveJournalPeriod).
 *   8. Расставляет responsibleUserId по логике должностей.
 *   9. JobPositionJournalAccess через onboarding-presets restaurant.
 *  10. JobPosition.visibleUserIds — иерархия видимости.
 *  11. TasksFlowIntegration с переданным TFK-ключом.
 *
 * Параметры через env:
 *   ADMIN_EMAIL          (default admin@vkusnaya-gavan.ru)
 *   ADMIN_PASSWORD       (default Restaurant2604!)
 *   TASKSFLOW_API_KEY    (default tfk_DpDlWdxcsJNyrOZaiON3GpobMYGs3mwVd5T9LLH6ZLA)
 *   TASKSFLOW_BASE_URL   (default https://tasksflow.ru)
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import crypto from "node:crypto";
import {
  encryptSecret,
  generateWebhookSecret,
} from "../src/lib/integration-crypto";
import { resolveJournalPeriod } from "../src/lib/journal-period";
import { getOnboardingPreset } from "../src/lib/onboarding-presets";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ORG_NAME = "Ресторан «Вкусная Гавань»";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@vkusnaya-gavan.ru";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "Restaurant2604!";
const ADMIN_PHONE = "+79911000001";
const TASKSFLOW_API_KEY =
  process.env.TASKSFLOW_API_KEY ??
  "tfk_DpDlWdxcsJNyrOZaiON3GpobMYGs3mwVd5T9LLH6ZLA";
const TASKSFLOW_BASE_URL =
  process.env.TASKSFLOW_BASE_URL ?? "https://tasksflow.ru";

interface PositionSpec {
  category: "management" | "staff";
  name: string;
}

const POSITIONS: PositionSpec[] = [
  { category: "management", name: "Управляющий" },
  { category: "management", name: "Шеф-повар" },
  { category: "management", name: "Су-шеф" },
  { category: "management", name: "Технолог" },
  { category: "staff", name: "Повар горячего цеха" },
  { category: "staff", name: "Повар холодного цеха" },
  { category: "staff", name: "Повар-кондитер" },
  { category: "staff", name: "Бармен" },
  { category: "staff", name: "Официант" },
  { category: "staff", name: "Менеджер зала" },
  { category: "staff", name: "Хостес" },
  { category: "staff", name: "Кладовщик" },
  { category: "staff", name: "Грузчик" },
  { category: "staff", name: "Посудомойщик" },
  { category: "staff", name: "Уборщик" },
  { category: "staff", name: "Стажёр" },
];

interface StaffSpec {
  positionName: string;
  fullName: string;
  phone: string;
}

// 20 сотрудников. Должности подобраны как в реальном ресторане.
const STAFF: StaffSpec[] = [
  // 1 — главный (создаётся отдельно как admin, тут не дублируем)
  // Кухня (10):
  { positionName: "Шеф-повар", fullName: "Сергей Морозов", phone: "+79911000010" },
  { positionName: "Су-шеф", fullName: "Дмитрий Беляев", phone: "+79911000011" },
  { positionName: "Повар горячего цеха", fullName: "Иван Петров", phone: "+79911000012" },
  { positionName: "Повар горячего цеха", fullName: "Алексей Орлов", phone: "+79911000013" },
  { positionName: "Повар холодного цеха", fullName: "Ольга Кашина", phone: "+79911000014" },
  { positionName: "Повар холодного цеха", fullName: "Татьяна Волкова", phone: "+79911000015" },
  { positionName: "Повар-кондитер", fullName: "Марина Соловьёва", phone: "+79911000016" },
  { positionName: "Стажёр", fullName: "Никита Лебедев", phone: "+79911000017" },
  { positionName: "Технолог", fullName: "Елена Гончарова", phone: "+79911000018" },
  // Зал и бар (5):
  { positionName: "Менеджер зала", fullName: "Анна Соколова", phone: "+79911000019" },
  { positionName: "Хостес", fullName: "Мария Чайкова", phone: "+79911000020" },
  { positionName: "Официант", fullName: "Дарья Подносова", phone: "+79911000021" },
  { positionName: "Официант", fullName: "Артём Смирнов", phone: "+79911000022" },
  { positionName: "Бармен", fullName: "Кирилл Барсуков", phone: "+79911000023" },
  // Склад / уборка (4):
  { positionName: "Кладовщик", fullName: "Виктория Складова", phone: "+79911000024" },
  { positionName: "Грузчик", fullName: "Игорь Тяжёлов", phone: "+79911000025" },
  { positionName: "Посудомойщик", fullName: "Лидия Пеньова", phone: "+79911000026" },
  { positionName: "Уборщик", fullName: "Виктор Чистов", phone: "+79911000027" },
  { positionName: "Уборщик", fullName: "Зинаида Швабина", phone: "+79911000028" },
];
// Итого: 1 (управляющий) + 19 (выше) = 20 ✅

interface AreaSpec {
  name: string;
  description?: string;
  equipment: { name: string; type: string; tempMin?: number; tempMax?: number }[];
}

const AREAS: AreaSpec[] = [
  {
    name: "Горячий цех",
    description: "Тепловая обработка, основные блюда",
    equipment: [
      { name: "Плита 6-конфорочная", type: "stove" },
      { name: "Конвекционная печь", type: "oven" },
      { name: "Фритюр L', 2 ванны", type: "fryer" },
      { name: "Жарочная поверхность", type: "stove" },
    ],
  },
  {
    name: "Холодный цех",
    description: "Салаты, закуски, нарезки",
    equipment: [
      { name: "Холодильник Liebherr 1", type: "fridge", tempMin: 2, tempMax: 6 },
      { name: "Холодильник Liebherr 2", type: "fridge", tempMin: 2, tempMax: 6 },
      { name: "Стол с охлаждаемой ванной", type: "fridge", tempMin: 2, tempMax: 6 },
    ],
  },
  {
    name: "Кондитерский цех",
    description: "Десерты, выпечка",
    equipment: [
      { name: "Расстоечный шкаф", type: "oven" },
      { name: "Тестомес", type: "mixer" },
      { name: "Морозильник вертикальный", type: "freezer", tempMin: -22, tempMax: -16 },
    ],
  },
  {
    name: "Склад продуктов",
    description: "Хранение сырья и заготовок",
    equipment: [
      { name: "Морозильная камера", type: "freezer", tempMin: -22, tempMax: -16 },
      { name: "Холодильная камера", type: "fridge", tempMin: 0, tempMax: 4 },
      { name: "Сухой склад · стеллажи", type: "storage" },
    ],
  },
  {
    name: "Мойка",
    description: "Посудомоечная зона",
    equipment: [
      { name: "Посудомоечная машина Winterhalter", type: "dishwasher" },
      { name: "Стол выдачи посуды", type: "table" },
    ],
  },
  {
    name: "Бар",
    description: "Барная стойка, напитки",
    equipment: [
      { name: "Кофемашина La Marzocco", type: "coffee" },
      { name: "Холодильник барный", type: "fridge", tempMin: 2, tempMax: 6 },
    ],
  },
  {
    name: "Зал",
    description: "Гостевой зал",
    equipment: [
      { name: "УФ-лампа бактерицидная", type: "uv" },
    ],
  },
];

async function main() {
  console.log("=== Ресторан seed: старт ===");

  // 0. Удалить старую org с тем же именем (cascade чистит всё)
  const existing = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
    select: { id: true },
  });
  if (existing) {
    console.log(`[0] Удаляю старую org ${existing.id}…`);
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  // Также чистим юзеров с конфликтующими телефонами — чтобы не сломаться
  // на @unique constraint phone (если такой constraint есть). Sweep по
  // всем нашим тест-телефонам.
  const allPhones = [ADMIN_PHONE, ...STAFF.map((s) => s.phone)];
  await prisma.user.deleteMany({
    where: { phone: { in: allPhones } },
  });

  // Также чистим старых юзеров со старыми email-ами (если перезапускаем)
  await prisma.user.deleteMany({ where: { email: ADMIN_EMAIL } });

  // 1. Organization + admin user в transaction
  console.log("[1] Создаю организацию + admin user…");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const org = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      type: "restaurant",
      phone: "+74950000000",
      address: "Москва, ул. Демонстрационная, 1",
      users: {
        create: {
          email: ADMIN_EMAIL,
          name: "Денис Управляющий",
          phone: ADMIN_PHONE,
          role: "manager",
          passwordHash,
          isActive: true,
          journalAccessMigrated: false,
        },
      },
    },
    include: { users: true },
  });
  const admin = org.users[0];
  console.log(`    org=${org.id}, admin=${admin.id} (${admin.email})`);

  // 2. Должности (16 шт) с upsert (на случай если базовый seed уже создал)
  console.log("[2] Создаю должности…");
  const positionByName = new Map<string, string>();
  let sortOrder = 0;
  for (const pos of POSITIONS) {
    const created = await prisma.jobPosition.upsert({
      where: {
        organizationId_categoryKey_name: {
          organizationId: org.id,
          categoryKey: pos.category,
          name: pos.name,
        },
      },
      create: {
        organizationId: org.id,
        categoryKey: pos.category,
        name: pos.name,
        sortOrder: sortOrder++,
      },
      update: {},
    });
    positionByName.set(pos.name, created.id);
  }
  // Прикрепляем admin к должности «Управляющий»
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      jobPositionId: positionByName.get("Управляющий"),
      positionTitle: "Управляющий",
    },
  });

  // 3. 19 сотрудников + admin = 20
  console.log("[3] Создаю 19 сотрудников…");
  const userByPhone = new Map<string, string>();
  userByPhone.set(ADMIN_PHONE, admin.id);
  for (const s of STAFF) {
    const positionId = positionByName.get(s.positionName);
    if (!positionId) {
      console.warn(`    skip ${s.fullName}: должность «${s.positionName}» не найдена`);
      continue;
    }
    const role = POSITIONS.find((p) => p.name === s.positionName)?.category === "management" ? "manager" : "cook";
    const u = await prisma.user.create({
      data: {
        organizationId: org.id,
        name: s.fullName,
        email: `staff-${crypto.randomBytes(4).toString("hex")}@${org.id}.local.haccp`,
        passwordHash: "",
        role,
        phone: s.phone,
        jobPositionId: positionId,
        positionTitle: s.positionName,
        isActive: true,
        journalAccessMigrated: false,
      },
    });
    userByPhone.set(s.phone, u.id);
  }
  console.log(`    итого ${userByPhone.size} пользователей`);

  // 4. Зоны и оборудование
  console.log("[4] Создаю зоны и оборудование…");
  for (const a of AREAS) {
    const area = await prisma.area.create({
      data: {
        organizationId: org.id,
        name: a.name,
        description: a.description,
      },
    });
    for (const eq of a.equipment) {
      await prisma.equipment.create({
        data: {
          areaId: area.id,
          name: eq.name,
          type: eq.type,
          tempMin: eq.tempMin ?? null,
          tempMax: eq.tempMax ?? null,
        },
      });
    }
  }

  // 5. Per-position visibility (preset для restaurant)
  console.log("[5] Применяю onboarding-preset (journal access по должностям)…");
  const preset = getOnboardingPreset("restaurant");
  const allCodes = Array.from(
    new Set(preset.positions.flatMap((p) => p.journalCodes))
  );
  const templates = await prisma.journalTemplate.findMany({
    where: { code: { in: allCodes } },
    select: { id: true, code: true },
  });
  const templateIdByCode = new Map(templates.map((t) => [t.code, t.id]));
  for (const pos of preset.positions) {
    const positionId = positionByName.get(pos.name);
    if (!positionId) continue;
    const ids = pos.journalCodes
      .map((c) => templateIdByCode.get(c))
      .filter((id): id is string => Boolean(id));
    await prisma.jobPositionJournalAccess.deleteMany({
      where: { jobPositionId: positionId, organizationId: org.id },
    });
    if (ids.length > 0) {
      await prisma.jobPositionJournalAccess.createMany({
        data: ids.map((templateId) => ({
          organizationId: org.id,
          jobPositionId: positionId,
          templateId,
        })),
        skipDuplicates: true,
      });
    }
  }

  // 6. Документы для всех активных шаблонов + расстановка ответственного
  console.log("[6] Создаю документы для всех 35 журналов + ставлю ответственных…");
  const allTemplates = await prisma.journalTemplate.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
  });

  // Логика ответственных по коду журнала.
  function pickResponsibleForCode(code: string): { userId: string | null; title: string | null } {
    const byPos = (posName: string) => {
      const pid = positionByName.get(posName);
      if (!pid) return null;
      // Берём первого юзера на этой должности
      return [...userByPhone.values()].find(
        (uid) => Boolean(uid)
      ) ?? null;
    };
    const findUserByPosition = (posName: string) => {
      const candidate = STAFF.find((s) => s.positionName === posName);
      if (!candidate) return null;
      return userByPhone.get(candidate.phone) ?? null;
    };
    void byPos;

    // hygiene/health_check — ответственный «Управляющий» (на бумаге)
    // production journals — Шеф-повар / Су-шеф / Технолог
    // cleaning — Уборщик / Менеджер зала
    // people — Управляющий
    // compliance — Управляющий
    // равно как и: equipment_maintenance / equipment_calibration → Технолог

    if (
      code === "hygiene" || code === "health_check" ||
      code === "med_books" || code === "training_plan" ||
      code === "staff_training" || code === "ppe_issuance" ||
      code === "complaint_register" || code === "audit_plan" ||
      code === "audit_protocol" || code === "audit_report" ||
      code === "accident_journal" || code === "sanitary_day_control"
    ) {
      return { userId: admin.id, title: "Управляющий" };
    }

    if (
      code === "finished_product" || code === "perishable_rejection" ||
      code === "incoming_control" || code === "incoming_raw_materials_control" ||
      code === "fryer_oil" || code === "intensive_cooling" ||
      code === "metal_impurity" || code === "traceability_test" ||
      code === "product_writeoff"
    ) {
      const uid = findUserByPosition("Шеф-повар");
      return { userId: uid, title: "Шеф-повар" };
    }

    if (
      code === "equipment_maintenance" || code === "equipment_calibration" ||
      code === "breakdown_history" || code === "equipment_cleaning" ||
      code === "glass_items_list" || code === "glass_control"
    ) {
      const uid = findUserByPosition("Технолог");
      return { userId: uid, title: "Технолог" };
    }

    if (
      code === "cleaning" || code === "general_cleaning" ||
      code === "cleaning_ventilation_checklist" || code === "uv_lamp_runtime" ||
      code === "disinfectant_usage" || code === "pest_control"
    ) {
      const uid = findUserByPosition("Уборщик");
      return { userId: uid, title: "Уборщик" };
    }

    if (code === "climate_control" || code === "cold_equipment_control") {
      const uid = findUserByPosition("Шеф-повар");
      return { userId: uid, title: "Шеф-повар" };
    }

    return { userId: admin.id, title: "Управляющий" };
  }

  const now = new Date();
  let docsCreated = 0;
  for (const tpl of allTemplates) {
    const period = resolveJournalPeriod(tpl.code, now);
    const responsible = pickResponsibleForCode(tpl.code);
    await prisma.journalDocument.create({
      data: {
        organizationId: org.id,
        templateId: tpl.id,
        title: `${tpl.name} · ${period.label}`,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        status: "active",
        config: {},
        responsibleUserId: responsible.userId,
        responsibleTitle: responsible.title,
      },
    });
    docsCreated++;
  }
  console.log(`    создано ${docsCreated} документов`);

  // 7. Иерархия видимости (per-position visibleUserIds)
  // Управляющий видит всех, шеф-повар видит кухню (поваров+стажёра), менеджер зала
  // видит официантов+бармена+хостес, прочие — никого специально (default = свои).
  console.log("[7] Расставляю иерархию видимости (visibleUserIds)…");
  function userIdsByPositions(...names: string[]): string[] {
    const ids: string[] = [];
    for (const name of names) {
      for (const s of STAFF) {
        if (s.positionName === name) {
          const uid = userByPhone.get(s.phone);
          if (uid) ids.push(uid);
        }
      }
    }
    return ids;
  }
  const allActiveUserIds = [...userByPhone.values()];

  await prisma.jobPosition.update({
    where: { id: positionByName.get("Управляющий")! },
    data: { visibleUserIds: allActiveUserIds },
  });
  await prisma.jobPosition.update({
    where: { id: positionByName.get("Шеф-повар")! },
    data: {
      visibleUserIds: userIdsByPositions(
        "Шеф-повар",
        "Су-шеф",
        "Повар горячего цеха",
        "Повар холодного цеха",
        "Повар-кондитер",
        "Стажёр",
        "Технолог"
      ),
    },
  });
  await prisma.jobPosition.update({
    where: { id: positionByName.get("Су-шеф")! },
    data: {
      visibleUserIds: userIdsByPositions(
        "Повар горячего цеха",
        "Повар холодного цеха",
        "Повар-кондитер",
        "Стажёр"
      ),
    },
  });
  await prisma.jobPosition.update({
    where: { id: positionByName.get("Менеджер зала")! },
    data: {
      visibleUserIds: userIdsByPositions(
        "Хостес",
        "Официант",
        "Бармен"
      ),
    },
  });
  await prisma.jobPosition.update({
    where: { id: positionByName.get("Кладовщик")! },
    data: {
      visibleUserIds: userIdsByPositions("Грузчик"),
    },
  });

  // 8. TasksFlow integration
  console.log("[8] Подключаю TasksFlow integration…");
  await prisma.tasksFlowIntegration.upsert({
    where: { organizationId: org.id },
    create: {
      organizationId: org.id,
      baseUrl: TASKSFLOW_BASE_URL,
      apiKeyEncrypted: encryptSecret(TASKSFLOW_API_KEY),
      apiKeyPrefix: TASKSFLOW_API_KEY.slice(0, 12),
      webhookSecret: generateWebhookSecret(),
      enabled: true,
      label: "Restaurant seed",
    },
    update: {
      apiKeyEncrypted: encryptSecret(TASKSFLOW_API_KEY),
      apiKeyPrefix: TASKSFLOW_API_KEY.slice(0, 12),
      enabled: true,
    },
  });
  console.log("    TasksFlow подключён (sync сотрудников через UI «Синхронизировать»)");

  console.log("=== ГОТОВО ===");
  console.log("");
  console.log(`Логин:   ${ADMIN_EMAIL}`);
  console.log(`Пароль:  ${ADMIN_PASSWORD}`);
  console.log(`URL:     https://wesetup.ru/login`);
  console.log("");
  console.log(`Организация: ${ORG_NAME}`);
  console.log(`Сотрудников: ${userByPhone.size}`);
  console.log(`Должностей:  ${positionByName.size}`);
  console.log(`Зон:         ${AREAS.length}`);
  console.log(`Документов:  ${docsCreated}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
