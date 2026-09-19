"use client";

import { createContext, type ReactNode } from "react";

/**
 * «Сегодня» в часовом поясе ОРГАНИЗАЦИИ, посчитанное на сервере
 * (`orgTodayKey(organization.timezone)`), в формате `YYYY-MM-DD`.
 *
 * ПОЧЕМУ контекст: сервер проверяет «сегодняшний день» по поясу
 * организации, а браузер до сих пор считал его по часам устройства. У
 * сотрудника в другом поясе или со сбитыми часами журнал предлагал день,
 * который сервер тут же отвергал с «Заполнять можно только сегодняшний
 * день». Страница документа кладёт серверное значение сюда, а `useTodayKey`
 * его забирает; без провайдера (Mini App, старые экраны) хук работает
 * как раньше — по локальной дате браузера.
 */
export const TodayKeyContext = createContext<string>("");

export function TodayKeyProvider({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  return (
    <TodayKeyContext.Provider value={value}>{children}</TodayKeyContext.Provider>
  );
}
