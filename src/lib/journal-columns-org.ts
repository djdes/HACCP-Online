import { db } from "@/lib/db";
import { parseOrgColumnDefaults, type JournalColumnsConfig } from "@/lib/journal-columns";

/**
 * Общие наборы колонок организации — `Organization.journalColumnsJson`:
 *
 *   { finished_product: { hidden: ["temp"], labels: { name: "Блюдо" } } }
 *
 * Модель «копия»: набор записывается в `config.columns` документов при
 * создании и по «Применить ко всем документам», а не наследуется на
 * лету — печать и адаптеры TasksFlow читают флаги из конфига документа.
 * Правила разбора — в `journal-columns.ts` (чистые функции, есть тесты).
 */

export async function getOrgColumnDefaults(
  organizationId: string
): Promise<Record<string, JournalColumnsConfig>> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { journalColumnsJson: true },
  });
  return parseOrgColumnDefaults(org?.journalColumnsJson);
}

/** Сохраняет общий набор журнала; возвращает всю карту организации. */
export async function setOrgColumnDefault(
  organizationId: string,
  code: string,
  columns: JournalColumnsConfig
): Promise<Record<string, JournalColumnsConfig>> {
  const current = await getOrgColumnDefaults(organizationId);
  const next = { ...current, [code]: columns };
  await db.organization.update({
    where: { id: organizationId },
    data: { journalColumnsJson: next },
  });
  return next;
}
