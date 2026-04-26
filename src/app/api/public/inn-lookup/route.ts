import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/inn-lookup?inn=...
 *
 * Public endpoint (без auth) — для wizard'а регистрации компании.
 * Принимает ИНН (10 или 12 цифр), возвращает name + address +
 * directorName из DaData Suggestions API.
 *
 * DaData Standard tier: бесплатно до 10K запросов/день. Token в env
 * DADATA_API_KEY. Если не настроен — endpoint возвращает 503.
 *
 * Response: { ok, name, address, directorName, type, okvedCode? }
 *           или { ok: false, error: '...' }
 *
 * Rate-limit на этот endpoint не делаем — DaData сами лимитируют по
 * нашему ключу. Если кто-то заспамит, наш лимит исчерпается и
 * последующие запросы вернут 429 от DaData → передадим юзеру.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const inn = (searchParams.get("inn") ?? "").trim().replace(/\D/g, "");

  if (!inn || (inn.length !== 10 && inn.length !== 12)) {
    return NextResponse.json(
      { ok: false, error: "ИНН должен содержать 10 или 12 цифр" },
      { status: 400 }
    );
  }

  const apiKey = process.env.DADATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Сервис проверки по ИНН временно недоступен. Введите данные вручную.",
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({ query: inn }),
        // 5-секундный timeout — DaData обычно отвечает за <1 сек,
        // но если сервис тормозит, юзер не должен ждать дольше.
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: `DaData ответила ${response.status}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as {
      suggestions?: Array<{
        value?: string;
        data?: {
          name?: { full_with_opf?: string; short_with_opf?: string };
          address?: { value?: string };
          management?: { name?: string };
          okved?: string;
          state?: { status?: string };
          opf?: { type?: string };
        };
      }>;
    };

    const first = data.suggestions?.[0];
    if (!first || !first.data) {
      return NextResponse.json(
        { ok: false, error: "Организация с таким ИНН не найдена" },
        { status: 404 }
      );
    }

    const d = first.data;
    return NextResponse.json({
      ok: true,
      inn,
      name: d.name?.short_with_opf ?? d.name?.full_with_opf ?? first.value ?? "",
      address: d.address?.value ?? "",
      directorName: d.management?.name ?? "",
      okvedCode: d.okved ?? "",
      status: d.state?.status ?? "",
      opfType: d.opf?.type ?? "",
    });
  } catch (err) {
    console.error("[inn-lookup] DaData error", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          "Не удалось проверить ИНН. Попробуйте позже или введите данные вручную.",
      },
      { status: 502 }
    );
  }
}
