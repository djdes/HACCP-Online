import { NextResponse } from "next/server";
import { innLookupRateLimiter } from "@/lib/rate-limit";
import { isValidInn } from "@/lib/inn";
import { ownershipFromOpf, sphereFromOkved } from "@/lib/org-lookup-map";
import { humanizeName, partyPersonName } from "@/lib/org-legal-profile";

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
 * Response: { ok, inn, name, shortName, fullName, address, directorName,
 *   directorPost, kpp, ogrn, type, okvedCode, sphere, ownershipKind, phone,
 *   email, status } или { ok: false, error: '...' }. `sphere` и
 *   `ownershipKind` — подсказки для анкеты (ОКВЭД → сфера, ОПФ → тип).
 *
 * Rate-limit на этот endpoint не делаем — DaData сами лимитируют по
 * нашему ключу. Если кто-то заспамит, наш лимит исчерпается и
 * последующие запросы вернут 429 от DaData → передадим юзеру.
 */
export async function GET(request: Request) {
  // Per-IP rate-limit. Раньше: бесконтрольно проксировали в DaData,
  // атакующий мог съесть нашу 10K-в-день квоту за час и поломать
  // wizard регистрации у легитимных юзеров. Защита от DaData-quota DoS.
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || "unknown";
  if (!innLookupRateLimiter.consume(`inn:${ip}`)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Слишком много запросов. Подождите минуту.",
      },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(request.url);
  const inn = (searchParams.get("inn") ?? "").trim().replace(/\D/g, "");

  if (!inn || (inn.length !== 10 && inn.length !== 12)) {
    return NextResponse.json(
      { ok: false, error: "ИНН должен содержать 10 или 12 цифр" },
      { status: 400 }
    );
  }
  // Контрольная сумма: опечатку ловим сами, не тратя квоту DaData.
  if (!isValidInn(inn)) {
    return NextResponse.json(
      { ok: false, error: "Такого ИНН не бывает — проверьте цифры" },
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
          type?: string;
          inn?: string;
          kpp?: string | null;
          ogrn?: string;
          name?: {
            full_with_opf?: string;
            short_with_opf?: string;
            short?: string;
            full?: string;
          };
          address?: { value?: string; unrestricted_value?: string };
          management?: { name?: string; post?: string };
          fio?: { surname?: string; name?: string; patronymic?: string } | null;
          okved?: string;
          state?: { status?: string };
          opf?: { type?: string; full?: string; short?: string };
          phones?: Array<{ value?: string } | string> | null;
          emails?: Array<{ value?: string } | string> | null;
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
    // Capping длин — DaData иногда отдаёт full_with_opf вида
    // «ООО ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ ...» (200+ chars)
    // или адреса с почтовым индексом, страной, доп. полями. Сервер
    // /api/settings/organization режектит >200/500 — тут предупреждаем,
    // обрезая ещё на этапе lookup.
    const trim = (s: string | undefined | null, max: number): string =>
      typeof s === "string" ? s.normalize("NFKC").trim().slice(0, max) : "";
    // Телефон/почта приходят только на расширенных тарифах DaData —
    // берём первое значение, если есть.
    const firstContact = (
      list: Array<{ value?: string } | string> | null | undefined,
    ): string => {
      const item = list?.[0];
      if (!item) return "";
      return typeof item === "string" ? item : (item.value ?? "");
    };
    return NextResponse.json({
      ok: true,
      inn,
      name: trim(
        d.name?.short_with_opf ?? d.name?.full_with_opf ?? first.value,
        200
      ),
      shortName: trim(d.name?.short_with_opf ?? d.name?.short, 200),
      fullName: trim(d.name?.full_with_opf ?? d.name?.full, 300),
      address: trim(d.address?.value, 500),
      directorName: trim(d.management?.name, 200),
      directorPost: trim(d.management?.post, 100),
      // Человек за ИНН для поля «Ваше имя»: руководитель юрлица или сам ИП,
      // в нормальном регистре.
      personName: partyPersonName(d) ?? "",
      personPost: humanizeName(d.management?.post) ?? "",
      kpp: trim(d.kpp, 20),
      ogrn: trim(d.ogrn, 20),
      type: trim(d.type, 20),
      okvedCode: trim(d.okved, 50),
      sphere: sphereFromOkved(d.okved),
      ownershipKind: ownershipFromOpf(d.opf?.full, d.type),
      phone: trim(firstContact(d.phones), 40),
      email: trim(firstContact(d.emails), 100),
      status: trim(d.state?.status, 50),
      opfType: trim(d.opf?.type, 50),
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
