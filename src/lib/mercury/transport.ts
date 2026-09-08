/**
 * Транспорт Ветис.API — граница между «нашим» кодом и сетью.
 *
 * Всё, что выше этого интерфейса (сборка XML, разбор, политика повторов,
 * маппинг в журнал), тестируется без единого сетевого вызова. Ниже —
 * ровно один файл, который реально ходит наружу (`http-transport.ts`),
 * и его двойник в памяти (`mock-transport.ts`).
 *
 * Именно это позволяет собрать всю фичу ДО получения доступов от
 * Россельхознадзора: заявка рассматривается до пяти рабочих дней, ждать
 * её сложа руки незачем.
 */
import type { MercuryEnvironment } from "./types";

export type MercuryTransport = {
  /** Отправить конверт `submitApplicationRequest`, вернуть сырой XML ответа. */
  submit(xml: string): Promise<string>;
  /** Забрать результат: конверт `receiveApplicationResultRequest`. */
  receive(xml: string): Promise<string>;
  /** Для диагностики в UI: куда именно ходим. */
  readonly describe: string;
};

export type TransportMode = "mock" | "live";

/**
 * Какой транспорт использовать.
 *
 * Правило простое: без системного APIKey живой транспорт невозможен, и
 * молча уходить в мок в проде нельзя — клиент примет выдуманные ВСД за
 * настоящие. Поэтому в проде отсутствие ключа это ошибка конфигурации, а
 * не тихий откат.
 */
export function resolveTransportMode(env: {
  nodeEnv?: string;
  mercuryMode?: string;
  apiKey?: string;
}): TransportMode {
  const isProd = (env.nodeEnv ?? process.env.NODE_ENV) === "production";
  const mode = env.mercuryMode ?? process.env.MERCURY_MODE;
  const apiKey = env.apiKey ?? process.env.MERCURY_API_KEY;

  if (mode === "mock") return "mock";
  if (mode === "live") return "live";
  if (apiKey) return "live";
  if (isProd) {
    // Явно, а не молча: пусть настройки покажут «не подключено».
    return "live";
  }
  return "mock";
}

/** Демо-режим показывается в UI большой плашкой — см. страницу настроек. */
export function isDemoMode(mode: TransportMode): boolean {
  return mode === "mock";
}

export type MercuryTransportContext = {
  environment: MercuryEnvironment;
  apiKey: string;
};
