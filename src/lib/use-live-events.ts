"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import type { LiveConnectionState } from "@/lib/live-connection";
import type { LiveEvent } from "@/lib/live-events";

/**
 * Подписка вкладки на живые события сервера (`/api/live`).
 *
 * Соединение одно на вкладку, сколько бы компонентов ни подписалось:
 * колокольчик, баланс, чат и дашборд делят его. Открывается лениво при
 * первом подписчике, закрывается при последнем — и на `pagehide`, чтобы
 * не держать слот на сервере у вкладки, которую уже сворачивают.
 *
 * Переподключение делает сам `EventSource`. При каждом новом `open`
 * (первом или после разрыва) подписчикам уходит событие «reconnect» —
 * это сигнал перечитать состояние, потому что за время разрыва могло
 * что-то произойти. Деплой рвёт все соединения разом, и без этого
 * колокольчик показывал бы старый счётчик до следующего опроса.
 *
 * Состояние соединения (`useLiveConnection`) — для плашки «Нет связи с
 * сервером». Разница между обрывом и отказом важна: после 401 (нет
 * сессии) браузер переподключаться не будет, и показывать «нет связи»
 * на странице входа было бы враньём.
 *
 * Опросы у компонентов не убраны, а сохранены как страховка: если
 * поток по какой-то причине не доходит (прокси режет, корпоративный
 * фильтр), всё продолжает работать с прежней частотой.
 */
type Handler = (event: LiveEvent) => void;

const EVENT_TYPES: LiveEvent["type"][] = [
  "notification",
  "balance",
  "journal",
  "support",
  "reconnect",
];

let source: EventSource | null = null;
let everOpened = false;
const handlers = new Set<Handler>();

// --- состояние соединения: внешний store для useSyncExternalStore

const IDLE_STATE: LiveConnectionState = { status: "idle", downSince: null };
let connection: LiveConnectionState = IDLE_STATE;
const connectionListeners = new Set<() => void>();

function setConnection(next: LiveConnectionState) {
  if (next.status === connection.status && next.downSince === connection.downSince) return;
  connection = next;
  for (const listener of connectionListeners) listener();
}

function subscribeConnection(listener: () => void) {
  connectionListeners.add(listener);
  return () => {
    connectionListeners.delete(listener);
  };
}

const getConnection = () => connection;
const getServerConnection = () => IDLE_STATE;

/** Текущее состояние потока. Сам поток не открывает — см. `useLiveEvents`. */
export function useLiveConnection(): LiveConnectionState {
  return useSyncExternalStore(subscribeConnection, getConnection, getServerConnection);
}

// --- поток

function emit(event: LiveEvent) {
  for (const handler of handlers) {
    try {
      handler(event);
    } catch (error) {
      console.error("[live] обработчик события упал", error);
    }
  }
}

function open() {
  if (source || typeof window === "undefined" || !("EventSource" in window)) return;

  const es = new EventSource("/api/live", { withCredentials: true });
  source = es;

  es.onopen = () => {
    setConnection({ status: "open", downSince: null });
    // Первое открытие — компоненты и так грузят состояние при монтировании;
    // «reconnect» шлём только на повторных, чтобы не удваивать запросы.
    if (everOpened) emit({ type: "reconnect", at: new Date().toISOString() });
    everOpened = true;
  };

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      // Сервер отказал (обычно 401 без сессии): браузер переподключаться
      // не будет. Это не обрыв — индикатор молчит. Следующий подписчик
      // или возврат во вкладку попробуют открыть заново.
      if (source === es) source = null;
      setConnection({ status: "closed", downSince: null });
      return;
    }
    // CONNECTING: браузер сам переподключится через `retry` с сервера.
    // Обрыв считаем с первой ошибки; показывать ли его — решает
    // индикатор (только после минуты). Не логируем: консоль зарастала
    // бы при каждом деплое.
    setConnection({ status: "down", downSince: connection.downSince ?? Date.now() });
  };

  for (const type of EVENT_TYPES) {
    es.addEventListener(type, (raw) => {
      try {
        emit(JSON.parse((raw as MessageEvent).data) as LiveEvent);
      } catch {
        /* битый кадр — пропускаем, следующий придёт целым */
      }
    });
  }
}

function close() {
  source?.close();
  source = null;
  setConnection(IDLE_STATE);
}

function onPageHide() {
  close();
}

function onVisible() {
  if (document.visibilityState !== "visible") return;
  if (!source || source.readyState === EventSource.CLOSED) {
    // Вернулись во вкладку после сворачивания — соединение могло
    // умереть тихо. Переоткрываем и даём сигнал перечитать.
    open();
    emit({ type: "reconnect", at: new Date().toISOString() });
    return;
  }
  // Пока вкладка была скрыта, браузер придерживал переподключения —
  // минуту обрыва считаем с возвращения, иначе плашка вспыхнула бы сразу.
  if (connection.status === "down") setConnection({ status: "down", downSince: Date.now() });
}

/**
 * Подписаться на живые события. Обработчик можно передавать новым на
 * каждый рендер — внутри он держится в ref, переподписки не будет.
 * `enabled: false` — не подписываться вовсе (Mini App до входа).
 */
export function useLiveEvents(handler: Handler, options: { enabled?: boolean } = {}): void {
  const enabled = options.enabled ?? true;
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    const stable: Handler = (event) => ref.current(event);
    handlers.add(stable);
    if (handlers.size === 1) {
      window.addEventListener("pagehide", onPageHide);
      document.addEventListener("visibilitychange", onVisible);
    }
    // Открываем при каждом новом подписчике: если поток уже есть — no-op,
    // а после отказа сервера (401 до входа) это повторная попытка.
    open();
    return () => {
      handlers.delete(stable);
      if (handlers.size === 0) {
        close();
        window.removeEventListener("pagehide", onPageHide);
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [enabled]);
}
