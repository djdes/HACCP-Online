"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  playIncomingChirp,
  primeNotificationSound,
} from "@/lib/notification-sound";
import { SUPPORT_CHAT_READ_EVENT } from "@/lib/support-chat-bus";
import { shouldAlert, type SupportStatus } from "@/lib/support-threads-shared";

/**
 * Фоновый опрос «пришёл ли ответ»: один хук на виджет поддержки, на
 * гостевой виджет лендинга и на партнёрский кабинет.
 *
 * Правила сигнала:
 *  - звук — на каждую новую реплику собеседника, один раз на устройство
 *    (id последней озвученной реплики лежит в localStorage; вкладки
 *    делят его, поэтому две вкладки не «у-оу»-кают дуэтом);
 *  - всплывашка — только если переписка сейчас не перед глазами
 *    (панель закрыта или вкладка в фоне);
 *  - бейдж — пока сервер считает, что непрочитанное есть.
 *
 * Опрос дешёвый (два индексированных чтения), но в фоне реже: браузер
 * всё равно душит таймеры скрытых вкладок.
 */

const POLL_VISIBLE_MS = 25_000;
const POLL_HIDDEN_MS = 60_000;
const MAX_BACKOFF_MS = 120_000;
const POPUP_TTL_MS = 12_000;

const memoryAlerted = new Map<string, string>();

function alertKey(scope: string) {
  return `wesetup.support.alerted:${scope}`;
}

function readAlerted(scope: string): string | null {
  try {
    return window.localStorage.getItem(alertKey(scope));
  } catch {
    return memoryAlerted.get(scope) ?? null;
  }
}

function writeAlerted(scope: string, id: string) {
  memoryAlerted.set(scope, id);
  try {
    window.localStorage.setItem(alertKey(scope), id);
  } catch {
    /* приватный режим — хватит памяти вкладки */
  }
}

export type IncomingPopup = {
  id: string;
  /** Ветка, о которой сигналим: партнёрскому кабинету нужна для перехода. */
  threadId: string | null;
  title: string;
  preview: string;
  createdAt: string;
};

export function useIncomingMessages(opts: {
  enabled: boolean;
  statusUrl: string | null;
  /** Суффикс ключа «уже сигналили»: "org", "guest:<id>", "partner". */
  scope: string;
  /** Переписка открыта перед глазами — всплывашку не показываем. */
  chatVisible: boolean;
  /** Заголовок всплывашки по статусу (кто написал). */
  title: (status: SupportStatus) => string;
}) {
  const { enabled, statusUrl, scope, chatVisible, title } = opts;
  const [unread, setUnread] = useState(0);
  const [popup, setPopup] = useState<IncomingPopup | null>(null);
  const chatVisibleRef = useRef(chatVisible);
  chatVisibleRef.current = chatVisible;
  const titleRef = useRef(title);
  titleRef.current = title;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const delay = useRef(POLL_VISIBLE_MS);
  const inFlight = useRef(false);

  /** Озвучить реплику, если о ней ещё не сигналили. Для «чат открыт, реплика пришла». */
  const chirpFor = useCallback(
    (messageId: string): boolean => {
      if (readAlerted(scope) === messageId) return false;
      writeAlerted(scope, messageId);
      playIncomingChirp();
      return true;
    },
    [scope]
  );

  const dismissPopup = useCallback(() => setPopup(null), []);

  const tick = useCallback(async () => {
    if (!enabled || !statusUrl || inFlight.current) return;
    inFlight.current = true;
    let status: SupportStatus | null = null;
    try {
      const response = await fetch(statusUrl, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (response.ok) status = (await response.json()) as SupportStatus;
    } catch {
      /* сеть — ниже backoff */
    } finally {
      inFlight.current = false;
    }

    if (!status) {
      delay.current = Math.min(delay.current * 2, MAX_BACKOFF_MS);
    } else {
      delay.current = POLL_VISIBLE_MS;
      setUnread(status.unreadForClient);
      if (status.latest && shouldAlert(status, readAlerted(scope))) {
        // Сначала помечаем, потом сигналим: соседняя вкладка на своём
        // тике увидит id и промолчит.
        writeAlerted(scope, status.latest.id);
        playIncomingChirp();
        const lookingAtChat =
          chatVisibleRef.current && document.visibilityState === "visible";
        if (!lookingAtChat) {
          setPopup({
            id: status.latest.id,
            threadId: status.threadId,
            title: titleRef.current(status),
            preview: status.latest.preview,
            createdAt: status.latest.createdAt,
          });
        }
      }
    }

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => void tick(),
      document.visibilityState === "hidden" ? POLL_HIDDEN_MS : delay.current
    );
  }, [enabled, statusUrl, scope]);

  useEffect(() => {
    if (!enabled || !statusUrl) return;
    primeNotificationSound();
    void tick();

    const wake = () => {
      if (document.visibilityState === "visible") void tick();
    };
    const onRead = () => {
      setUnread(0);
      setPopup(null);
    };
    const onStorage = (event: StorageEvent) => {
      // Другая вкладка уже показала эту реплику — гасим дубль.
      if (event.key === alertKey(scope)) setPopup(null);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("online", wake);
    window.addEventListener(SUPPORT_CHAT_READ_EVENT, onRead);
    window.addEventListener("storage", onStorage);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener(SUPPORT_CHAT_READ_EVENT, onRead);
      window.removeEventListener("storage", onStorage);
    };
  }, [enabled, statusUrl, scope, tick]);

  // Всплывашка гаснет сама: навязчивая карточка раздражает сильнее, чем зовёт.
  useEffect(() => {
    if (!popup) return;
    const t = setTimeout(() => setPopup(null), POPUP_TTL_MS);
    return () => clearTimeout(t);
  }, [popup]);

  return { unread, popup, dismissPopup, refresh: tick, chirpFor };
}
