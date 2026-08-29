"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DocumentBarUndo } from "@/components/journals/undo-redo-buttons";

/**
 * Канал, по которому открытый документ отдаёт своё состояние отмены в
 * ШАПКУ САЙТА.
 *
 * Кнопки «отменить / повторить» стоят наверху, рядом с «Сотрудники», —
 * там же, где остальные постоянные действия. Раньше они жили в заголовке
 * самого документа: у длинного журнала это означало, что до них надо
 * доскроллить вверх, а нужны они ровно в тот момент, когда человек уже
 * ушёл вниз по таблице и промахнулся мимо ячейки.
 *
 * Само состояние отмены живёт в клиенте документа (там история правок), а
 * шапка рендерится в layout'е выше — напрямую они не видятся. Отсюда
 * контекст: провайдер оборачивает и шапку, и содержимое страницы.
 * Приём тот же, что у хлебных крошек (`PageNavProvider`).
 */

type Slot = {
  undo: DocumentBarUndo | null;
  publish: (undo: DocumentBarUndo | null) => void;
};

const JournalUndoContext = createContext<Slot>({
  undo: null,
  publish: () => {},
});

export function JournalUndoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [undo, setUndo] = useState<DocumentBarUndo | null>(null);
  const publish = useCallback((next: DocumentBarUndo | null) => {
    setUndo(next);
  }, []);
  const value = useMemo(() => ({ undo, publish }), [undo, publish]);
  return (
    <JournalUndoContext.Provider value={value}>
      {children}
    </JournalUndoContext.Provider>
  );
}

/** Читает шапка. */
export function useHeaderUndo(): DocumentBarUndo | null {
  return useContext(JournalUndoContext).undo;
}

/**
 * Вызывает клиент документа: отдаёт свои кнопки в шапку и забирает их
 * обратно при уходе со страницы.
 *
 * Зависимости расписаны по полям, а не по объекту `undo`: клиенты
 * собирают его литералом на каждый рендер, и сравнение по ссылке
 * зациклило бы обновление.
 */
export function usePublishUndoToHeader(undo: DocumentBarUndo | null): void {
  const { publish } = useContext(JournalUndoContext);
  const canUndo = undo?.canUndo ?? false;
  const canRedo = undo?.canRedo ?? false;
  const undoCount = undo?.undoCount ?? 0;
  const onUndo = undo?.onUndo;
  const onRedo = undo?.onRedo;

  useEffect(() => {
    if (!onUndo || !onRedo) {
      publish(null);
      return;
    }
    publish({ canUndo, canRedo, undoCount, onUndo, onRedo });
    return () => publish(null);
  }, [canUndo, canRedo, undoCount, onUndo, onRedo, publish]);
}

/**
 * Компонент-обёртка над `usePublishUndoToHeader` для журналов без
 * `DocumentActionsBar`: они раньше рисовали кнопки сами, и заменить
 * элемент на элемент проще, чем поднимать хук наверх компонента.
 *
 * Ничего не рендерит. `className` принимает и игнорирует — чтобы вызовы
 * не пришлось переписывать.
 */
export function PublishUndoToHeader({
  undo,
}: {
  undo: DocumentBarUndo;
  className?: string;
}) {
  usePublishUndoToHeader(undo);
  return null;
}
