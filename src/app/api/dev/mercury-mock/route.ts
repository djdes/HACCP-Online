import { NextResponse } from "next/server";

import { MockTransport } from "@/lib/mercury/mock-transport";
import { getMockStore } from "@/lib/mercury/mock/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dev/mercury-mock — фальшивый шлюз Ветис.API, говорящий
 * настоящим SOAP по HTTP.
 *
 * Зачем он есть. Заявку на доступ к Ветис.API рассматривают до пяти
 * рабочих дней, а до этого нет ни APIKey, ни тестового ХС. Мок-транспорт
 * в памяти закрывает юнит-тесты, но обходит `HttpSoapTransport` — то
 * есть ровно тот файл, который в проде и будет ходить в сеть. Этот роут
 * закрывает дыру: ставим
 *
 *   MERCURY_MODE=live
 *   MERCURY_API_KEY=dev
 *   MERCURY_BASE_URL=http://localhost:3000/api/dev/mercury-mock
 *   LOCAL_INTEGRATIONS_ALLOWED=1
 *
 * и весь путь — сборка XML → HTTP → разбор → очередь → запись в журнал —
 * проходится боевым кодом. К приходу настоящих доступов останется
 * откалибровать только namespace'ы и набор полей.
 *
 * В проде роут отвечает 404: показать клиенту выдуманные ВСД как
 * настоящие — худшее, что может сделать эта интеграция.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const xml = await request.text();
  const transport = new MockTransport(getMockStore());

  // Различаем два конверта протокола по имени операции внутри тела.
  const isReceive = xml.includes("receiveApplicationResultRequest");
  const response = isReceive
    ? await transport.receive(xml)
    : await transport.submit(xml);

  return new NextResponse(response, {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** GET — короткая справка и состояние стора, чтобы не гадать в разработке. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    note: "Фальшивый шлюз Ветис.API. Только для разработки.",
    usage: {
      MERCURY_MODE: "live",
      MERCURY_API_KEY: "dev",
      MERCURY_BASE_URL: "http://localhost:3000/api/dev/mercury-mock",
      LOCAL_INTEGRATIONS_ALLOWED: "1",
    },
  });
}
