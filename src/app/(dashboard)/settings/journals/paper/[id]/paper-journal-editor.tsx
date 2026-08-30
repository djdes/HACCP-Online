"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Eraser,
  ExternalLink,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { PaperJournal } from "@/lib/sphere-journal-rules";

type Organization = {
  name: string;
  inn: string | null;
  address: string | null;
};

const START_ROWS = 5;

type StaffMember = { name: string; title: string };

/**
 * Колонки бланка — обычные строки заголовков, единого справочника у них
 * нет. Поэтому узнаём нужные по вхождению слова: «ФИО инструктируемого»,
 * «Ф.И.О. работника», «Должность, профессия». Не угадали — колонка
 * просто остаётся пустой, как и была.
 */
/**
 * Колонка про того, КОГО инструктируют (или чьи данные вносят).
 *
 * Проверяем именно окончание: «инструктируемого» и «инструктирующего»
 * отличаются двумя буквами, и проверка на одно «ФИО» ставила в обе
 * колонки одного человека — в журнале выходило, что работник
 * инструктировал сам себя.
 */
function isSubjectColumn(column: string): boolean {
  const c = column.toLowerCase();
  if (c.includes("инструктирующ") || c.includes("ответственн")) return false;
  if (c.includes("проводивш") || c.includes("выдавш")) return false;
  return c.includes("фио") || c.includes("ф.и.о") || c.includes("работник");
}

/** Колонка про того, КТО инструктирует / отвечает. Он один на весь журнал. */
function isResponsibleColumn(column: string): boolean {
  const c = column.toLowerCase();
  return (
    c.includes("инструктирующ") ||
    c.includes("ответственн") ||
    c.includes("проводивш") ||
    c.includes("выдавш")
  );
}

function isDateColumn(column: string): boolean {
  const c = column.toLowerCase();
  return c.includes("дата") && !c.includes("рождения");
}

function isPositionColumn(column: string): boolean {
  const c = column.toLowerCase();
  return c.includes("должность") || c.includes("профессия");
}

/** Сегодняшняя дата в том виде, в каком её пишут в бланке. */
function todayLabel(): string {
  return new Date().toLocaleDateString("ru-RU");
}

function fillRowForStaff(
  columns: string[],
  person: StaffMember,
  responsibleName: string,
): string[] {
  return columns.map((column) => {
    if (isSubjectColumn(column)) return person.name;
    if (isResponsibleColumn(column)) return responsibleName;
    if (isPositionColumn(column)) return person.title;
    if (isDateColumn(column)) return todayLabel();
    // Год рождения, вид инструктажа и подписи — только от руки: в модели
    // их нет, а подпись в бумажном журнале и должна быть живой.
    return "";
  });
}

