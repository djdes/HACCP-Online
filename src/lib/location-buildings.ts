import { db } from "@/lib/db";

/**
 * Точки (2026-09-05): завести точки по числу из анкеты после регистрации.
 *
 * «Точек» = N ≥ 2 → в организации должно быть не меньше N зданий-точек:
 * недостающие создаются как «Точка k» (нумерация продолжает уже
 * существующие здания), первая созданная с нуля получает адрес
 * организации, и включается `perLocationJournals`. При N = 1 ничего не
 * происходит: одна точка — это обычная организация без переключателя.
 *
 * Идемпотентно: повторное сохранение анкеты с тем же числом ничего не
 * добавляет. Верхняя граница страхует от опечатки «500» — остальное
 * заводят руками на /settings/buildings.
 */
export const MAX_AUTO_LOCATIONS = 50;

export async function ensureLocationBuildings(
  organizationId: string,
  locationsCount: number,
  options: { firstAddress?: string | null } = {},
): Promise<{ created: number; enabled: boolean }> {
  const target = Math.min(Math.max(Math.floor(locationsCount), 0), MAX_AUTO_LOCATIONS);
  if (target < 2) return { created: 0, enabled: false };

  const existing = await db.building.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, sortOrder: true },
  });
  const taken = new Set(existing.map((building) => building.name.trim().toLowerCase()));
  let created = 0;
  let number = existing.length + 1;
  let sortOrder = existing.reduce((max, building) => Math.max(max, building.sortOrder), -1) + 1;

  while (existing.length + created < target) {
    const name = `Точка ${number}`;
    number += 1;
    if (taken.has(name.toLowerCase())) continue;
    await db.building.create({
      data: {
        organizationId,
        name,
        address:
          existing.length === 0 && created === 0
            ? options.firstAddress?.trim() || null
            : null,
        sortOrder,
      },
      select: { id: true },
    });
    taken.add(name.toLowerCase());
    sortOrder += 1;
    created += 1;
  }

  await db.organization.update({
    where: { id: organizationId },
    data: { perLocationJournals: true },
  });
  return { created, enabled: true };
}
