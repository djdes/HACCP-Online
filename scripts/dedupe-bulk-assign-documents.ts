import { db } from "@/lib/db";

/**
 * Одноразовая чистка дубликатов JournalDocument'ов созданных
 * `/api/integrations/tasksflow/bulk-assign-today` до фикса 2026-04-30.
 *
 * Баг: route создавал новый документ если не находил активный с
 * `dateTo >= now` (не учитывая что dateTo=00:00 UTC последнего дня
 * периода, а now=15:00 UTC текущего дня → не находил уже созданный
 * сегодня документ → плодил дубликаты при каждом клике «Разослать
 * всем». У некоторых организаций накопилось 15-30 копий одного журнала.
 *
 * Стратегия:
 *   • Для каждой пары (organizationId, templateId, dateFrom-day) находим
 *     все active документы с одинаковыми границами периода.
 *   • Берём «канонический» — тот у которого больше всего реальных
 *     записей (НЕ _autoSeeded).
 *   • Остальные мягко переводим в status="closed". Не удаляем — на
 *     случай если в них всё-таки есть данные, менеджер сможет их
 *     открыть из архива.
 *
 * Запуск:
 *   npx tsx scripts/dedupe-bulk-assign-documents.ts            # dry-run
 *   npx tsx scripts/dedupe-bulk-assign-documents.ts --apply    # реально
 */

const DRY_RUN = !process.argv.includes("--apply");

async function main() {
  console.log(
    DRY_RUN
      ? ">>> DRY RUN — никаких изменений в БД, добавь --apply для реального прогона"
      : ">>> APPLY — закрываем дубликаты"
  );

  // Все active документы. Группируем in-memory: ожидаем ≤ нескольких
  // тысяч даже на крупной org × всех клиентах.
  const docs = await db.journalDocument.findMany({
    where: { status: "active" },
    select: {
      id: true,
      organizationId: true,
      templateId: true,
      dateFrom: true,
      dateTo: true,
      title: true,
      _count: { select: { entries: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  type Group = {
    key: string;
    docs: typeof docs;
  };
  const groups = new Map<string, Group>();
  for (const d of docs) {
    const key = `${d.organizationId}|${d.templateId}|${d.dateFrom.toISOString()}|${d.dateTo.toISOString()}`;
    let g = groups.get(key);
    if (!g) {
      g = { key, docs: [] };
      groups.set(key, g);
    }
    g.docs.push(d);
  }

  let totalGroups = 0;
  let totalDupes = 0;
  let closed = 0;

  for (const g of groups.values()) {
    if (g.docs.length <= 1) continue;
    totalGroups += 1;
    totalDupes += g.docs.length - 1;

    // Канонический — с максимальным entry count, а при равенстве —
    // самый старый createdAt (он стоит в очереди раньше).
    const sorted = [...g.docs].sort((a, b) => {
      const cmp = b._count.entries - a._count.entries;
      return cmp !== 0 ? cmp : 0;
    });
    const canonical = sorted[0];
    const dupes = sorted.slice(1);

    console.log(
      `[group] org=${canonical.organizationId.slice(0, 8)} tpl=${canonical.templateId.slice(0, 8)} period=${canonical.dateFrom.toISOString().slice(0, 10)}..${canonical.dateTo.toISOString().slice(0, 10)} canonical=${canonical.id.slice(0, 8)} (${canonical._count.entries} entries), closing ${dupes.length} dupes`
    );

    if (!DRY_RUN) {
      for (const dup of dupes) {
        await db.journalDocument.update({
          where: { id: dup.id },
          data: { status: "closed" },
        });
        closed += 1;
      }
    }
  }

  console.log("---");
  console.log(`groups with duplicates: ${totalGroups}`);
  console.log(`duplicate documents:    ${totalDupes}`);
  if (!DRY_RUN) {
    console.log(`closed:                 ${closed}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
