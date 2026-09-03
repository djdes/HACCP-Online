import type { PaperJournal } from "@/lib/sphere-journal-rules";

/**
 * Правила колонок бумажного бланка.
 *
 * Колонки бланка — обычные строки заголовков, единого справочника у них
 * нет. Поэтому нужные узнаём по вхождению слова: «ФИО инструктируемого»,
 * «Ф.И.О. работника», «Должность, профессия». Не угадали — колонка
 * просто остаётся пустой, как и была.
 *
 * Вынесено из редактора, потому что теперь эти правила нужны трём
 * местам: редактору (подстановка строк), модалке создания (какие поля
 * показывать) и странице документа (шапка).
 */

export type PaperStaffMember = { name: string; title: string };

function lower(column: string): string {
  return column.toLowerCase();
}

/** Колонка с живой подписью — в неё ничего не подставляем никогда. */
export function isSignatureColumn(column: string): boolean {
  return lower(column).includes("подпись");
}

function mentionsVerifier(c: string): boolean {
  return c.includes("проверяющ") || c.includes("контролирующ");
}

function mentionsResponsible(c: string): boolean {
  return (
    c.includes("инструктирующ") ||
    c.includes("ответственн") ||
    c.includes("проводивш") ||
    c.includes("выдавш")
  );
}

/**
 * Колонка того, КТО проверяет («ФИО проверяющего» в журнале по
 * электробезопасности). Проверяется раньше `isSubjectColumn`: иначе
 * «ФИО проверяющего» ловилось как колонка работника, и в неё вставала
 * фамилия инструктируемого.
 */
export function isVerifierColumn(column: string): boolean {
  const c = lower(column);
  return !c.includes("подпись") && mentionsVerifier(c);
}

/** Колонка того, КТО инструктирует / отвечает. Он один на весь журнал. */
export function isResponsibleColumn(column: string): boolean {
  const c = lower(column);
  return !c.includes("подпись") && mentionsResponsible(c);
}

/**
 * Колонка того, КОГО инструктируют (или чьи данные вносят).
 *
 * Проверяем именно окончание: «инструктируемого» и «инструктирующего»
 * отличаются двумя буквами, и проверка на одно «ФИО» ставила в обе
 * колонки одного человека — в журнале выходило, что работник
 * инструктировал сам себя.
 */
export function isSubjectColumn(column: string): boolean {
  const c = lower(column);
  if (c.includes("подпись") || mentionsVerifier(c) || mentionsResponsible(c)) {
    return false;
  }
  return c.includes("фио") || c.includes("ф.и.о") || c.includes("работник");
}

export function isDateColumn(column: string): boolean {
  const c = lower(column);
  return c.includes("дата") && !c.includes("рождения");
}

export function isPositionColumn(column: string): boolean {
  const c = lower(column);
  return c.includes("должность") || c.includes("профессия");
}

/** Есть ли в бланке строки про людей — тогда есть что «подставить». */
export function hasSubjectColumn(journal: PaperJournal): boolean {
  return journal.columns.some(isSubjectColumn);
}

/**
 * Показывать ли в модалке поле ответственного. Считаем и колонку
 * подписи: у огнетушителей ответственный есть только как «Подпись
 * ответственного», но выбрать человека всё равно нужно — он идёт в
 * шапку документа.
 */
export function hasResponsibleColumn(journal: PaperJournal): boolean {
  return journal.columns.some((column) => mentionsResponsible(lower(column)));
}

export function hasVerifierColumn(journal: PaperJournal): boolean {
  return journal.columns.some((column) => mentionsVerifier(lower(column)));
}

/** Подписи полей модалки — словами самого журнала. */
export function personFieldLabels(journal: PaperJournal): {
  responsible: string;
  verifier: string;
} {
  const responsible =
    journal.id.startsWith("ot_") || journal.id === "fire_safety"
      ? "Кто проводит инструктаж"
      : "Ответственный";
  return { responsible, verifier: "Кто проверяет" };
}

/** `YYYY-MM-DD` → «01.09.2026»; всё остальное — как есть. */
export function formatPaperDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

/**
 * Строка бланка для одного сотрудника. Год рождения, вид инструктажа и
 * подписи — только от руки: в модели их нет, а подпись в бумажном
 * журнале и должна быть живой.
 */
export function fillRowForStaff(
  columns: string[],
  person: PaperStaffMember,
  options: { responsible?: string; verifier?: string; dateLabel?: string } = {},
): string[] {
  return columns.map((column) => {
    if (isSignatureColumn(column)) return "";
    if (isVerifierColumn(column)) return options.verifier ?? "";
    if (isResponsibleColumn(column)) return options.responsible ?? "";
    if (isSubjectColumn(column)) return person.name;
    if (isPositionColumn(column)) return person.title;
    if (isDateColumn(column)) return options.dateLabel ?? "";
    return "";
  });
}
