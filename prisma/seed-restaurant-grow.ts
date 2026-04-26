/**
 * Дополнительные сотрудники + обновление иерархии для ресторана
 * «Вкусная Гавань». Идемпотентно: повторный запуск пропускает
 * уже существующих по телефону.
 *
 * Запуск: ./node_modules/.bin/tsx prisma/seed-restaurant-grow.ts
 */

import fs from "node:fs";
import path from "node:path";
try {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  }
} catch {/**/}

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import crypto from "node:crypto";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ORG_NAME = "Ресторан «Вкусная Гавань»";

interface PositionSpec {
  category: "management" | "staff";
  name: string;
}
// Новые должности, которых ещё нет
const NEW_POSITIONS: PositionSpec[] = [
  { category: "management", name: "Администратор смены" },
  { category: "management", name: "Метрдотель" },
  { category: "staff", name: "Бариста" },
  { category: "staff", name: "Мангальщик" },
  { category: "staff", name: "Пекарь" },
  { category: "staff", name: "Сомелье" },
  { category: "staff", name: "Курьер" },
  { category: "staff", name: "Чистильщик овощей" },
];

interface StaffSpec {
  positionName: string;
  fullName: string;
  phone: string;
}

// 30 новых сотрудников. Ник-нейминг разнообразный, +7991100003X для уникальности.
const NEW_STAFF: StaffSpec[] = [
  // Кухня (доп.)
  { positionName: "Повар горячего цеха", fullName: "Александр Жариков", phone: "+79911000030" },
  { positionName: "Повар горячего цеха", fullName: "Никита Сковородов", phone: "+79911000031" },
  { positionName: "Повар горячего цеха", fullName: "Роман Углов", phone: "+79911000032" },
  { positionName: "Повар горячего цеха", fullName: "Антон Соусов", phone: "+79911000033" },
  { positionName: "Повар холодного цеха", fullName: "Полина Зеленина", phone: "+79911000034" },
  { positionName: "Повар холодного цеха", fullName: "Светлана Морковина", phone: "+79911000035" },
  { positionName: "Повар холодного цеха", fullName: "Юлия Травкина", phone: "+79911000036" },
  { positionName: "Повар-кондитер", fullName: "Олег Сладкий", phone: "+79911000037" },
  { positionName: "Пекарь", fullName: "Дина Тестова", phone: "+79911000038" },
  { positionName: "Мангальщик", fullName: "Ашот Шашлычный", phone: "+79911000039" },
  { positionName: "Чистильщик овощей", fullName: "Зоя Картошкина", phone: "+79911000040" },
  { positionName: "Стажёр", fullName: "Тимур Учеников", phone: "+79911000041" },

  // Зал и бар (доп.)
  { positionName: "Метрдотель", fullName: "Виктор Залов", phone: "+79911000042" },
  { positionName: "Менеджер зала", fullName: "Светлана Гостева", phone: "+79911000043" },
  { positionName: "Администратор смены", fullName: "Павел Сменов", phone: "+79911000044" },
  { positionName: "Официант", fullName: "Анастасия Подносова", phone: "+79911000045" },
  { positionName: "Официант", fullName: "Денис Сервисов", phone: "+79911000046" },
  { positionName: "Официант", fullName: "Юлия Гостеприимная", phone: "+79911000047" },
  { positionName: "Официант", fullName: "Илья Вежливов", phone: "+79911000048" },
  { positionName: "Хостес", fullName: "Алёна Встречалкина", phone: "+79911000049" },
  { positionName: "Хостес", fullName: "Ева Приёмова", phone: "+79911000050" },
  { positionName: "Бармен", fullName: "Артур Коктейлев", phone: "+79911000051" },
  { positionName: "Бармен", fullName: "Татьяна Шейкер", phone: "+79911000052" },
  { positionName: "Бариста", fullName: "Лиза Эспрессова", phone: "+79911000053" },
  { positionName: "Бариста", fullName: "Михаил Капучинов", phone: "+79911000054" },
  { positionName: "Сомелье", fullName: "Андрей Винов", phone: "+79911000055" },

  // Склад / логистика
  { positionName: "Кладовщик", fullName: "Григорий Полочкин", phone: "+79911000056" },
  { positionName: "Грузчик", fullName: "Степан Тележкин", phone: "+79911000057" },
  { positionName: "Курьер", fullName: "Антон Доставкин", phone: "+79911000058" },

  // Уборка
  { positionName: "Посудомойщик", fullName: "Галина Тарелкина", phone: "+79911000059" },
  { positionName: "Уборщик", fullName: "Светлана Тряпкина", phone: "+79911000060" },
];

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
    select: { id: true },
  });
  if (!org) throw new Error("Org не найдена. Запустите seed-restaurant.ts");

  // 1. upsert новых должностей
  console.log("[1] Добавляю новые должности…");
  // Берём текущий max sortOrder, чтобы новые шли в конец категории
  const lastSort = await prisma.jobPosition.findFirst({
    where: { organizationId: org.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  let sortOrder = (lastSort?.sortOrder ?? 0) + 1;
  for (const pos of NEW_POSITIONS) {
    await prisma.jobPosition.upsert({
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
  }

  // 2. создаём недостающих сотрудников
  console.log("[2] Создаю новых сотрудников…");
  const positions = await prisma.jobPosition.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true, categoryKey: true },
  });
  const positionByName = new Map(positions.map((p) => [p.name, p]));
  let created = 0;
  let skipped = 0;
  for (const s of NEW_STAFF) {
    const pos = positionByName.get(s.positionName);
    if (!pos) {
      console.warn(`    skip ${s.fullName}: должность ${s.positionName} не найдена`);
      continue;
    }
    const existing = await prisma.user.findFirst({
      where: { organizationId: org.id, phone: s.phone },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.user.create({
      data: {
        organizationId: org.id,
        name: s.fullName,
        email: `staff-${crypto.randomBytes(4).toString("hex")}@${org.id}.local.haccp`,
        passwordHash: "",
        role: pos.categoryKey === "management" ? "manager" : "cook",
        phone: s.phone,
        jobPositionId: pos.id,
        positionTitle: pos.name,
        isActive: true,
        journalAccessMigrated: false,
      },
    });
    created++;
  }
  console.log(`    создано ${created}, пропущено (дубли) ${skipped}`);

  // 3. Иерархия видимости (visibleUserIds + ManagerScope) — пересчитываем
  console.log("[3] Пересчитываю visibleUserIds + ManagerScope…");
  const allUsers = await prisma.user.findMany({
    where: { organizationId: org.id, isActive: true, archivedAt: null },
    select: { id: true, jobPositionId: true, jobPosition: { select: { name: true } } },
  });
  const idsByPos = new Map<string, string[]>();
  const allUserIds: string[] = [];
  for (const u of allUsers) {
    allUserIds.push(u.id);
    const posName = u.jobPosition?.name;
    if (!posName) continue;
    const list = idsByPos.get(posName) ?? [];
    list.push(u.id);
    idsByPos.set(posName, list);
  }
  function ids(...names: string[]): string[] {
    const out: string[] = [];
    for (const n of names) {
      const list = idsByPos.get(n);
      if (list) out.push(...list);
    }
    return out;
  }

  const VISIBILITY: Record<string, string[]> = {
    "Управляющий": allUserIds,
    "Шеф-повар": ids(
      "Шеф-повар",
      "Су-шеф",
      "Повар горячего цеха",
      "Повар холодного цеха",
      "Повар-кондитер",
      "Пекарь",
      "Мангальщик",
      "Чистильщик овощей",
      "Стажёр",
      "Технолог",
    ),
    "Су-шеф": ids(
      "Повар горячего цеха",
      "Повар холодного цеха",
      "Повар-кондитер",
      "Пекарь",
      "Мангальщик",
      "Стажёр",
      "Чистильщик овощей",
    ),
    "Технолог": ids(
      "Повар горячего цеха",
      "Повар холодного цеха",
      "Повар-кондитер",
      "Пекарь",
    ),
    "Менеджер зала": ids("Хостес", "Официант", "Бармен", "Бариста", "Сомелье"),
    "Метрдотель": ids("Хостес", "Официант", "Бармен", "Бариста"),
    "Администратор смены": ids(
      "Хостес",
      "Официант",
      "Бармен",
      "Бариста",
      "Посудомойщик",
      "Уборщик",
    ),
    "Кладовщик": ids("Грузчик", "Курьер"),
  };
  const positionsRecord = await prisma.jobPosition.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  for (const p of positionsRecord) {
    const visibleIds = VISIBILITY[p.name];
    if (!visibleIds) continue;
    await prisma.jobPosition.update({
      where: { id: p.id },
      data: { visibleUserIds: visibleIds },
    });
  }

  // 4. ManagerScope per-user — берём первого (или того кого был раньше) на роли
  const MANAGER_RULES: Record<
    string,
    { sees: string[]; canAssign: string[] }
  > = {
    "Управляющий": { sees: [], canAssign: [] },
    "Шеф-повар": {
      sees: [
        "Су-шеф", "Повар горячего цеха", "Повар холодного цеха",
        "Повар-кондитер", "Пекарь", "Мангальщик", "Чистильщик овощей",
        "Стажёр", "Технолог",
      ],
      canAssign: [
        "finished_product","perishable_rejection","incoming_control",
        "incoming_raw_materials_control","fryer_oil","intensive_cooling",
        "metal_impurity","traceability_test","product_writeoff",
        "climate_control","cold_equipment_control","hygiene","health_check",
      ],
    },
    "Су-шеф": {
      sees: ["Повар горячего цеха","Повар холодного цеха","Повар-кондитер","Пекарь","Мангальщик","Стажёр","Чистильщик овощей"],
      canAssign: ["finished_product","perishable_rejection","fryer_oil","intensive_cooling","cold_equipment_control","climate_control","hygiene","health_check"],
    },
    "Технолог": {
      sees: ["Повар горячего цеха","Повар холодного цеха","Повар-кондитер","Пекарь"],
      canAssign: ["equipment_maintenance","equipment_calibration","breakdown_history","equipment_cleaning","glass_items_list","metal_impurity","traceability_test"],
    },
    "Менеджер зала": {
      sees: ["Хостес","Официант","Бармен","Бариста","Сомелье"],
      canAssign: ["hygiene","health_check","complaint_register","cleaning","general_cleaning"],
    },
    "Метрдотель": {
      sees: ["Хостес","Официант","Бармен","Бариста"],
      canAssign: ["hygiene","health_check","complaint_register"],
    },
    "Администратор смены": {
      sees: ["Хостес","Официант","Бармен","Бариста","Посудомойщик","Уборщик"],
      canAssign: ["hygiene","health_check","cleaning","cleaning_ventilation_checklist","complaint_register"],
    },
    "Кладовщик": {
      sees: ["Грузчик","Курьер"],
      canAssign: ["incoming_control","incoming_raw_materials_control"],
    },
  };
  console.log("[4] Обновляю ManagerScope…");
  const managers = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      archivedAt: null,
      jobPosition: { is: { name: { in: Object.keys(MANAGER_RULES) } } },
    },
    include: { jobPosition: { select: { name: true } } },
  });
  const positionIdByName = new Map(
    positionsRecord.map((p) => [p.name, p.id]),
  );
  let scopesUpserted = 0;
  for (const m of managers) {
    const posName = m.jobPosition?.name;
    if (!posName) continue;
    const rule = MANAGER_RULES[posName];
    if (!rule) continue;
    const viewMode = rule.sees.length === 0 ? "all" : "job_positions";
    const viewJobPositionIds = rule.sees
      .map((n) => positionIdByName.get(n))
      .filter((id): id is string => Boolean(id));
    await prisma.managerScope.upsert({
      where: {
        organizationId_managerId: {
          organizationId: org.id,
          managerId: m.id,
        },
      },
      create: {
        organizationId: org.id,
        managerId: m.id,
        viewMode,
        viewJobPositionIds: viewMode === "job_positions" ? viewJobPositionIds : [],
        viewUserIds: [],
        assignableJournalCodes: rule.canAssign,
      },
      update: {
        viewMode,
        viewJobPositionIds: viewMode === "job_positions" ? viewJobPositionIds : [],
        viewUserIds: [],
        assignableJournalCodes: rule.canAssign,
      },
    });
    scopesUpserted++;
  }

  // 5. Per-position journal access (preset) — для новых должностей нужно
  // явно дать им доступы к hygiene/health_check (per-employee).
  console.log("[5] JobPositionJournalAccess для новых должностей…");
  // Полный per-position access для ресторана. Перезаписывает предыдущие
  // строки для перечисленных должностей. Базовые preset-имена «Повар» в
  // нашем ресторане расщеплены на «Повар горячего/холодного цеха» —
  // им нужен явный access ниже.
  const NEW_POSITION_ACCESS: Record<string, string[]> = {
    // Кухня — доступ к температурам и production-журналам
    "Шеф-повар": [
      "hygiene", "health_check",
      "finished_product", "perishable_rejection", "incoming_control",
      "incoming_raw_materials_control", "fryer_oil", "intensive_cooling",
      "metal_impurity", "traceability_test", "product_writeoff",
      "climate_control", "cold_equipment_control",
    ],
    "Су-шеф": [
      "hygiene", "health_check",
      "finished_product", "perishable_rejection", "intensive_cooling",
      "fryer_oil", "climate_control", "cold_equipment_control",
    ],
    "Повар горячего цеха": [
      "hygiene", "health_check",
      "finished_product", "perishable_rejection",
      "intensive_cooling", "fryer_oil",
      "climate_control", "cold_equipment_control",
    ],
    "Повар холодного цеха": [
      "hygiene", "health_check",
      "finished_product", "perishable_rejection",
      "climate_control", "cold_equipment_control",
    ],
    "Повар-кондитер": [
      "hygiene", "health_check",
      "finished_product", "perishable_rejection",
      "cold_equipment_control",
    ],
    "Пекарь": [
      "hygiene", "health_check",
      "finished_product", "perishable_rejection",
      "fryer_oil", "cold_equipment_control",
    ],
    "Мангальщик": [
      "hygiene", "health_check",
      "finished_product", "fryer_oil",
    ],
    "Чистильщик овощей": [
      "hygiene", "health_check", "incoming_control",
    ],
    "Стажёр": ["hygiene", "health_check"],
    "Технолог": [
      "hygiene", "health_check",
      "equipment_maintenance", "equipment_calibration",
      "breakdown_history", "equipment_cleaning",
      "glass_items_list", "glass_control",
    ],
    // Зал и бар
    "Менеджер зала": ["hygiene", "health_check", "complaint_register"],
    "Метрдотель": ["hygiene", "health_check", "complaint_register"],
    "Администратор смены": ["hygiene", "health_check", "complaint_register"],
    "Хостес": ["hygiene", "health_check", "complaint_register"],
    "Официант": ["hygiene", "health_check", "complaint_register"],
    "Бармен": ["hygiene", "health_check"],
    "Бариста": ["hygiene", "health_check"],
    "Сомелье": ["hygiene", "health_check"],
    // Склад / уборка
    "Кладовщик": [
      "hygiene", "health_check",
      "incoming_control", "incoming_raw_materials_control",
    ],
    "Грузчик": ["hygiene", "health_check"],
    "Курьер": ["hygiene", "health_check"],
    "Уборщик": [
      "hygiene", "health_check",
      "cleaning", "general_cleaning", "cleaning_ventilation_checklist",
      "uv_lamp_runtime", "disinfectant_usage", "sanitary_day_control",
      "pest_control",
    ],
    "Посудомойщик": [
      "hygiene", "health_check",
      "cleaning", "equipment_cleaning",
    ],
    // Управляющий — широкий набор compliance + hr
    "Управляющий": [
      "hygiene", "health_check",
      "med_books", "training_plan", "staff_training", "ppe_issuance",
      "complaint_register", "audit_plan", "audit_protocol", "audit_report",
      "accident_journal", "sanitary_day_control",
    ],
  };
  const codes = Array.from(new Set(Object.values(NEW_POSITION_ACCESS).flat()));
  const templates = await prisma.journalTemplate.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const templateIdByCode = new Map(templates.map((t) => [t.code, t.id]));
  let accessRows = 0;
  for (const [posName, journalCodes] of Object.entries(NEW_POSITION_ACCESS)) {
    const pid = positionIdByName.get(posName);
    if (!pid) continue;
    const ids = journalCodes
      .map((c) => templateIdByCode.get(c))
      .filter((id): id is string => Boolean(id));
    await prisma.jobPositionJournalAccess.deleteMany({
      where: { jobPositionId: pid, organizationId: org.id },
    });
    if (ids.length > 0) {
      await prisma.jobPositionJournalAccess.createMany({
        data: ids.map((templateId) => ({
          organizationId: org.id,
          jobPositionId: pid,
          templateId,
        })),
        skipDuplicates: true,
      });
      accessRows += ids.length;
    }
  }

  console.log(`\n=== ГОТОВО ===`);
  console.log(`Создано новых сотрудников: ${created}`);
  console.log(`Пропущено (уже были): ${skipped}`);
  console.log(`Должностей всего: ${positionsRecord.length}`);
  console.log(`ManagerScope upserted: ${scopesUpserted}`);
  console.log(`Journal-access rows для новых позиций: ${accessRows}`);
  console.log(`\nДальше: запустить sync-users + sync-hierarchy через UI или curl.`);
}

main().catch((err) => { console.error(err); process.exit(1); }).finally(() => prisma.$disconnect());
