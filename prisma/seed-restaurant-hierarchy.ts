/**
 * Сид-скрипт: ManagerScope per-user для уже созданного ресторана.
 *
 * Запуск: npx tsx prisma/seed-restaurant-hierarchy.ts
 *
 * Что делает: для каждого management-юзера ставит:
 *   - viewMode = "job_positions" + viewJobPositionIds = [подчинённые]
 *   - assignableJournalCodes = что разрешено назначать
 *
 * Карта иерархии для ресторана:
 *   Управляющий ─── видит всех ───────────── назначает любые журналы
 *      ├── Шеф-повар ── кухня ── production journals
 *      │      └── Су-шеф ── линейные повара ── daily production
 *      ├── Менеджер зала ── зал/бар ── hygiene/health/complaints
 *      ├── Кладовщик ── грузчик ── incoming_control / incoming_raw
 *      └── Технолог ── оборудование ── equipment journals
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const ORG_NAME = "Ресторан «Вкусная Гавань»";

// Position-name → assignable journal codes для менеджера на этой роли.
const MANAGER_RULES: Record<
  string,
  {
    /** Видимые position-имена (subordinate roles). [] = видит всех ("all") */
    sees: string[];
    /** Какие journal codes можно назначать. [] = все. */
    canAssign: string[];
  }
> = {
  "Управляющий": {
    sees: [], // = "all"
    canAssign: [], // = все
  },
  "Шеф-повар": {
    sees: [
      "Су-шеф",
      "Повар горячего цеха",
      "Повар холодного цеха",
      "Повар-кондитер",
      "Стажёр",
      "Технолог",
    ],
    canAssign: [
      "finished_product",
      "perishable_rejection",
      "incoming_control",
      "incoming_raw_materials_control",
      "fryer_oil",
      "intensive_cooling",
      "metal_impurity",
      "traceability_test",
      "product_writeoff",
      "climate_control",
      "cold_equipment_control",
      "hygiene",
      "health_check",
    ],
  },
  "Су-шеф": {
    sees: ["Повар горячего цеха", "Повар холодного цеха", "Повар-кондитер", "Стажёр"],
    canAssign: [
      "finished_product",
      "perishable_rejection",
      "fryer_oil",
      "intensive_cooling",
      "cold_equipment_control",
      "climate_control",
      "hygiene",
      "health_check",
    ],
  },
  "Технолог": {
    sees: ["Повар горячего цеха", "Повар холодного цеха", "Повар-кондитер"],
    canAssign: [
      "equipment_maintenance",
      "equipment_calibration",
      "breakdown_history",
      "equipment_cleaning",
      "glass_items_list",
      "glass_control",
      "metal_impurity",
      "traceability_test",
    ],
  },
  "Менеджер зала": {
    sees: ["Хостес", "Официант", "Бармен"],
    canAssign: [
      "hygiene",
      "health_check",
      "complaint_register",
      "cleaning",
      "general_cleaning",
    ],
  },
  "Кладовщик": {
    sees: ["Грузчик"],
    canAssign: ["incoming_control", "incoming_raw_materials_control"],
  },
};

async function main() {
  const org = await prisma.organization.findFirst({
    where: { name: ORG_NAME },
    select: { id: true },
  });
  if (!org) throw new Error(`Org "${ORG_NAME}" не найдена. Запустите сначала seed-restaurant.ts`);

  const positions = await prisma.jobPosition.findMany({
    where: { organizationId: org.id },
    select: { id: true, name: true },
  });
  const positionIdByName = new Map(positions.map((p) => [p.name, p.id]));

  // Все management-юзеры с position
  const managers = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      isActive: true,
      archivedAt: null,
      jobPosition: {
        is: { name: { in: Object.keys(MANAGER_RULES) } },
      },
    },
    include: { jobPosition: { select: { name: true } } },
  });

  console.log(`Нашёл ${managers.length} management-юзеров`);

  let upserted = 0;
  for (const m of managers) {
    const positionName = m.jobPosition?.name;
    if (!positionName) continue;
    const rule = MANAGER_RULES[positionName];
    if (!rule) continue;

    const viewJobPositionIds = rule.sees
      .map((n) => positionIdByName.get(n))
      .filter((id): id is string => Boolean(id));

    const viewMode = rule.sees.length === 0 ? "all" : "job_positions";

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
    upserted++;
    console.log(
      `  ✓ ${m.name} (${positionName}): viewMode=${viewMode}, видит ${viewJobPositionIds.length} должностей, назначает ${rule.canAssign.length || "все"} журналов`
    );
  }

  console.log(`\nГотово. Создано/обновлено ${upserted} ManagerScope записей.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
