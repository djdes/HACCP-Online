/**
 * Seed производственного календаря РФ из статического data-файла
 * src/lib/production-calendar-data.ts. Идемпотентный upsert по date.
 *
 * Запускается автоматически в deploy.yml + можно руками:
 *   npx tsx prisma/seed-production-calendar.ts
 *
 * Когда выходит постановление на новый год — обновляется
 * production-calendar-data.ts, deploy подхватывает upsert.
 */
import { db } from "../src/lib/db";
import { ALL_RU_CALENDAR_ENTRIES } from "../src/lib/production-calendar-data";

async function main() {
  console.log(
    `[seed-production-calendar] Upserting ${ALL_RU_CALENDAR_ENTRIES.length} entries...`,
  );
  let upserted = 0;
  for (const entry of ALL_RU_CALENDAR_ENTRIES) {
    const year = Number(entry.date.slice(0, 4));
    await db.productionCalendarDay.upsert({
      where: { date: entry.date },
      create: {
        date: entry.date,
        year,
        kind: entry.kind,
        name: entry.name ?? null,
        source: "seed",
      },
      update: {
        kind: entry.kind,
        name: entry.name ?? null,
        // НЕ перезаписываем source если запись была manually отредактирована.
      },
    });
    upserted += 1;
  }
  console.log(`[seed-production-calendar] OK — ${upserted} entries.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[seed-production-calendar] FAILED", err);
    process.exit(1);
  });
