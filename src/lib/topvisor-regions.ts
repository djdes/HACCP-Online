/**
 * Регионы съёма Topvisor — чистые данные без сети и секретов.
 *
 * Вынесено из `topvisor.ts` намеренно: тот модуль читает
 * TOPVISOR_API_KEY и ходит в API, поэтому клиентским компонентам его
 * импортировать нельзя. Список регионов нужен и серверу, и экрану.
 *
 * Индексы не угаданы, а сняты с боевого get/projects_2/projects
 * проекта 32866188.
 */
export const TOPVISOR_REGIONS = [
  { index: 1, searcher: "Яндекс", region: "Москва", byDefault: true },
  { index: 5, searcher: "Яндекс", region: "Россия", byDefault: true },
  { index: 2, searcher: "Google", region: "Москва", byDefault: false },
  { index: 7, searcher: "Google", region: "Россия", byDefault: false },
] as const;

export type TopvisorRegion = (typeof TOPVISOR_REGIONS)[number];

/**
 * Дефолт съёма — только Яндекс: основной трафик по запросам про журналы
 * СанПиН оттуда, а каждая пара «фраза × регион» стоит 0,09 ₽.
 */
export const DEFAULT_REGION_INDEXES = TOPVISOR_REGIONS.filter(
  (region) => region.byDefault
).map((region) => region.index);

export function regionLabel(index: number): string {
  const region = TOPVISOR_REGIONS.find((item) => item.index === index);
  return region ? `${region.searcher} · ${region.region}` : `Регион ${index}`;
}
