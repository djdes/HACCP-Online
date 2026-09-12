"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { useNetwork } from "../_hooks/use-network";
import {
  flushJournalQueue,
  listOwnQueuedEntries,
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
  // Записи отправляются только своим автором — см. `journal-queue.ts`.
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const [pending, setPending] = useState(0);
  const [justSent, setJustSent] = useState(0);
  const flushing = useRef(false);
  // Портал в body есть только на клиенте; до монтирования — ничего.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const refresh = useCallback(async () => {
    // Считаем только свои: иначе повар видел бы «ждёт отправки: 3», где
    // все три — записи сменщика, и решил бы, что его работа не ушла.
    const rows = await listOwnQueuedEntries(userId).catch(() => []);
    setPending(rows.length);
  }, [userId]);

  const flush = useCallback(async () => {
    // Один проход за раз: параллельные отправки одной записи упёрлись бы
    // в 409 «уже сохраняется» и только отложили бы её.
    if (flushing.current) return;
    flushing.current = true;
    try {
      const result: FlushResult = await flushJournalQueue(userId);
      // `result.pending` — это вся очередь, включая записи сменщика.
      // На экране показываем только свои, поэтому пересчитываем.
      await refresh();
      if (result.sent > 0) {
        setJustSent(result.sent);
        setTimeout(() => setJustSent(0), 4000);
      }
    } finally {
      flushing.current = false;
    }
  }, [userId, refresh]);

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

  useEffect(() => {
    // Возврат в приложение — самый частый момент, когда связь уже есть, а
    // событие `online` было пропущено: вкладка спала. Фоновой отправки на
    // iOS не существует (Background Sync там не поддерживается), поэтому
    // очередь уходит ровно тогда, когда человек открыл приложение, — и
    // ждать до тридцати секунд таймера незачем.
    //
    // `pageshow` нужен отдельно от `visibilitychange`: возврат «назад» из
    // кеша страниц Safari не меняет видимость.
    const onWake = () => {
      if (document.visibilityState === "visible") void flush();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("pageshow", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, [flush]);

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
  // Полоса — ссылка на «Что не ушло», пока есть что показывать. Раньше
  // она сообщала число и молчала: какие записи, почему не ушли и можно
  // ли повторить — узнать было негде.
  const body =
    pending > 0 ? (
      <Link
        href="/mini/outbox"
        role="status"
        className={`fixed left-1/2 top-2 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-1.5 text-center text-[12px] font-medium text-white shadow-lg transition-all ${tone}`}
        style={{ zIndex: "var(--mini-z-overlay)" }}
      >
        {text}
      </Link>
    ) : (
      <div
        role="status"
        className={`fixed left-1/2 top-2 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-1.5 text-center text-[12px] font-medium text-white shadow-lg transition-all ${tone}`}
        style={{ zIndex: "var(--mini-z-overlay)" }}
      >
        {text}
      </div>
    );

  return createPortal(
    body,
    document.body
  );
}