export function PaperJournalEditor({
  journal,
  organization,
  staff = [],
  documentId,
  initialRows,
  initialResponsible,
  readOnly = false,
}: {
  journal: PaperJournal;
  organization: Organization;
  /** Активные сотрудники — ими предзаполняются строки бланка. */
  staff?: StaffMember[];
  /** Открытый документ. Без него редактор работает как разовый бланк. */
  documentId?: string;
  initialRows?: string[][];
  initialResponsible?: string;
  /** Документ закрыт — смотреть можно, править нельзя. */
  readOnly?: boolean;
}) {
  // Инструктирующий один на весь журнал — это всегда конкретный человек
  // из штата (по охране труда, по пожарной безопасности и т.д.).
  const [responsible, setResponsible] = useState<string>(
    initialResponsible ?? "",
  );
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<string[][]>(() => {
    if (initialRows && initialRows.length > 0) return initialRows;
    return staff.length > 0
      ? staff.map((person) =>
          fillRowForStaff(journal.columns, person, initialResponsible ?? ""),
        )
      : Array.from({ length: START_ROWS }, () => journal.columns.map(() => ""));
  });

  /**
   * Сохранение через полсекунды после последней правки.
   *
   * Кнопки «Сохранить» здесь нет намеренно: человек заполняет бланк
   * ячейка за ячейкой, и терять всё из-за закрытой вкладки он не должен.
   * Задержка склеивает набор в один запрос.
   */
  useEffect(() => {
    if (!documentId || readOnly) return;
    const timer = setTimeout(() => {
      setSaving(true);
      fetch(
        `/api/settings/journals/paper/${journal.id}/documents/${documentId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows, responsible }),
        },
      )
        .catch(() => toast.error("Не удалось сохранить"))
        .finally(() => setSaving(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [rows, responsible, documentId, journal.id, readOnly]);

  const hasResponsibleColumn = journal.columns.some(isResponsibleColumn);

  /** Проставляет выбранного человека во ВСЕ строки разом. */
  function applyResponsible(name: string) {
    setResponsible(name);
    setRows((current) =>
      current.map((row) =>
        row.map((cell, index) =>
          isResponsibleColumn(journal.columns[index] ?? "") ? name : cell,
        ),
      ),
    );
  }
  const [busy, setBusy] = useState(false);

  function setCell(rowIndex: number, columnIndex: number, value: string) {
    setRows((prev) =>
      prev.map((row, index) =>
        index === rowIndex
          ? row.map((cell, column) => (column === columnIndex ? value : cell))
          : row,
      ),
    );
  }

  function addRow() {
    setRows((prev) => [...prev, journal.columns.map(() => "")]);
  }

  function clearRows() {
    setResponsible("");
    setRows(Array.from({ length: START_ROWS }, () => journal.columns.map(() => "")));
  }

  function removeRow(rowIndex: number) {
    setRows((prev) => prev.filter((_, index) => index !== rowIndex));
  }

  /**
   * PDF собирается на сервере: там уже лежит шрифт с кириллицей и общая
   * вёрстка бланка, дублировать её на клиенте незачем.
   */
  async function download(withRows: boolean) {
    setBusy(true);
    try {
      const filled = rows.filter((row) => row.some((cell) => cell.trim()));
      const response = await fetch(
        `/api/settings/journals/paper/${journal.id}/pdf`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: withRows ? filled : [] }),
        },
      );
      if (!response.ok) throw new Error("Не удалось собрать бланк");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${journal.id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Бланк готов — откройте файл и распечатайте");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-[#ffd9d0] bg-[#fff8f6] p-5 sm:p-6">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-medium ${
            journal.paperOnly
              ? "bg-[#fff4f2] text-[#a13a32]"
              : "bg-[#fff1d6] text-[#b45309]"
          }`}
        >
          {journal.paperOnly ? "Только на бумаге" : "Бланк для печати"}
        </span>
        <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          {journal.name}
        </h1>
        <p className="mt-2 max-w-[720px] text-[14px] leading-relaxed text-[#6f7282]">
          {journal.why} Штраф {journal.fineHint}.{" "}
          <a
            href={journal.law.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-[#5566f6] hover:underline"
          >
            {journal.law.label}
            <ExternalLink className="size-3" />
          </a>
        </p>
      </section>

      {/* Шапка бланка — так же, как в электронных журналах: человек видит,
          что именно уйдёт в печать, а не читает обещание «подставится
          сама». Разметка повторяет верх PDF: организация слева, система
          по центру, даты справа. */}
      <section className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <tbody>
            <tr>
              <td
                rowSpan={2}
                className="w-[34%] border border-[#0b1024] px-3 py-2 text-center align-middle font-semibold"
              >
                {organization.name}
                {organization.inn ? (
                  <div className="mt-0.5 text-[11px] font-normal text-[#3c4053]">
                    ИНН {organization.inn}
                  </div>
                ) : null}
                {organization.address ? (
                  <div className="text-[11px] font-normal text-[#3c4053]">
                    {organization.address}
                  </div>
                ) : null}
              </td>
              <td className="border border-[#0b1024] px-3 py-2 text-center">
                СИСТЕМА ХАССП
              </td>
              <td className="w-[22%] border border-[#0b1024] px-3 py-2 text-[12px]">
                Начат&nbsp;&nbsp;{todayLabel()}
                <div className="mt-1">Окончен&nbsp;&nbsp;__________</div>
              </td>
            </tr>
            <tr>
              <td className="border border-[#0b1024] px-3 py-2 text-center italic">
                {journal.name}
              </td>
              <td className="border border-[#0b1024] px-3 py-2 text-center text-[12px]">
                СТР. 1 ИЗ 1
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-[#ececf4] bg-white">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead className="bg-[#f6f7fb] text-[13px] text-[#6f7282]">
            <tr>
              <th className="w-[46px] px-3 py-2 text-center font-medium">№</th>
              {journal.columns.map((column) => (
                <th key={column} className="px-3 py-2 text-left font-medium">
                  {column}
                </th>
              ))}
              <th className="w-[52px] px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-[#eef0f6]">
                <td className="px-3 py-1.5 text-center text-[13px] text-[#9b9fb3]">
                  {rowIndex + 1}
                </td>
                {journal.columns.map((column, columnIndex) => (
                  <td key={column} className="px-1.5 py-1.5">
                    <input
                      value={row[columnIndex] ?? ""}
                      onChange={(e) =>
                        setCell(rowIndex, columnIndex, e.target.value)
                      }
                      className="h-9 w-full min-w-[120px] rounded-xl border border-transparent bg-transparent px-2 text-[14px] text-[#0b1024] hover:border-[#dcdfed] focus:border-[#5566f6] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                    />
                  </td>
                ))}
                <td className="px-3 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(rowIndex)}
                    aria-label="Удалить строку"
                    className="inline-flex size-8 items-center justify-center rounded-xl text-[#9b9fb3] transition-colors hover:bg-[#fff4f2] hover:text-[#d2453d]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {documentId ? (
        <p className="text-[12px] text-[#6f7282]">
          {readOnly
            ? "Документ закрыт — правка недоступна."
            : saving
              ? "Сохраняю…"
              : "Изменения сохраняются сами"}
        </p>
      ) : null}

      {staff.length > 0 ? (
        <p className="rounded-2xl bg-[#f5f6ff] px-4 py-2.5 text-[13px] leading-snug text-[#3c4053]">
          Сотрудники и дата подставлены из карточек — остаётся собрать
          подписи на распечатке. Подписи специально пустые: бумажный журнал
          тем и ценен, что они живые.
        </p>
      ) : null}

      {hasResponsibleColumn && staff.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#0b1024]">
              Кто проводит инструктаж
            </div>
            <p className="mt-0.5 text-[12px] text-[#6f7282]">
              Один человек на весь журнал — подставится во все строки.
            </p>
          </div>
          <select
            value={responsible}
            onChange={(event) => applyResponsible(event.target.value)}
            className="ml-auto h-10 min-w-[220px] rounded-2xl border border-[#dcdfed] bg-white px-3 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
          >
            <option value="">— выберите —</option>
            {staff.map((person) => (
              <option key={person.name} value={person.name}>
                {person.name}
                {person.title ? ` · ${person.title}` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          <Plus className="size-4 text-[#5566f6]" />
          Строка
        </button>
        {staff.length > 0 ? (
          <button
            type="button"
            onClick={clearRows}
            title="Убрать подставленных сотрудников и начать с пустого бланка"
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#6f7282] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            <Eraser className="size-4" />
            Очистить
          </button>
        ) : null}
        <div className="flex-1" />
        <button
          type="button"
          disabled={busy}
          onClick={() => download(false)}
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60"
        >
          <Download className="size-4 text-[#5566f6]" />
          Пустой бланк
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => download(true)}
          className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_12px_36px_-16px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60"
        >
          <Printer className="size-4" />
          {busy ? "Готовлю…" : "Скачать и распечатать"}
        </button>
      </div>

      <p className="text-[13px] text-[#9b9fb3]">
        Данные не сохраняются: этот журнал ведётся на бумаге, страница нужна
        только чтобы напечатать заполненный лист.
      </p>
    </div>
  );
}
