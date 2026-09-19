"use client";

import { useCallback, useContext, useSyncExternalStore } from "react";

import { TodayKeyContext } from "@/lib/today-key-context";

/**
 * «Сегодня» в ЛОКАЛЬНОЙ зоне браузера в формате `YYYY-MM-DD`.
 *
 * ПОЧЕМУ не `toISOString().slice(0, 10)`: `toISOString()` — это UTC.
 * Для Москвы (UTC+3) с 00:00 до 03:00 UTC-дата ещё вчерашняя, и
 * подсветка «сегодня» в гридах журналов целилась не в тот день.
 */
export function localTodayKey(now: Date = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Значение не меняется само по себе — подписываться не на что. */
function subscribeToNothing() {
  return () => {};
}

/**
 * Ключ «сегодня» для клиентских компонентов журналов.
 *
 * ПОЧЕМУ хук, а не `new Date()` прямо в рендере:
 *  1. Рендер обязан быть чистым (react-hooks/purity) — `new Date()`
 *     возвращает разное значение на сервере и в браузере, React ловит
 *     это как «A tree hydrated but some attributes didn't match».
 *  2. Сервер считает дату в своей зоне (на проде — UTC), браузер — в
 *     зоне пользователя. До 03:00 МСК это РАЗНЫЕ дни.
 *
 * `useSyncExternalStore` — штатный для React способ отдать одно значение
 * при SSR/гидрации и другое после неё, без setState в эффекте.
 *
 * Приоритет источников:
 *  1. `serverTodayKey` (проп с сервера);
 *  2. `TodayKeyContext` — то же значение, но через контекст страницы
 *     документа, чтобы его не приходилось протаскивать пропом через все
 *     журналы;
 *  3. локальная дата браузера — когда серверного значения нет вообще.
 *
 * ПОЧЕМУ серверное значение побеждает и ПОСЛЕ гидрации: «сегодня» на
 * сервере считается в поясе ОРГАНИЗАЦИИ (`orgTodayKey`), и именно с ним
 * сверяются проверки «заполнять можно только сегодняшний день». Часы
 * устройства сотрудника к делу не относятся.
 */
export function useTodayKey(serverTodayKey = ""): string {
  const contextTodayKey = useContext(TodayKeyContext);
  const orgTodayKey = serverTodayKey || contextTodayKey;
  const getServerSnapshot = useCallback(() => orgTodayKey, [orgTodayKey]);
  const getSnapshot = useCallback(
    // Строка сравнивается по значению, поэтому пересчёт на каждый рендер
    // не вызывает бесконечного цикла.
    () => orgTodayKey || localTodayKey(),
    [orgTodayKey],
  );
  return useSyncExternalStore(
    subscribeToNothing,
    getSnapshot,
    getServerSnapshot,
  );
}
