"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useNetwork } from "../_hooks/use-network";
import {
  flushJournalQueue,
  listQueuedEntries,
  type FlushResult,
} from "../_lib/journal-queue";

/**
 * Полоса состояния отправки вверху экрана.
 *
 * Показывает ровно то, что происходит, и ничего сверх. Раньше здесь было
 * «действия сохранятся и отправятся позже» — неправда: очередь
 * существовала, но в неё никто ничего не клал. Человек, поверив надписи,
 * закрывал вкладку и терял заполненное.
 *
 * Теперь очередь настоящая (`_lib/journal-queue.ts`), и полоса —
 * единственное место, где видно, что запись ещё не у сервера.
 */
export function OfflineIndicator() {
  const isOnline = useNetwork();
  const [pending, setPending] = useState(0);
  const [justSent, setJustSent] = useState(0);
  const flushing = useRef(false);
  // Портал в body есть только на клиенте; до монтирования — ничего.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    const rows = await listQueuedEntries().catch(() => []);
    setPending(rows.length);
  }, []);

  const flush = useCallback(async () => {
    // Один проход за раз: параллельные отправки одной записи упёрлись бы
    // в 409 «уже сохраняется» и только отложили бы её.
    if (flushing.current) return;
    flushing.current = true;
    try {
      const result: FlushResult = await flushJournalQueue();
      setPending(result.pending);
      if (result.sent > 0) {
        setJustSent(result.sent);
        setTimeout(() => setJustSent(0), 4000);
      }
    } finally {
      flushing.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!isOnline) return;
    void flush();
  }, [isOnline, flush]);

  useEffect(() => {
    if (!isOnline || pending === 0) return;
    // Связь может «быть» по мнению браузера и при этом не работать —
    // например, wifi в подвале без выхода наружу. Поэтому не только по
    // событию online, но и по таймеру, пока очередь не пуста.
    const id = setInterval(() => void flush(), 30_000);
    return () => clearInterval(id);
  }, [isOnline, pending, flush]);

  const visible = !isOnline || pending > 0 || justSent > 0;
  if (!visible || !mounted) return null;

  const tone = !isOnline
    ? "bg-amber-500"
    : pending > 0
      ? "bg-[#5566f6]"
      : "bg-emerald-500";

  const text = !isOnline
    ? pending > 0
      ? `Нет связи. Записей ждёт отправки: ${pending}`
      : "Нет связи. Заполнять можно — отправится, когда связь вернётся"
    : pending > 0
      ? `Отправляем записи: ${pending}`
      : `Отправлено: ${justSent}`;

  // В body, а не в .mini-root: правило `.mini-root > *` в mini-theme.css
  // делает прямых детей position: relative, и «fixed» полоса уезжала в
  // конец потока — на длинной странице её не было видно вовсе.
  return createPortal(
    <div
      role="status"
      className={`fixed left-1/2 top-2 z-[60] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-1.5 text-center text-[12px] font-medium text-white shadow-lg transition-all ${tone}`}
    >
      {text}
    </div>,
    document.body
  );
}
