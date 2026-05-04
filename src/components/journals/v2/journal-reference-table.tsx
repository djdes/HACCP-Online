"use client";

import type { ReactNode } from "react";

/**
 * Унифицированная таблица-справочник в Design v2.
 *
 * Используется для:
 *   • легенды условных обозначений (Зд / В / Б / л / ОТ / Отп)
 *   • справочника «Что моется в каждом помещении»
 *   • температурных режимов в бракераже
 *   • словарей продуктов в acceptance / metal-impurity
 *
 * Структура:
 *   ┌── Optional title ────────────────────────────┐
 *   │ {Title}                                       │
 *   ├── Table (тонкие чёрные границы, для печати) ─┤
 *   │ headers ...                                   │
 *   │ rows ...                                      │
 *   └───────────────────────────────────────────────┘
 *
 * Не интерактивная — это справочник. Для редактируемых таблиц
 * использовать обычный <table> с inline input'ами как в журналах.
 */
export function JournalReferenceTable({
  title,
  headers,
  rows,
  /** Если true — рамка чёрная (для печати), иначе serene. */
  printFriendly = true,
  /** Если задан — рендерится подчёркнутый italic-заголовок над таблицей. */
  underline = false,
}: {
  title?: string;
  headers: string[];
  rows: ReactNode[][];
  printFriendly?: boolean;
  underline?: boolean;
}) {
  const cellBorder = printFriendly ? "border border-black" : "border border-[#dcdfed]";
  return (
    <div className="space-y-3">
      {title ? (
        <div
          className={[
            "text-[14px] font-semibold text-[#0b1024]",
            underline ? "italic underline" : "uppercase tracking-[0.12em] text-[#6f7282]",
          ].join(" ")}
        >
          {title}
        </div>
      ) : null}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th
                  key={`${h}-${i}`}
                  className={`${cellBorder} bg-[#fafbff] p-3 text-left font-semibold text-[#0b1024]`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td
                    key={cIdx}
                    className={`${cellBorder} p-3 align-top text-[#0b1024]`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
