"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Отмена правок в сетке журнала (Ctrl+Z / Ctrl+Shift+Z).
 *
 * Почему стек клиентский, а не серверная история версий. Undo здесь —
 * это «ой, не туда нажал» в текущей сессии. Сам откат применяется тем
 * же обычным запросом записи, что и правка, поэтому все серверные
 * запреты (закрытый день, ACL, автоматика) продолжают действовать: если
 * ночь прошла и день закрылся, сервер ответит 403, шаг вылетит из
 * истории, а пользователь увидит тост. Серверную историю мы осознанно
 * не делаем — это отдельная задача про версии записей.
 *
 * Важно: в историю кладём ТОЛЬКО действия пользователя. Автозаполнение
 * (крон проставил «Зд.» всем) сюда не попадает — иначе Ctrl+Z отменял
 * бы чужую работу.
 */
export type UndoStep = {
  /** Человеческое описание шага — для подсказки на кнопке. */
  label?: string;
  /** Вернуть предыдущее значение (для покраски — весь штрих разом). */
  undo: () => Promise<void>;
  /** Повторить отменённое. */
  redo: () => Promise<void>;
};

export type JournalUndoApi = {
  push: (step: UndoStep) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  reset: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
  busy: boolean;
};

const DEFAULT_DEPTH = 20;

/**
 * Хоткей игнорируем, когда человек печатает в поле (там своя нативная
 * отмена) и когда открыт модальный диалог — иначе Ctrl+Z «сквозь»
 * модалку молча меняет данные под ней.
 */
function shouldIgnoreHotkey(): boolean {
  if (typeof document === "undefined") return true;
  const active = document.activeElement as HTMLElement | null;
  if (active) {
    const tag = active.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      active.isContentEditable
    ) {
      return true;
    }
  }
  return Boolean(document.querySelector('[role="dialog"]'));
}

export function useJournalUndo(opts?: {
  depth?: number;
  /** Журнал закрыт / нет прав — хоткеи и кнопки выключены. */
  enabled?: boolean;
}): JournalUndoApi {
  const depth = opts?.depth ?? DEFAULT_DEPTH;
  const enabled = opts?.enabled !== false;

  const undoRef = useRef<UndoStep[]>([]);
  const redoRef = useRef<UndoStep[]>([]);
  const busyRef = useRef(false);
  // Счётчики в state — только чтобы кнопки в шапке перерисовались.
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => {
    setCounts({ undo: undoRef.current.length, redo: redoRef.current.length });
  }, []);

  const push = useCallback(
    (step: UndoStep) => {
      undoRef.current.push(step);
      // Глубина 20: лишнее вытесняется с хвоста (самое старое).
      if (undoRef.current.length > depth) undoRef.current.shift();
      // Новая правка обрывает ветку redo — как в любом редакторе.
      redoRef.current = [];
      sync();
    },
    [depth, sync]
  );

  const reset = useCallback(() => {
    undoRef.current = [];
    redoRef.current = [];
    sync();
  }, [sync]);

  /**
   * Общий проигрыватель для undo и redo. Шаг снимается со стека ДО
   * вызова: упал (403 «прошлые дни закрыты») — обратно не кладём,
   * иначе Ctrl+Z будет бесконечно упираться в один и тот же шаг.
   */
  const run = useCallback(
    async (direction: "undo" | "redo") => {
      if (!enabled || busyRef.current) return;
      const from = direction === "undo" ? undoRef.current : redoRef.current;
      const to = direction === "undo" ? redoRef.current : undoRef.current;
      const step = from.pop();
      if (!step) return;
      sync();

      busyRef.current = true;
      setBusy(true);
      try {
        await (direction === "undo" ? step.undo() : step.redo());
        to.push(step);
        if (to.length > depth) to.shift();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Не удалось отменить"
        );
      } finally {
        busyRef.current = false;
        setBusy(false);
        sync();
      }
    },
    [depth, enabled, sync]
  );

  const undo = useCallback(() => run("undo"), [run]);
  const redo = useCallback(() => run("redo"), [run]);

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      if (shouldIgnoreHotkey()) return;
      event.preventDefault();
      if (key === "y" || event.shiftKey) {
        void redo();
      } else {
        void undo();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled, redo, undo]);

  return {
    push,
    undo,
    redo,
    reset,
    canUndo: enabled && counts.undo > 0,
    canRedo: enabled && counts.redo > 0,
    undoCount: counts.undo,
    redoCount: counts.redo,
    busy,
  };
}
