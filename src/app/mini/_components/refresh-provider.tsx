"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { PullToRefresh } from "./pull-to-refresh";

/**
 * «Потянуть, чтобы обновить» — на всех экранах Mini App.
 *
 * Жест был написан и работал ровно на одном экране из девятнадцати.
 * Для человека это хуже, чем если бы его не было вовсе: на главной
 * тянешь — обновляется, на списке записей тянешь — не происходит
 * ничего, и непонятно, сломано приложение или данные и правда свежие.
 *
 * Экран сообщает, чем именно обновляться, через
 * {@link useRegisterRefresh}. Кто не сообщил — получает перезапрос
 * серверных данных маршрута, то есть жест работает везде с первого дня.
 */

type RefreshFn = () => Promise<void> | void;

type RefreshContextValue = {
  register: (fn: RefreshFn) => void;
  unregister: (fn: RefreshFn) => void;
};

const RefreshContext = createContext<RefreshContextValue | null>(null);

export function RefreshProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const handler = useRef<RefreshFn | null>(null);

  const register = useCallback((fn: RefreshFn) => {
    handler.current = fn;
  }, []);

  // Снимаем только СВОЙ обработчик. При переходе между экранами эффект
  // нового успевает выполниться раньше уборки старого, и безусловное
  // обнуление стирало бы уже установленный обработчик новой страницы.
  const unregister = useCallback((fn: RefreshFn) => {
    if (handler.current === fn) handler.current = null;
  }, []);

  const onRefresh = useCallback(async () => {
    const own = handler.current;
    if (own) {
      await own();
      return;
    }
    router.refresh();
    // `router.refresh()` не возвращает обещание. Без этой паузы
    // индикатор гаснет через кадр, и жест выглядит как «не сработал».
    await new Promise((resolve) => setTimeout(resolve, 450));
  }, [router]);

  return (
    <RefreshContext.Provider value={{ register, unregister }}>
      <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>
    </RefreshContext.Provider>
  );
}

/**
 * Сказать, чем обновляется этот экран.
 *
 * Функцию можно передавать новую на каждый рендер — подписка от этого
 * не пересоздаётся.
 */
export function useRegisterRefresh(fn: RefreshFn): void {
  const ctx = useContext(RefreshContext);
  const latest = useRef(fn);

  useEffect(() => {
    latest.current = fn;
  }, [fn]);

  useEffect(() => {
    if (!ctx) return;
    const stable: RefreshFn = () => latest.current();
    ctx.register(stable);
    return () => ctx.unregister(stable);
  }, [ctx]);
}
