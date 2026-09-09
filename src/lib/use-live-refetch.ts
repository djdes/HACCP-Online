"use client";

import { useCallback, useEffect, useRef } from "react";

import type { LiveEventType } from "@/lib/live-events";
import { liveEventMatches } from "@/lib/live-refetch-match";
import { useLiveEvents } from "@/lib/use-live-events";

/**
 * «Перечитай экран по живому событию» — общий хук для клиентских
 * экранов (доска контроля, прогресс, главная Mini App) и для
 * `<LiveRefresh>` серверных страниц.
 *
 * Тротлинг: не чаще раза в `minIntervalMs`, лишние события за окно
 * схлопываются в одно перечитывание — «Отметить всех» с телефона даёт
 * десятки записей подряд. Скрытая вкладка ничего не перечитывает, а
 * запоминает «грязно» и перечитывает один раз при возвращении.
 */
export const LIVE_REFETCH_MIN_INTERVAL_MS = 2500;

export type LiveRefetchOptions = {
  /** Какие события касаются экрана; `reconnect` — всегда. По умолчанию — журналы. */
  types?: LiveEventType[];
  /** Только эти коды журналов (страница одного журнала). */
  codes?: string[];
  minIntervalMs?: number;
  /** false — не подписываться (например, до входа в Mini App). */
  enabled?: boolean;
};

const DEFAULT_TYPES: LiveEventType[] = ["journal"];

export function useLiveRefetch(refetch: () => void, options: LiveRefetchOptions = {}): void {
  const {
    types = DEFAULT_TYPES,
    codes,
    minIntervalMs = LIVE_REFETCH_MIN_INTERVAL_MS,
    enabled = true,
  } = options;

  const fn = useRef(refetch);
  useEffect(() => {
    fn.current = refetch;
  }, [refetch]);

  const lastRun = useRef(0);
  const timer = useRef<number | null>(null);
  const dirty = useRef(false);

  const run = useCallback(() => {
    timer.current = null;
    dirty.current = false;
    lastRun.current = Date.now();
    fn.current();
  }, []);

  const schedule = useCallback(() => {
    if (document.visibilityState === "hidden") {
      dirty.current = true;
      return;
    }
    if (timer.current != null) return;
    const wait = Math.max(0, minIntervalMs - (Date.now() - lastRun.current));
    timer.current = window.setTimeout(run, wait);
  }, [minIntervalMs, run]);

  useLiveEvents(
    (event) => {
      if (liveEventMatches(event, { types, codes })) schedule();
    },
    { enabled }
  );

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible" && dirty.current) schedule();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [enabled, schedule]);
}
