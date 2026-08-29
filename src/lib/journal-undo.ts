"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

export const DEFAULT_UNDO_DEPTH = 20;

/** Чем закончился проигрыш шага — хук по этому решает, показывать ли тост. */
export type UndoRunResult =
  | { status: "empty" }
  | { status: "busy" }
  | { status: "done" }
  | { status: "failed"; error: unknown };

export type UndoStackCore = {
  push: (step: UndoStep) => void;
  run: (direction: "undo" | "redo") => Promise<UndoRunResult>;
  reset: () => void;
  sizes: () => { undo: number; redo: number };
  isBusy: () => boolean;
};

/**
 * Чистое ядро истории — без React и без DOM.
 *
 * Вынесено из хука ровно ради тестируемости: поведение стека (глубина,
 * вытеснение старого, обрыв ветки redo, выброс упавшего шага) можно
 * проверить обычным `node --test`, не поднимая jsdom.
 */
export function createUndoStack(options?: { depth?: number }): UndoStackCore {
  const depth = Math.max(1, options?.depth ?? DEFAULT_UNDO_DEPTH);
  const undoSteps: UndoStep[] = [];
  const redoSteps: UndoStep[] = [];
  let busy = false;

  return {
    push(step: UndoStep) {
      undoSteps.push(step);
      // Глубина 20: лишнее вытесняется с хвоста (самое старое).
      if (undoSteps.length > depth) undoSteps.shift();
      // Новая правка обрывает ветку redo — как в любом редакторе.
      redoSteps.length = 0;
    },

    /**
     * Шаг снимается со стека ДО вызова: упал (403 «прошлые дни
     * закрыты») — обратно не кладём, иначе Ctrl+Z будет бесконечно
     * упираться в один и тот же протухший шаг.
     */
    async run(direction) {
      if (busy) return { status: "busy" };
      const from = direction === "undo" ? undoSteps : redoSteps;
      const to = direction === "undo" ? redoSteps : undoSteps;
      const step = from.pop();
      if (!step) return { status: "empty" };

      busy = true;
      try {
        await (direction === "undo" ? step.undo() : step.redo());
        to.push(step);
        if (to.length > depth) to.shift();
        return { status: "done" };
      } catch (error) {
        return { status: "failed", error };
      } finally {
        busy = false;
      }
    },

    reset() {
      undoSteps.length = 0;
      redoSteps.length = 0;
    },

    sizes() {
      return { undo: undoSteps.length, redo: redoSteps.length };
    },

    isBusy() {
      return busy;
    },
  };
}

/**
 * Хоткей игнорируем, когда человек печатает в поле (там своя нативная
 * отмена) и когда открыт модальный диалог — иначе Ctrl+Z «сквозь»
 * модалку молча меняет данные под ней.
 */
function shouldIgnoreHotkey(): boolean {
  if (typeof document === "undefined") return true;
  // Модалка сверху — Ctrl+Z принадлежит ей, а не журналу под ней.
  if (document.querySelector('[role="dialog"]')) return true;

  const active = document.activeElement as HTMLElement | null;
  if (!active) return false;

  // Настоящий набор текста: отменять надо буквы, а не отметку в журнале.
  if (active.isContentEditable || active.tagName === "TEXTAREA") return true;

  if (active.tagName === "INPUT" || active.tagName === "SELECT") {
    // Ячейка журнала — это input ВНУТРИ таблицы. Раньше здесь стоял
    // безусловный выход, и получалось, что горячая клавиша не работала
    // нигде: в журнале фокус всегда в какой-нибудь ячейке, других мест
    // просто нет. Человек ставил отметку, жал Ctrl+Z — и ничего.
    //
    // Поля вне таблицы (поиск, название документа) по-прежнему отдаём
    // браузеру: там Ctrl+Z ожидаемо отменяет набранный текст.
    return !active.closest("table");
  }

  return false;
}

export function useJournalUndo(opts?: {
  depth?: number;
  /** Журнал закрыт / нет прав — хоткеи и кнопки выключены. */
  enabled?: boolean;
}): JournalUndoApi {
  const depth = opts?.depth ?? DEFAULT_UNDO_DEPTH;
  const enabled = opts?.enabled !== false;

  // Ядро живёт в ref: пересоздавать его на ререндере нельзя, иначе
  // история обнулялась бы после каждой правки.
  const coreRef = useRef<UndoStackCore | null>(null);
  if (coreRef.current === null) coreRef.current = createUndoStack({ depth });
  const core = coreRef.current;

  // Счётчики в state — только чтобы кнопки в шапке перерисовались.
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const [busy, setBusy] = useState(false);

  const sync = useCallback(() => setCounts(core.sizes()), [core]);

  const push = useCallback(
    (step: UndoStep) => {
      core.push(step);
      sync();
    },
    [core, sync]
  );

  const reset = useCallback(() => {
    core.reset();
    sync();
  }, [core, sync]);

  const run = useCallback(
    async (direction: "undo" | "redo") => {
      if (!enabled) return;
      setBusy(true);
      // Синхронизируем до и после: шаг снимается со стека сразу, и
      // кнопка должна погаснуть, не дожидаясь ответа сервера.
      const promise = core.run(direction);
      sync();
      const result = await promise;
      setBusy(false);
      sync();
      if (result.status === "failed") {
        toast.error(
          result.error instanceof Error
            ? result.error.message
            : "Не удалось отменить"
        );
      }
    },
    [core, enabled, sync]
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

  return useMemo(
    () => ({
      push,
      undo,
      redo,
      reset,
      canUndo: enabled && counts.undo > 0,
      canRedo: enabled && counts.redo > 0,
      undoCount: counts.undo,
      redoCount: counts.redo,
      busy,
    }),
    [busy, counts.redo, counts.undo, enabled, push, redo, reset, undo]
  );
}
