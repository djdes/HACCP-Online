/**
 * Проставляет полную сетку JobPositionJournalAccess для 5 должностей
 * в новой Тест-копии Гавани:
 *  - Админ: все активные templates
 *  - Заведующий: management bundle (HYGIENE + PEOPLE + COMPLIANCE + жалобы)
 *  - Повар: hygiene per employee + полная кухня
 *  - Продавец: hygiene + продажи/приёмка/готовая продукция/жалобы
 *  - Уборщик: hygiene + клининг + санитария
 *
 * Перед применением обнуляет уже существующие связки для этих
 * позиций — иначе оставшиеся от прошлого скрипта (Заведующий/Уборщик
 * было 12+9) смешиваются с новым набором.
 */
import { db } from "@/lib/db";

const ORG_ID = "cmoidbvtx00004jtsqzzjer7k";

const HYGIENE = ["hygiene", "health_check"];
const CLEANING = [
  "cleaning",
  "general_cleaning",
  "cleaning_ventilation_checklist",
  "uv_lamp_runtime",
  "disinfectant_usage",
  "sanitary_day_control",
  "pest_control",
];
const PEOPLE = ["med_books", "training_plan", "staff_training", "ppe_issuance"];
const COMPLIANCE = [
  "audit_plan",
  "audit_protocol",
  "audit_report",
  "accident_journal",
  "complaint_register",
];
const KITCHEN_FULL = [
  "finished_product",
  "perishable_rejection",
  "intensive_cooling",
  "fryer_oil",
  "cold_equipment_control",
  "climate_control",
];
const SALES = [
  "finished_product",
  "incoming_control",
  "incoming_raw_materials_control",
  "perishable_rejection",
  "complaint_register",
];

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

async function main() {
  const templates = await db.journalTemplate.findMany({
    where: { isActive: true },
    select: { id: true, code: true },
  });
  const codeToId = new Map(templates.map((t) => [t.code, t.id]));
  const allCodes = templates.map((t) => t.code);

  const positions = await db.jobPosition.findMany({
    where: { organizationId: ORG_ID },
  });
  const byName = new Map(positions.map((p) => [p.name, p]));

  // Маппинг должность → коды.
  const plan: Record<string, string[]> = {
    "Админ": uniq(allCodes),
    "Заведующий": uniq([
      ...HYGIENE,
      ...PEOPLE,
      ...COMPLIANCE,
      ...CLEANING,
      ...KITCHEN_FULL,
      ...SALES,
    ]),
    "Повар": uniq([...HYGIENE, ...KITCHEN_FULL, "equipment_cleaning"]),
    "Продавец": uniq([...HYGIENE, ...SALES]),
    "Уборщик": uniq([...HYGIENE, ...CLEANING, "uv_lamp_runtime"]),
  };

  for (const [posName, codes] of Object.entries(plan)) {
    const pos = byName.get(posName);
    if (!pos) {
      console.log(`[skip] нет должности «${posName}» в org`);
      continue;
    }

    // Wipe старые access-записи для этой должности.
    const wiped = await db.jobPositionJournalAccess.deleteMany({
      where: { jobPositionId: pos.id },
    });

    // Преобразуем codes → templateIds, отбрасывая отсутствующие.
    const templateIds = codes
      .map((c) => codeToId.get(c))
      .filter((x): x is string => typeof x === "string");

    if (templateIds.length === 0) {
      console.log(`[${posName}] wiped=${wiped.count}, ничего не назначено`);
      continue;
    }

    await db.jobPositionJournalAccess.createMany({
      data: templateIds.map((templateId) => ({
        organizationId: ORG_ID,
        jobPositionId: pos.id,
        templateId,
      })),
      skipDuplicates: true,
    });
    console.log(
      `[${posName}] wiped=${wiped.count}, назначено templates=${templateIds.length}`
    );
  }

  console.log("\nDone. Пересмотри в /settings/journals-by-position если нужно подкрутить.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
