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

type Props = {
  /** Название организации (ООО «Кухня» / ИП Иванов и т.п.). */
  orgName: string;
  /** Полное название журнала, italic в нижней средней ячейке. */
  title: string;
  /** Текст в правой колонке. По умолчанию «СТР 1 ИЗ 1». */
  pageInfo?: string;
  /**
   * Альтернативный режим — для журналов которые не имеют period
   * (бракераж, аварии, жалобы): показываем «Начат: dd.mm.yyyy» +
   * «Окончен: dd.mm.yyyy / —» вместо «СТР 1 ИЗ 1».
   * Если задан, перебивает pageInfo.
   */
  dateMode?: {
    startedAt?: Date | string | null;
    finishedAt?: Date | string | null;
  };
  /** Доп. css-класс для wrapper. */
  className?: string;
};

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function JournalDocumentHeader({
  orgName,
  title,
  pageInfo = "СТР 1 ИЗ 1",
  dateMode,
  className = "",
}: Props) {
  const showDateMode = Boolean(dateMode);

  return (
    <div
      className={`mx-auto w-full max-w-[820px] rounded-2xl border border-[#0b1024]/15 bg-white print:rounded-none print:border print:border-black ${className}`}
    >
      <div className="grid grid-cols-[1fr_2fr_0.9fr] divide-x divide-[#0b1024]/15 text-[12.5px] leading-tight text-[#0b1024] sm:text-[13px] print:divide-black">
        {/* Левая колонка — название организации */}
        <div className="flex items-center justify-center px-3 py-3 text-center font-medium sm:px-4 sm:py-4">
          {orgName}
        </div>

        {/* Средняя колонка — СИСТЕМА ХАССП + название журнала */}
        <div className="grid grid-rows-2 divide-y divide-[#0b1024]/15 print:divide-black">
          <div className="flex items-center justify-center px-3 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] sm:text-[12.5px]">
            СИСТЕМА ХАССП
          </div>
          <div className="flex items-center justify-center px-3 py-2.5 italic">
            {title}
          </div>
        </div>

        {/* Правая колонка — СТР 1 ИЗ 1 ИЛИ Начат/Окончен */}
        <div className="flex items-center justify-center px-3 py-3 text-center text-[11.5px] sm:py-4 sm:text-[12px]">
          {showDateMode ? (
            <div className="space-y-1.5 leading-snug">
              <div>
                Начат{" "}
                <span className="block font-medium tabular-nums">
                  {formatDate(dateMode?.startedAt)}
                </span>
              </div>
              <div>
                Окончен{" "}
                <span className="block font-medium tabular-nums">
                  {formatDate(dateMode?.finishedAt)}
                </span>
              </div>
            </div>
          ) : (
            <span className="font-medium uppercase tracking-[0.05em]">
              {pageInfo}
            </span>
          )}
        </div>
      </div>
    </div>
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
}: {
  title?: string;
  items: Array<{ symbol: string; description: string }>;
  className?: string;
}) {
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
