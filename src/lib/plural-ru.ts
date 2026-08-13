/**
 * Русское склонение существительных по числу.
 *
 * Появилось из-за V10 аудита: в чек-листе уборки/проветривания
 * периодичность печаталась как «3 раз(а) в день» — канцелярская заглушка,
 * которой у эталона нет. Держим один helper на проект, чтобы такие
 * «раз(а)» не расползались по журналам заново.
 *
 *   pluralRu(1, "раз", "раза", "раз") → "раз"
 *   pluralRu(3, "раз", "раза", "раз") → "раза"
 *   pluralRu(5, "раз", "раза", "раз") → "раз"
 */
export function pluralRu(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  const abs = Math.abs(Math.trunc(count));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = abs % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** «1 раз», «2 раза», «5 раз» — самая частая пара в журналах. */
export function formatTimesRu(count: number): string {
  return `${count} ${pluralRu(count, "раз", "раза", "раз")}`;
}
