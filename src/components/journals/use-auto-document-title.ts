"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildDocumentAutoTitle } from "@/lib/journal-document-title";

export type AutoTitlePeriod = {
  dateFrom?: string | null;
  dateTo?: string | null;
  year?: string | number | null;
};

/**
 * Автоназвание документа для диалогов создания — общий паттерн из
 * `create-document-dialog.tsx`: название собирается из имени журнала и
 * периода (`buildDocumentAutoTitle`), пересчитывается при смене даты/года,
 * но только пока человек не правил поле руками. Правил — значит знает
 * лучше.
 *
 * Без `useEffect` намеренно: эффект перетирал бы ручную правку на любом
 * ре-рендере. Диалог зовёт хук в трёх точках:
 *   - `seedTitle()` при открытии в режиме создания (и `reset()`);
 *   - `markTouched()` в onChange поля «Название документа»;
 *   - `titleForPeriod(next)` в onChange даты/года — вернёт новое название
 *     или `null`, если подставлять уже нельзя.
 *
 * `enabled=false` (редактирование) — хук молчит.
 */
export function useAutoDocumentTitle(opts: {
  templateCode: string;
  journalName: string;
  period: AutoTitlePeriod;
  enabled: boolean;
  existingTitles?: Iterable<string>;
}) {
  // Актуальные опции держим в ref и синхронизируем эффектом (не в рендере —
  // react-hooks/refs), чтобы колбэки были стабильными: диалоги кладут их в
  // deps своих эффектов, и новая идентичность на каждый рендер сбрасывала
  // бы форму на каждое нажатие клавиши.
  const latest = useRef(opts);
  useEffect(() => {
    latest.current = opts;
  });
  const touched = useRef(false);

  const compute = useCallback((period?: AutoTitlePeriod) => {
    const current = latest.current;
    return buildDocumentAutoTitle({
      templateCode: current.templateCode,
      journalName: current.journalName,
      ...(period ?? current.period),
      existingTitles: current.existingTitles,
    });
  }, []);

  const seedTitle = useCallback(
    () => (latest.current.enabled ? compute() : ""),
    [compute]
  );
  const reset = useCallback(() => {
    touched.current = false;
  }, []);
  const markTouched = useCallback(() => {
    touched.current = true;
  }, []);
  const titleForPeriod = useCallback(
    (period: AutoTitlePeriod): string | null =>
      latest.current.enabled && !touched.current ? compute(period) : null,
    [compute]
  );

  return { seedTitle, reset, markTouched, titleForPeriod };
}
