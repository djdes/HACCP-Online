import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { clientIp } from "@/lib/client-ip";
import { journalSampleRateLimiter } from "@/lib/rate-limit";
import { findOrderTemplate } from "@/lib/orders/catalog";
import { renderOrderPdf } from "@/lib/orders/pdf";
import { currentOrgSnapshot } from "@/lib/orders/store";
import { defaultOrderValues, type OrderOrgSnapshot } from "@/lib/orders/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDF приказа.
 *
 * Работает и без сессии — это витрина /prikazy: человек должен увидеть
 * готовый бланк до регистрации. Разница только в реквизитах: гостю
 * печатаем пустой бланк с прочерками, залогиненному подставляем данные
 * его организации.
 *
 * Код шаблона проверяется по белому списку каталога, иначе в рендер
 * прилетал бы произвольный сегмент URL.
 */

/** Пустой бланк: всё прочерками, человек дописывает ручкой. */
const BLANK_ORG: OrderOrgSnapshot = {
  orgName: "",
  orgShortName: "",
  orgInn: null,
  orgAddress: null,
  directorName: null,
  directorPost: null,
  city: null,
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const template = findOrderTemplate(code);
  if (!template) {
    return NextResponse.json({ error: "Приказ не найден" }, { status: 404 });
  }

  const ip = clientIp(request) ?? "unknown";
  if (!journalSampleRateLimiter.consume(`order-pdf:${ip}`)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте через минуту" },
      { status: 429 }
    );
  }

  const url = new URL(request.url);
  const session = await getServerSession(authOptions).catch(() => null);

  let org = BLANK_ORG;
  if (session) {
    org = (await currentOrgSnapshot(getActiveOrgId(session))) ?? BLANK_ORG;
  }

  try {
    const { buffer, fileName } = renderOrderPdf({
      template,
      org,
      // Пустой бланк: значения не подставляем даже залогиненному —
      // заполненный приказ печатается из формы, а не из этой ссылки.
      values: Object.fromEntries(
        Object.keys(defaultOrderValues(template)).map((key) => [key, ""])
      ),
      number: "",
      issuedAt: "",
    });

    const disposition = url.searchParams.get("inline") === "1" ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[orders] не удалось собрать PDF:", error);
    return NextResponse.json({ error: "Не удалось собрать PDF" }, { status: 500 });
  }
}
