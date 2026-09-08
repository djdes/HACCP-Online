/**
 * Возвращать ли человека на главную, когда он снова открыл приложение.
 *
 * Установленное приложение продолжает с той страницы, где его закрыли.
 * Внутри смены это удобно: отвлёкся на звонок, вернулся — всё на месте.
 * А вот открыть утром приложение и увидеть вчерашний список сотрудников
 * вместо задач на сегодня — сбивает с толку.
 *
 * Поэтому правило зависит от того, сколько приложение было закрыто, и
 * ЖЁСТКО уступает несохранённой работе. Цена ошибки несимметрична:
 * лишний раз оставить человека на прежнем экране — мелкое неудобство,
 * а увести его с наполовину заполненного журнала — потеря работы,
 * которую он уже сделал.
 */

/** Меньше этого считаем «отвлёкся», а не «пришёл в новую смену». */
export const RESUME_HOME_AFTER_MS = 30 * 60 * 1000;

/**
 * Экраны, где может лежать несохранённое, даже когда все поля ввода
 * пусты: приложенное фото, выбранная строка, начатая приёмка. Отсюда не
 * уводим никогда, сколько бы приложение ни было закрыто.
 */
const KEEPS_UNSAVED_WORK = [
  "/mini/journals/", // формы записи и «заполнить как вчера»
  "/mini/documents/", // сетка документа с правкой клеток
  "/mini/claim/", // взятая задача
  "/mini/bonus/", // отправка бонуса
  "/mini/shift-handover", // передача смены
];

export type ResumeContext = {
  /** Сколько миллисекунд приложение было скрыто. */
  hiddenMs: number;
  pathname: string;
  /** Есть ли на странице заполненное поле ввода. */
  hasDirtyInput: boolean;
};

export function shouldReturnHome(ctx: ResumeContext): boolean {
  // Уже дома — нечего делать.
  if (ctx.pathname === "/mini") return false;

  // Набранное важнее любой навигации.
  if (ctx.hasDirtyInput) return false;
  if (KEEPS_UNSAVED_WORK.some((prefix) => ctx.pathname.startsWith(prefix))) {
    return false;
  }

  return ctx.hiddenMs >= RESUME_HOME_AFTER_MS;
}

/**
 * Есть ли на странице что-то набранное. Чекбоксы и переключатели не
 * считаем: они почти всегда имеют значение, и по ним мы бы решили, что
 * работа идёт, на любой странице со списком.
 */
export function pageHasDirtyInput(root: ParentNode): boolean {
  const fields = root.querySelectorAll<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >("input, textarea, select");

  for (const field of fields) {
    if (field instanceof HTMLInputElement) {
      const type = field.type.toLowerCase();
      if (type === "checkbox" || type === "radio" || type === "hidden") continue;
      if (type === "file" && field.files && field.files.length > 0) return true;
    }
    if (field.value && field.value.trim() !== "") return true;
  }
  return false;
}
