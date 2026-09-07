"use client";

import { useEffect, useState } from "react";

/**
 * Standard mobile-view toggle preference for every journal document client.
 * `"cards"` is the default on fresh load — a 1100+-px-wide HACCP table is
 * unreadable on a 334-px phone without horizontal scroll, so we collapse
 * it into a vertical list and expose a `<MobileViewToggle>` switcher so
 * power users can opt back into the full table.
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

export function useMobileView(journalCode: string, defaultView: MobileView = "cards") {
  const [mobileView, setMobileView] = useState<MobileView>(defaultView);
  const [mobileAxis, setMobileAxis] = useState<MobileAxis>("today");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`journal-mobile-view:${journalCode}`);
      if (saved === "table" || saved === "cards") setMobileView(saved);
      const savedAxis = window.localStorage.getItem(
        `journal-mobile-axis:${journalCode}`
      );
      if (savedAxis === "today" || savedAxis === "entity") {
        setMobileAxis(savedAxis);
      }
    } catch {
      /* localStorage blocked — keep the default */
    }
  }, [journalCode]);

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

  return { mobileView, switchMobileView, mobileAxis, switchMobileAxis } as const;
}
