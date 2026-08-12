/**
 * Официальный ХАССП-style документ-заголовок.
 *
 * Используется в верхней части каждого journal-document-client'а.
 * Воспроизводит вид бумажного журнала — три колонки:
 *
 *   ┌────────────┬────────────────────────────────┬─────────────┐
 *   │            │       СИСТЕМА ХАССП            │             │
 *   │  ООО {имя} ├────────────────────────────────┤  СТР 1 ИЗ 1 │
 *   │            │  {Название журнала, italic}    │             │
 *   └────────────┴────────────────────────────────┴─────────────┘
 *
 * Делает наши журналы похожими на «бумажные» при печати —
 * РПН/СЭС-проверка ожидает официального ХАССП-блока сверху.
 *
 * Аналог haccp-online.ru, но в нашей design-system.
 */

import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
} from "@/components/journals/journal-grid";

type Props = {
  /** Название организации (ООО «Кухня» / ИП Иванов и т.п.). */
  orgName: string;
  /** Полное название журнала, italic в нижней средней ячейке. */
  title: string;
  /** Текст в правой нижней ячейке. По умолчанию «СТР. 1 ИЗ 1». */
  pageInfo?: string;
  /** Дата начала документа (`JournalDocument.dateFrom`). */
  startedAt?: Date | string | null;
  /**
   * Дата закрытия документа. У активного документа — `null`: в правой
   * верхней ячейке печатается подчёркнутый пропуск, как на бумаге.
   */
  finishedAt?: Date | string | null;
  /**
   * Устаревшая форма тех же двух дат. Оставлена ради вызовов, которые
   * ещё передают `dateMode={{ startedAt, finishedAt }}`.
   */
  dateMode?: {
    startedAt?: Date | string | null;
    finishedAt?: Date | string | null;
  };
  /**
   * «Периодичность контроля» — отдельная строка шапки (осознанное решение
   * владельца, у эталона её нет). Значение приходит из
   * `JournalDocument.config.controlPeriodicity`
   * (см. `src/lib/control-periodicity.ts`). Пустая строка / undefined —
   * строка не рендерится.
   */
  controlPeriodicity?: string | null;
  /** Доп. css-класс для wrapper. */
  className?: string;
};

/**
 * Дата в формате эталона — `ДД-ММ-ГГГГ` (climate_control-grid.png:
 * «Начат 10-08-2026»). Пусто/битая дата — подчёркнутый пропуск.
 */
export const PAPER_HEADER_DATE_BLANK = "__________";

export function formatPaperHeaderDate(
  d: Date | string | null | undefined
): string {
  if (!d) return PAPER_HEADER_DATE_BLANK;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return PAPER_HEADER_DATE_BLANK;
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${dt.getFullYear()}`;
}

/**
 * Строки бумажной шапки как `<tr>` — вставляются прямо в `<tbody>` таблицы
 * журнала, поэтому шапка ВСЕГДА ровно той же ширины, что и сама таблица
 * (раньше в cleaning шапка была ~57% ширины сетки и центрировалась отдельно).
 *
 * Раскладка — как на эталоне (climate_control-grid.png):
 *
 *   ┌──────────────┬──────────────────────────┬──────────────────────┐
 *   │              │      СИСТЕМА ХАССП       │ Начат    10-08-2026  │
 *   │  ООО «Имя»   │                          │ Окончен  __________  │
 *   │              ├──────────────────────────┼──────────────────────┤
 *   │              │  {название журнала}      │     СТР. 1 ИЗ 1      │
 *   ├──────────────┴──────────────────────────┴──────────────────────┤
 *   │ Периодичность контроля │ {текст}                               │
 *   └────────────────────────┴───────────────────────────────────────┘
 *
 * Все ячейки — с видимыми границами (`GRID_CELL_CLASS`), включая правую
 * колонку: до этой правки она «висела» без рамки.
 */
export function JournalPaperHeaderRows({
  orgName,
  title,
  pageInfo = "СТР. 1 ИЗ 1",
  startedAt,
  finishedAt,
  controlPeriodicity,
  orgCellClass = "w-[20%]",
  sideCellClass = "w-[22%]",
}: {
  orgName: string;
  title: string;
  pageInfo?: string;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  controlPeriodicity?: string | null;
  /** Ширина левой колонки (у широких сеток задаётся в px). */
  orgCellClass?: string;
  /** Ширина правой колонки. */
  sideCellClass?: string;
}) {
  return (
    <>
      <tr>
        <td
          rowSpan={2}
          className={`${orgCellClass} ${GRID_CELL_CLASS} px-3 py-2 text-center text-[13px] font-semibold leading-tight`}
        >
          {orgName}
        </td>
        <td
          className={`${GRID_CELL_CLASS} px-3 py-2 text-center text-[13px] uppercase leading-tight`}
        >
          СИСТЕМА ХАССП
        </td>
        <td
          className={`${sideCellClass} ${GRID_CELL_CLASS} px-3 py-2 text-[13px] leading-tight`}
        >
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">Начат</span>
            <span className="tabular-nums">{formatPaperHeaderDate(startedAt)}</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span>Окончен</span>
            <span className="tabular-nums">{formatPaperHeaderDate(finishedAt)}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td
          className={`${GRID_CELL_CLASS} px-3 py-2 text-center text-[13px] uppercase italic leading-tight`}
        >
          {title}
        </td>
        <td
          className={`${GRID_CELL_CLASS} px-3 py-2 text-center text-[13px] uppercase leading-tight`}
        >
          {pageInfo}
        </td>
      </tr>
      <JournalPeriodicityHeaderRow
        text={controlPeriodicity}
        labelClass={GRID_HEAD_CELL_CLASS}
        valueClass={GRID_CELL_CLASS}
        valueColSpan={2}
      />
    </>
  );
}

/**
 * Готовая бумажная шапка отдельной таблицей — для журналов, у которых
 * сетка данных живёт в своей `<table>`. Ширина — 100% контейнера, то есть
 * ровно ширина журнальной таблицы, если обе лежат в одном viewport'е.
 */
export function JournalDocumentHeader({
  orgName,
  title,
  pageInfo = "СТР. 1 ИЗ 1",
  startedAt,
  finishedAt,
  dateMode,
  controlPeriodicity,
  className = "",
}: Props) {
  return (
    <table
      className={`w-full border-collapse text-[13px] text-[#0b1024] ${className}`}
    >
      <tbody>
        <JournalPaperHeaderRows
          orgName={orgName}
          title={title}
          pageInfo={pageInfo}
          startedAt={startedAt ?? dateMode?.startedAt}
          finishedAt={finishedAt ?? dateMode?.finishedAt}
          controlPeriodicity={controlPeriodicity}
        />
      </tbody>
    </table>
  );
}

