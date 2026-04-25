/**
 * Удалить ВСЕ JournalDocument'ы организации «Кафе «Тестовое 1»».
 * Используется один раз чтобы пересоздать документы с правильными
 * периодами через bulk-create после фикса journal-period.ts.
 *
 * Запуск на проде:
 *   npx tsx scripts/delete-test-org-docs.ts
 *
 * Идемпотентно: если орга не найдена или уже без документов — OK.
 */
import { db } from "../src/lib/db";

const TARGET_NAME_VARIANTS = [
  'Кафе «Тестовое 1»',
  'Кафе "Тестовое 1"',
  "Кафе «Тестовое 1»",
];

async function main() {
  const org = await db.organization.findFirst({
    where: { name: { in: TARGET_NAME_VARIANTS } },
    select: { id: true, name: true },
  });
  if (!org) {
    console.log(
      `[delete] organization not found by names: ${TARGET_NAME_VARIANTS.join(", ")}`
    );
    process.exit(0);
  }
  console.log(`[delete] target org: ${org.id} «${org.name}»`);

  const docs = await db.journalDocument.findMany({
    where: { organizationId: org.id },
    select: { id: true, title: true, dateFrom: true, dateTo: true },
  });
  console.log(`[delete] found ${docs.length} document(s) to remove`);
  if (docs.length === 0) {
    process.exit(0);
  }
  for (const d of docs) {
    console.log(
      `  - ${d.id}  ${d.title}  ${d.dateFrom.toISOString().slice(0, 10)} → ${d.dateTo.toISOString().slice(0, 10)}`
    );
  }

  // JournalDocument имеет cascade на entries и attachments в схеме —
  // удаление корня снесёт всё подвешенное.
  const result = await db.journalDocument.deleteMany({
    where: { organizationId: org.id },
  });
  console.log(`[delete] deleted ${result.count} document(s) — done`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[delete] failed:", err);
  process.exit(1);
});
