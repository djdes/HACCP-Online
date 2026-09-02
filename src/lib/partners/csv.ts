/**
 * CSV для Excel в русской локали: UTF-8 с BOM (иначе кириллица — кракозябры),
 * разделитель `;` (запятая в ru-RU — десятичный знак, Excel не разобьёт
 * колонки), CRLF, суммы с запятой.
 */

export const CSV_BOM = "﻿";
export const CSV_SEPARATOR = ";";

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? csvNumber(value) : String(value);
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** 2662.5 → "2662,50" — Excel ru-RU читает как число. */
export function csvNumber(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function buildCsv(
  header: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [header, ...rows].map((row) =>
    row.map(csvCell).join(CSV_SEPARATOR),
  );
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

export const ACCRUAL_CSV_HEADER = [
  "Дата",
  "Клиент",
  "Основание",
  "Сумма платежа клиента, ₽",
  "Ставка, %",
  "Начислено, ₽",
  "Статус",
  "Месяц",
  "Версия правил",
];

export function csvContentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export type AccrualCsvRow = {
  date: Date;
  clientName: string;
  kind: string;
  baseAmountRub: number;
  ratePercent: number | null;
  amountRub: number;
  status: string;
  periodMonth: string;
  ruleVersion: number;
};

/** Дата для Excel: ДД.ММ.ГГГГ по Москве — как в ведомости бухгалтера. */
export function csvDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function buildAccrualsCsv(
  rows: AccrualCsvRow[],
  labels: { kind: Record<string, string>; status: Record<string, string> },
): string {
  return buildCsv(
    ACCRUAL_CSV_HEADER,
    rows.map((r) => [
      csvDate(r.date),
      r.clientName,
      labels.kind[r.kind] ?? r.kind,
      r.baseAmountRub,
      r.ratePercent === null ? "" : csvNumber(r.ratePercent),
      r.amountRub,
      labels.status[r.status] ?? r.status,
      r.periodMonth,
      String(r.ruleVersion),
    ]),
  );
}
