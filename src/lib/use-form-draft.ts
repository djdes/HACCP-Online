"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DRAFT_SAVE_DELAY_MS, parseDraft, serializeDraft, type DraftSnapshot, type FormDraft } from "@/lib/form-draft";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Приватный режим или переполненное хранилище — черновик просто не сохранится.
  }
}

/**
 * Черновик формы журнала в localStorage.
 *
 * - `pending` — черновик, найденный при открытии; форма показывает баннер
 *   «Продолжить / Начать заново». Начал править не выбрав — баннер уходит,
 *   новая запись важнее старой.
 * - Автосохранение стартует только после `noteUserEdit()`: значения,
 *   которые форма подставляет сама, черновиком не считаются.
 * - `clear()` после отправки: убирает ключ и гасит отложенную запись,
 *   чтобы черновик не воскрес через полсекунды после сохранения.
 */
export function useFormDraft(storageKey: string | null, snapshot: DraftSnapshot) {
  const [pending, setPending] = useState<FormDraft | null>(null);
  const touchedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!storageKey) return;
    const found = parseDraft(readStorage(storageKey), new Date());
    if (found) setPending(found);
    else writeStorage(storageKey, null);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !touchedRef.current) return;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      writeStorage(storageKey, serializeDraft(snapshot, new Date()));
    }, DRAFT_SAVE_DELAY_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [storageKey, snapshot]);

  const noteUserEdit = useCallback(() => {
    touchedRef.current = true;
    setPending(null);
  }, []);

  const restore = useCallback((): FormDraft | null => {
    const found = pending;
    setPending(null);
    touchedRef.current = true;
    return found;
  }, [pending]);

  const discard = useCallback(() => {
    setPending(null);
    if (storageKey) writeStorage(storageKey, null);
  }, [storageKey]);

  const clear = useCallback(() => {
    touchedRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setPending(null);
    if (storageKey) writeStorage(storageKey, null);
  }, [storageKey]);

  return { pending, noteUserEdit, restore, discard, clear };
}
