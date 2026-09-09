"use client";

import { useEffect, useState } from "react";

/**
 * Standard view-toggle preference for every journal document client.
 *
 * Исторически переключатель был только мобильным: широкая ХАССП-таблица
 * на телефоне нечитаема, поэтому там по умолчанию карточки, а таблицу
 * выбирают вручную. Теперь выбор работает и на десктопе — кому-то удобнее
 * закрывать смену списком «Сегодня», чем целиться в ячейки. Дефолт при
 * этом зависит от ширины экрана: на телефоне карточки, на ПК таблица.
 *
 * The choice persists in `localStorage` under `journal-mobile-view:<code>`
 * so it survives reloads and is journal-specific (toggling hygiene
 * doesn't affect staff_training etc.).
 */
export type MobileView = "cards" | "table";

/**
 * Ось карточного режима.
 *
 *  - `today`  — плоский список сущностей за сегодня (одно касание на
 *               сотрудника / холодильник / помещение). Ежедневный сценарий.
 *  - `entity` — прежний аккордеон «сущность → все дни периода». Нужен,
 *               когда догоняют пропущенные дни.
 *
 * По умолчанию `today`: закрыть смену просят каждый день, а догонять
 * период — изредка.
 */
export type MobileAxis = "today" | "entity";

/** Tailwind `sm` — с этой ширины таблица читаема и становится дефолтом. */
export const WIDE_VIEWPORT_QUERY = "(min-width: 640px)";

/**
 * Какой вид показать, когда выбор восстановлен из localStorage.
 * Сохранённое значение всегда важнее; без него широкий экран получает
 * таблицу, узкий — `fallback` (обычно карточки). Производный дефолт
 * НЕ сохраняется: иначе телефон, открывший тот же браузер, унаследовал
 * бы таблицу.
 */
export function resolveInitialView(
  saved: string | null,
  wideViewport: boolean,
  fallback: MobileView
): MobileView {
  if (saved === "table" || saved === "cards") return saved;
  return wideViewport ? "table" : fallback;
}

/**
 * Классы обёрток карточек и таблицы.
 *
 * До восстановления выбора (SSR и первый кадр) видимость решает
 * CSS-брейкпоинт — на ПК таблица, на телефоне карточки, без мигания.
 * После — только состояние: карточки рендерит сам клиент по
 * `view === "cards"`, таблица прячется классом. Печать всегда таблица.
 *
 * На ПК карточная колонка ограничена по ширине: строка «сотрудник →
 * кнопка» на 1800px читается как две одинокие точки по краям.
 */
export function documentViewClasses(view: MobileView, resolved: boolean) {
  return {
    cards: resolved ? "sm:max-w-[760px] print:hidden" : "sm:hidden print:hidden",
    table:
      view === "cards"
        ? resolved
          ? "hidden print:block"
          : "hidden sm:block print:block"
        : "",
  } as const;
}

export function useMobileView(journalCode: string, defaultView: MobileView = "cards") {
  const [mobileView, setMobileView] = useState<MobileView>(defaultView);
  const [mobileAxis, setMobileAxis] = useState<MobileAxis>("today");
  const [viewResolved, setViewResolved] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect --
     Восстановление после гидрации: SSR не знает ни localStorage, ни
     ширину экрана, поэтому синхронный setState здесь неизбежен. */
  useEffect(() => {
    let saved: string | null = null;
    let wide = false;
    try {
      saved = window.localStorage.getItem(`journal-mobile-view:${journalCode}`);
      const savedAxis = window.localStorage.getItem(
        `journal-mobile-axis:${journalCode}`
      );
      if (savedAxis === "today" || savedAxis === "entity") {
        setMobileAxis(savedAxis);
      }
    } catch {
      /* localStorage blocked — keep the default */
    }
    try {
      wide = window.matchMedia(WIDE_VIEWPORT_QUERY).matches;
    } catch {
      /* matchMedia missing (старый WebView) — считаем узким */
    }
    setMobileView(resolveInitialView(saved, wide, defaultView));
    setViewResolved(true);
  }, [journalCode, defaultView]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function switchMobileView(next: MobileView) {
    setMobileView(next);
    try {
      window.localStorage.setItem(`journal-mobile-view:${journalCode}`, next);
    } catch {
      /* ignore */
    }
  }

  function switchMobileAxis(next: MobileAxis) {
    setMobileAxis(next);
    try {
      window.localStorage.setItem(`journal-mobile-axis:${journalCode}`, next);
    } catch {
      /* ignore */
    }
  }

  return {
    mobileView,
    switchMobileView,
    mobileAxis,
    switchMobileAxis,
    viewResolved,
  } as const;
}