/**
 * Та же строка «Периодичность контроля», но как `<tr>` — для журналов,
 * чья бумажная шапка собрана собственной `<table>` (гигиена, здоровье,
 * климат, бракераж, приёмка, вентиляция, генеральные уборки).
 *
 * `labelClass` / `valueClass` принимают GRID-токены хоста
 * (`GRID_CELL_CLASS` и т.п.), поэтому строка наследует и экранный стиль,
 * и `print:border-black`.
 */
export function JournalPeriodicityHeaderRow({
  text,
  labelClass = "",
  valueClass = "",
  valueColSpan = 2,
}: {
  text?: string | null;
  labelClass?: string;
  valueClass?: string;
  /** Сколько колонок занимает ячейка со значением (обычно «средняя + правая»). */
  valueColSpan?: number;
}) {
  const value = (text ?? "").trim();
  if (!value) return null;

  return (
    <tr>
      <td className={`px-3 py-2 text-center text-[12.5px] font-semibold ${labelClass}`}>
        Периодичность контроля
      </td>
      <td
        colSpan={valueColSpan}
        className={`px-3 py-2 text-[12.5px] leading-[1.4] ${valueClass}`}
      >
        {value}
      </td>
    </tr>
  );
}

/**
 * Большой H2 заголовок журнала (рендерится сразу под document header'ом).
 * Имитирует «ЖУРНАЛ УБОРКИ» / «ГИГИЕНИЧЕСКИЙ ЖУРНАЛ» в haccp-online.
 */
export function JournalDocumentTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`text-center text-[16px] font-semibold uppercase tracking-[0.04em] text-[#0b1024] sm:text-[18px] ${className}`}
    >
      {children}
    </h2>
  );
}

/**
 * Условные обозначения — italic underlined header + список сокращений.
 * Отрисовывается ПОД таблицей данных. РПН/СЭС-инспектор глядя в журнал
 * видит легенду что значит «Зд», «В», «Б/л», «T», «Г», «C1» и т.д.
 */
export function JournalLegendBlock({
  title = "Условные обозначения",
  items,
  className = "",
  variant = "card",
}: {
  title?: string;
  items: Array<{ symbol: string; description: string }>;
  className?: string;
  /**
   * `card` — блок в белой карточке (журналы, где легенда стоит особняком).
   * `plain` — как на эталоне журнала уборки (cleaning-07-grid-with-room.png):
   * курсивный текст во всю ширину таблицы, подчёркнутый заголовок, без рамки
   * и скруглений — часть «бумаги», а не элемент интерфейса.
   */
  variant?: "card" | "plain";
}) {
  if (variant === "plain") {
    return (
      <div
        className={`w-full text-[12.5px] italic leading-[1.6] text-[#0b1024] sm:text-[13px] ${className}`}
      >
        <div className="mb-1 font-semibold underline underline-offset-2">
          {title}:
        </div>
        {items.map((item, idx) => (
          <div key={idx}>
            {item.symbol ? `${item.symbol} - ` : ""}
            {item.description}
            {idx === items.length - 1 ? "" : ";"}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`mx-auto w-full max-w-[820px] rounded-2xl border border-[#ececf4] bg-white p-4 text-[12.5px] leading-relaxed text-[#3c4053] sm:p-5 sm:text-[13px] print:rounded-none print:border-black ${className}`}
    >
      <div className="mb-2 italic underline underline-offset-2 text-[12px] font-semibold sm:text-[12.5px]">
        {title}:
      </div>
      <ul className="space-y-1">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-baseline gap-2">
            <span className="font-semibold tabular-nums text-[#0b1024]">
              {item.symbol}
            </span>
            <span className="text-[#9b9fb3]">—</span>
            <span>{item.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
