import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/auto-archive-documents?secret=$CRON_SECRET
 *
 * Раз в неделю архивирует документы журналов с `dateTo` старше
 * `ARCHIVE_AGE_DAYS` (по умолчанию 365). Меняет status="active" → "closed".
 *
 * Зачем: 12-месячный архив — стандарт ХАССП. После года документ
 * остаётся для аудита, но не должен висеть в active-списке /journals
 * как актуальный. Убирает шум из dropdown'ов и compliance-расчётов.
 *
 * Идемпотентно — повторный вызов на уже closed документ ничего не
 * делает.
 *
 * INFRA NEXT: cron 1 раз в неделю (воскресенье 04:00 MSK).
 */
const ARCHIVE_AGE_DAYS = 365;

async function handle(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;
  const cutoff = new Date(
    Date.now() - ARCHIVE_AGE_DAYS * 24 * 60 * 60 * 1000
  );

  const result = await db.journalDocument.updateMany({
    where: {
      status: "active",
      dateTo: { lt: cutoff },
    },
    data: { status: "closed" },
  });

  return NextResponse.json({
    ok: true,
    archived: result.count,
    cutoff: cutoff.toISOString(),
  });
}

export const GET = handle;
export const POST = handle;
