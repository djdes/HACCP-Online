/**
 * ЕДИНСТВЕННЫЙ файл в интеграции, который ходит в сеть.
 *
 * Всё остальное — сборка XML, разбор, политика повторов, маппинг в
 * журнал — работает поверх интерфейса `MercuryTransport` и тестируется
 * без сети. Когда придут доступы к тестовому контуру, калибровать нужно
 * будет этот файл, `ns.ts` и фикстуры — больше ничего.
 *
 * Открытый вопрос до тестового контура: помимо APIKey Ветис.API
 * исторически требует сервисную учётную запись (HTTP Basic). Заголовок
 * добавляется одной строкой ниже — специально вынесен, чтобы включение
 * или удаление было правкой в одном месте.
 */
import { MercuryError } from "./errors";
import { applicationServiceUrl } from "./ns";
import type { MercuryTransport } from "./transport";
import type { MercuryEnvironment } from "./types";

/** SOAP медленнее REST: у Ветис заявка спокойно думает секунды. */
const DEFAULT_TIMEOUT_MS = 20_000;

export class HttpSoapTransport implements MercuryTransport {
  readonly describe: string;
  private readonly url: string;

  constructor(
    private readonly options: {
      environment: MercuryEnvironment;
      timeoutMs?: number;
      /** Сервисная учётка шлюза, если она понадобится. */
      login?: string;
      password?: string;
    },
  ) {
    this.url = applicationServiceUrl(options.environment);
    this.describe = `${options.environment} · ${this.url}`;
  }

  submit(xml: string): Promise<string> {
    return this.call(xml, "submitApplicationRequest");
  }

  receive(xml: string): Promise<string> {
    return this.call(xml, "receiveApplicationResultRequest");
  }

  private async call(xml: string, soapAction: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    const headers: Record<string, string> = {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction,
    };
    if (this.options.login) {
      const basic = Buffer.from(
        `${this.options.login}:${this.options.password ?? ""}`,
      ).toString("base64");
      headers.Authorization = `Basic ${basic}`;
    }

    let response: Response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers,
        body: xml,
        signal: controller.signal,
      });
    } catch (error) {
      throw new MercuryError(
        "network",
        error instanceof Error && error.name === "AbortError"
          ? `Меркурий не ответил за ${(this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS) / 1000} с`
          : `Сеть недоступна: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.text().catch(() => "");

    // SOAP Fault приезжает с кодом 500 — это НЕ сетевая ошибка, его
    // разбирает парсер и превращает в `soap_fault`. Поэтому 500 с телом
    // отдаём наверх, а не глотаем как «сервер лежит».
    if (!response.ok && !(response.status === 500 && body.includes("Fault"))) {
      throw new MercuryError(
        "http",
        `Меркурий вернул HTTP ${response.status}`,
        { httpStatus: response.status },
      );
    }

    if (!body) {
      throw new MercuryError("parse", "Меркурий вернул пустой ответ", {
        httpStatus: response.status,
      });
    }
    return body;
  }
}
