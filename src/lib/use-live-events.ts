"use client";

import { useEffect, useRef } from "react";

import type { LiveEvent } from "@/lib/live-events";

/**
 * Подписка вкладки на живые события сервера (`/api/live`).
 *
 * Соединение одно на вкладку, сколько бы компонентов ни подписалось:
 * колокольчик, баланс и чат делят его. Открывается лениво при первом
 * подписчике, закрывается при последнем — и на `pagehide`, чтобы не
 * держать слот на сервере у вкладки, которую уже сворачивают.
 *
 * Переподключение делает сам `EventSource`. При каждом новом `open`
 * (первом или после разрыва) подписчикам уходит событие «reconnect» —
 * это сигнал перечитать состояние, потому что за время разрыва могло
 * что-то произойти. Деплой рвёт все соединения разом, и без этого
 * колокольчик показывал бы старый счётчик до следующего опроса.
 *
 * Опросы у компонентов не убраны, а сохранены как страховка: если
 * поток по какой-то причине не доходит (прокси режет, корпоративный
 * фильтр), всё продолжает работать с прежней частотой.
 */
type Handler = (event: LiveEvent) => void;

const EVENT_TYPES: LiveEvent["type"][] = ["notification", "balance", "reconnect"];

let source: EventSource | null = null;
let everOpened = false;
const handlers = new Set<Handler>();

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
    // Первое открытие — компоненты и так грузят состояние при монтировании;
    // «reconnect» шлём только на повторных, чтобы не удваивать запросы.
    if (everOpened) emit({ type: "reconnect", at: new Date().toISOString() });
    everOpened = true;
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

  // onerror: EventSource переподключится сам через `retry` с сервера.
  // Ничего не делаем — и не логируем, иначе консоль зарастёт при
  // каждом деплое.
}

function close() {
  source?.close();
  source = null;
}

function onPageHide() {
  close();
}

/**
 * Подписаться на живые события. Обработчик можно передавать новым на
 * каждый рендер — внутри он держится в ref, переподписки не будет.
 */
export function useLiveEvents(handler: Handler): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  }, [handler]);

  useEffect(() => {
    const stable: Handler = (event) => ref.current(event);
    handlers.add(stable);
    if (handlers.size === 1) {
      open();
      window.addEventListener("pagehide", onPageHide);
      // Вернулись во вкладку после сворачивания — соединение могло
      // умереть тихо. Переоткрываем и даём сигнал перечитать.
      document.addEventListener("visibilitychange", onVisible);
    }
    return () => {
      handlers.delete(stable);
      if (handlers.size === 0) {
        close();
        window.removeEventListener("pagehide", onPageHide);
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, []);
}

function onVisible() {
  if (document.visibilityState !== "visible") return;
  if (!source || source.readyState === EventSource.CLOSED) {
    open();
    emit({ type: "reconnect", at: new Date().toISOString() });
  }
}
