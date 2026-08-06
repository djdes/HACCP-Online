import { db } from "@/lib/db";

/**
 * Тарифы платформы. Цена живёт в БД (`PlatformTariff`) и правится ROOT'ом
 * в /root/tariffs — лендинг, /pricing и создание платежа читают отсюда,
 * поэтому смена цены не требует деплоя.
 *
 * Если таблица пуста (свежая база, первый деплой после миграции) —
 * идемпотентно засеваем дефолты, чтобы страницы не падали и кнопки
 * оплаты работали сразу.
 */

export type Tariff = {
  key: string;
  title: string;
  priceRub: number;
  periodDays: number;
  active: boolean;
  sort: number;
};

export const TARIFF_MONTHLY = "monthly";
export const TARIFF_BUNDLE = "bundle";

const DEFAULT_TARIFFS: Tariff[] = [
  {
    key: TARIFF_MONTHLY,
    title: "Подписка",
    priceRub: 1990,
    periodDays: 30,
    active: true,
    sort: 0,
  },
  {
    key: TARIFF_BUNDLE,
    title: "Подписка + оборудование",
    priceRub: 1990,
    periodDays: 30,
    active: true,
    sort: 1,
  },
];

/**
 * Все тарифы, отсортированные для вывода. При пустой таблице сидирует
 * дефолты. `createMany({ skipDuplicates })` делает вызов безопасным при
 * гонке двух параллельных запросов после деплоя.
 */
export async function readTariffs(): Promise<Tariff[]> {
  const rows = await db.platformTariff.findMany({
    orderBy: [{ sort: "asc" }, { key: "asc" }],
  });
  if (rows.length > 0) return rows.map(toTariff);

  await db.platformTariff.createMany({
    data: DEFAULT_TARIFFS,
    skipDuplicates: true,
  });
  const seeded = await db.platformTariff.findMany({
    orderBy: [{ sort: "asc" }, { key: "asc" }],
  });
  return seeded.map(toTariff);
}

/**
 * Один тариф по ключу. Возвращает null для неизвестного/выключенного —
 * вызывающий код обязан это обработать (кнопка оплаты не должна создавать
 * заказ по тарифу, который ROOT снял с продажи).
 */
export async function readTariff(key: string): Promise<Tariff | null> {
  const all = await readTariffs();
  return all.find((t) => t.key === key && t.active) ?? null;
}

/**
 * Фолбэк на случай, если БД недоступна при рендере публичной страницы:
 * лендинг важнее, чем точность цены до перезагрузки.
 */
export function fallbackTariffs(): Tariff[] {
  return DEFAULT_TARIFFS.map((t) => ({ ...t }));
}

function toTariff(row: {
  key: string;
  title: string;
  priceRub: number;
  periodDays: number;
  active: boolean;
  sort: number;
}): Tariff {
  return {
    key: row.key,
    title: row.title,
    priceRub: row.priceRub,
    periodDays: row.periodDays,
    active: row.active,
    sort: row.sort,
  };
}

/** Формат цены для интерфейса: «1 990 ₽». */
export function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}
