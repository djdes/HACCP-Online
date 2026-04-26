import { db } from "@/lib/db";

/**
 * Построитель CSV-файла со списаниями (LossRecord) за период в формате,
 * который безболезненно открывается в Excel (UTF-8 BOM, разделитель `;`)
 * и принимается типовыми импортёрами 1С:Бухгалтерия.
 *
 * Формат — простой реестр, не CommerceML. На практике 1С-юзер открывает
 * этот CSV в «Загрузка данных из табличного документа» и мапит колонки
 * на свой документ «Списание товаров». XML-CommerceML — overhead для
 * MVP; добавим если будет конкретный запрос.
 *
 * Колонки:
 *   Дата | Категория | Продукт | Кол-во | Ед.изм | Сумма ₽ | Причина | Комментарий
 */

const HEADERS = [
  "Дата",
  "Категория",
  "Продукт",
  "Кол-во",
  "Ед.изм",
  "Сумма (₽)",
  "Причина",
] as const;

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Если содержит ; " или \n — оборачиваем в "" и удваиваем кавычки.
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function buildLosses1cCsv(
  organizationId: string,
  fromDate: Date,
  toDate: Date
): Promise<{ csv: string; rowCount: number; totalSumKopecks: number }> {
  const records = await db.lossRecord.findMany({
    where: {
      organizationId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: { date: "asc" },
  });

  const rows: string[] = [];
  rows.push(HEADERS.map(csvEscape).join(";"));

  let totalSumKopecks = 0;
  for (const r of records) {
    const costRub = r.costRub ?? 0;
    totalSumKopecks += Math.round(costRub * 100);

    rows.push(
      [
        r.date.toISOString().slice(0, 10).split("-").reverse().join("."), // ДД.MM.ГГГГ
        r.category,
        r.productName,
        String(r.quantity).replace(".", ","),
        r.unit,
        costRub.toFixed(2).replace(".", ","),
        r.cause ?? "",
      ]
        .map(csvEscape)
        .join(";")
    );
  }

  // BOM для корректного открытия в Excel и импорта в 1С
  // (windows-1251 сейчас не нужен, 1С 8.x понимает UTF-8 с BOM).
  const csv = "﻿" + rows.join("\r\n");

  return { csv, rowCount: records.length, totalSumKopecks };
}
