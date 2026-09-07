"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Ячейка «бумажной» таблицы журнала, в которой текст ПЕРЕНОСИТСЯ.
 *
 * Зачем (2026-09-07, жалоба владельца с телефона):
 * значения журналов лежали в однострочных `<input>` внутри колонок
 * фиксированной процентной ширины (`table-fixed` + `colgroup`). На
 * телефоне полотно таблицы 1000-1200px, колонка «Дата, время
 * фактической реализации» получалась ~90px — и «2026-09-09 18:00»,
 * «Соответствует», «+2 °C до +6 °C» просто обрезались. Видно было
 * «Не соответ», «+2°C до +6», «2026-09»: короткое значение и то не
 * помещалось, а чтобы дочитать длинное — приходилось долго скроллить
 * вбок.
 *
 * Решение: `<textarea>`, который сам подстраивает высоту под
 * содержимое. Текст уходит на вторую-третью строку внутри той же
 * колонки — ничего не обрезается, а горизонтальный скролл не растёт.
 *
 * Почему не `field-sizing: content` (одна строка CSS): Safari его до
 * сих пор не поддерживает, а основной сценарий жалобы — именно iPhone.
 *
 * Поведение сделано «как у input», чтобы замена в клиентах была
 * механической:
 *   • Enter не вставляет перенос, а завершает правку (blur → autosave);
 *     Shift+Enter даёт настоящий перенос строки, где он нужен;
 *   • высота стартует с одной строки (`h-7` прежнего инпута) и растёт;
 *   • собственного скролла нет — `overflow-hidden`.
 */
export const JOURNAL_CELL_INPUT_CLASS =
  "block w-full resize-none overflow-hidden rounded-md border-0 bg-transparent px-1.5 py-[5px] text-[12.5px] leading-[1.35] text-[#0b1024] shadow-none outline-none transition-[background-color,box-shadow] duration-150 placeholder:text-[#9b9fb3] focus-visible:bg-[#f5f6ff] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 disabled:cursor-not-allowed disabled:opacity-60";

/** Минимальная высота = высота прежней однострочной ячейки (`h-7`). */
const MIN_HEIGHT_PX = 28;

export type JournalCellInputProps = Omit<
  React.ComponentProps<"textarea">,
  "rows"
> & {
  /** Разрешить настоящий перенос по Enter (примечания, описания). */
  multiline?: boolean;
  /**
   * id `<datalist>` с подсказками (изделия, сотрудники).
   *
   * `<textarea>` атрибут `list` не поддерживает, поэтому такая ячейка
   * ПОКАЗЫВАЕТ значение переносящимся textarea, а на время правки
   * подменяется настоящим `<input list>`. Так и подсказки на месте, и
   * ФИО целиком видно, когда его просто читают.
   */
  list?: string;
};

export function JournalCellInput({
  className,
  value,
  multiline = false,
  onKeyDown,
  onFocus,
  onBlur,
  onInput,
  list,
  ...props
}: JournalCellInputProps) {
  const ref = React.useRef<HTMLTextAreaElement | null>(null);
  // Правка ячейки со справочником идёт в подменённом <input list>.
  const [editingWithList, setEditingWithList] = React.useState(false);

  const resize = React.useCallback(() => {
    const el = ref.current;
    // Скрытый элемент мерить нельзя: scrollHeight = 0, и высота
    // схлопнулась бы в одну строку насовсем.
    if (!el || el.clientWidth === 0) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(MIN_HEIGHT_PX, el.scrollHeight)}px`;
  }, []);

  // Высота пересчитывается при внешней смене value (копирование
  // вчерашнего дня, отмена, приход данных с сервера). Ввод покрыт
  // `onInput` — он же обслуживает неуправляемые ячейки (`defaultValue`),
  // у которых `value` не меняется вовсе.
  React.useLayoutEffect(resize, [resize, value, editingWithList]);

  // На телефоне таблица стартует СКРЫТОЙ за вкладкой «Карточки», и на
  // момент монтирования ячейка имеет нулевой размер. Без наблюдателя
  // строки оставались в одну строку — ровно та обрезка, от которой
  // избавляемся. ResizeObserver ловит и появление таблицы, и смену
  // ширины колонки (поворот экрана).
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = el.clientWidth;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      // Изменилась только высота — это наша же правка, не реагируем,
      // иначе наблюдатель зациклится сам на себе.
      if (width === lastWidth) return;
      lastWidth = width;
      resize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [resize]);

  if (list && editingWithList) {
    // Правка ячейки со справочником: настоящий <input list>, потому что
    // подсказки из <datalist> textarea не поддерживает. Читается
    // значение всё равно в textarea ниже — целиком, с переносом.
    return (
      <input
        {...(props as React.ComponentProps<"input">)}
        list={list}
        value={value as string | undefined}
        autoFocus
        spellCheck={false}
        onInput={onInput as React.FormEventHandler<HTMLInputElement> | undefined}
        onKeyDown={(event) => {
          (onKeyDown as React.KeyboardEventHandler<HTMLInputElement> | undefined)?.(
            event,
          );
          if (event.defaultPrevented) return;
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        onBlur={(event) => {
          setEditingWithList(false);
          (onBlur as React.FocusEventHandler<HTMLInputElement> | undefined)?.(event);
        }}
        className={cn(
          JOURNAL_CELL_INPUT_CLASS,
          "h-7 whitespace-nowrap",
          className,
        )}
      />
    );
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      spellCheck={false}
      // Якорь для мобильного правила в globals.css: в покое ячейка
      // держит размер бланка (12.5px), при правке вырастает до 16px,
      // чтобы iOS Safari не зумил страницу.
      data-journal-cell=""
      // На телефоне размер шрифта меняется по :focus (см. globals.css),
      // а вместе с ним и число строк — высоту пересчитываем на обоих
      // концах, иначе ячейка на время правки обрезает последнюю строку.
      onFocus={(event) => {
        onFocus?.(event);
        if (list) {
          setEditingWithList(true);
          return;
        }
        resize();
      }}
      onBlur={(event) => {
        onBlur?.(event);
        resize();
      }}
      onInput={(event) => {
        onInput?.(event);
        resize();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key === "Enter" && !event.shiftKey && !multiline) {
          // Ячейка бланка ведёт себя как input: Enter = «записал».
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className={cn(JOURNAL_CELL_INPUT_CLASS, className)}
      style={{ minHeight: MIN_HEIGHT_PX }}
      {...props}
    />
  );
}
