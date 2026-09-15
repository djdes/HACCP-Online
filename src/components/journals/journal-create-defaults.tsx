"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Значения по умолчанию для диалога «Создание документа» на странице
 * журнала.
 *
 * Страница журнала — это ~40 веток со своими клиентами списка документов,
 * и протаскивать проп через каждую — сорок мест, где он разъедется.
 * Поэтому страница кладёт значения один раз в контекст (внутри общей
 * обёртки `withBanner`), а диалог читает их сам.
 */
export type JournalCreateDefaults = {
  /**
   * Основной ответственный журнала из «Ответственные за журналы». Сервер
   * уже проверил, что это живой сотрудник этой организации; `null` — в
   * настройках никого нет, человек выбирает сам.
   */
  defaultResponsibleUserId: string | null;
};

const JournalCreateDefaultsContext = createContext<JournalCreateDefaults>({
  defaultResponsibleUserId: null,
});

export function JournalCreateDefaultsProvider({
  value,
  children,
}: {
  value: JournalCreateDefaults;
  children: ReactNode;
}) {
  return (
    <JournalCreateDefaultsContext.Provider value={value}>
      {children}
    </JournalCreateDefaultsContext.Provider>
  );
}

export function useJournalCreateDefaults(): JournalCreateDefaults {
  return useContext(JournalCreateDefaultsContext);
}
