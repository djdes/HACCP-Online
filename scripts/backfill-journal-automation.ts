/**
 * Backfill: включить «автосоздание + ежедневное автозаполнение» тем
 * организациям, которые завелись ДО появления
 * `Organization.journalAutomationJson`.
 *
 * Правило: для каждого кода из AUTOMATION_DEFAULT_ON_CODES ставим
 * `{ autoCreate: true, autoFill: true }`, если
 *   - ключа для этого кода в journalAutomationJson ЕЩЁ НЕТ (осознанный
 *     выбор организации не перетираем), и
 *   - журнал не отключён в `disabledJournalCodes` (набор журналов
 *     считается от сферы — см. sphere-journal-rules).
 *
 * По умолчанию — dry-run: только печатает план. Запись — с `--apply`.
 *
 * Usage:
 *   npx tsx scripts/backfill-journal-automation.ts
 *   npx tsx scripts/backfill-journal-automation.ts --apply
 */
import { db } from "../src/lib/db";
import {
  AUTOMATION_DEFAULT_ON_CODES,
  parseJournalAutomationJson,
  type JournalAutomationMap,
} from "../src/lib/journal-automation";

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

async function main() {
  const apply = process.argv.includes("--apply");

  const orgs = await db.organization.findMany({
    select: {
      id: true,
      name: true,
      journalAutomationJson: true,
      autoJournalCodes: true,
      disabledJournalCodes: true,
    },
    orderBy: { id: "asc" },
  });

  let changed = 0;
  let skipped = 0;

  for (const org of orgs) {
    const map: JournalAutomationMap = parseJournalAutomationJson(
      org.journalAutomationJson
    );
    const disabled = new Set(toStringArray(org.disabledJournalCodes));
    const legacy = new Set(toStringArray(org.autoJournalCodes));

    const added: string[] = [];
    for (const code of AUTOMATION_DEFAULT_ON_CODES) {
      if (map[code]) continue;
      if (disabled.has(code)) continue;
      map[code] = { autoCreate: true, autoFill: true };
      legacy.add(code);
      added.push(code);
    }

    if (added.length === 0) {
      skipped += 1;
      continue;
    }
    changed += 1;
    console.log(
      `${apply ? "APPLY" : "DRY  "} org=${org.id} «${org.name}» → ${added.join(", ")}`
    );

    if (!apply) continue;
    await db.organization.update({
      where: { id: org.id },
      data: {
        journalAutomationJson: map as never,
        autoJournalCodes: [...legacy].sort() as never,
      },
    });
  }

  console.log(
    `\nОрганизаций: ${orgs.length}, изменено: ${changed}, без изменений: ${skipped}`
  );
  if (!apply) {
    console.log("Это dry-run. Повторите с --apply, чтобы записать.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
