import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import {
  ensureActiveDocument,
  ensureNextPeriodDocument,
} from "@/lib/journal-auto-create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/auto-create-journals?secret=$CRON_SECRET
 *
 * Раз в день дёргаем для каждой org с непустым `autoJournalCodes`:
 *   1. ensureActiveDocument — гарантирует что есть документ на текущий
 *      период (если cron упал вчера 1-го числа — догоняет сегодня).
 *   2. ensureNextPeriodDocument — за 7 дней до конца текущего создаёт
 *      следующий, чтобы 1-го числа он уже существовал и не было
 *      «провала compliance» из-за недосозданного документа.
 *
 * Идемпотентно. Безопасно вызывать несколько раз в день.
 *
 * INFRA NEXT: внешний cron 04:00 MSK ежедневно.
 */
async function handle(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;
  const orgs = await db.organization.findMany({
    select: { id: true, autoJournalCodes: true },
  });

  let totalCurrentCreated = 0;
  let totalNextCreated = 0;
  let orgsTouched = 0;
  const errors: string[] = [];

  for (const org of orgs) {
    const codes = Array.isArray(org.autoJournalCodes)
      ? (org.autoJournalCodes as string[]).filter(
          (c): c is string => typeof c === "string"
        )
      : [];
    if (codes.length === 0) continue;
    orgsTouched += 1;

    for (const code of codes) {
      try {
        const cur = await ensureActiveDocument(db, {
          organizationId: org.id,
          templateCode: code,
        });
        if (cur.created) totalCurrentCreated += 1;

        const nxt = await ensureNextPeriodDocument(db, {
          organizationId: org.id,
          templateCode: code,
          lookaheadDays: 7,
        });
        if (nxt.created) totalNextCreated += 1;
      } catch (err) {
        errors.push(
          `org=${org.id} code=${code}: ${(err as Error).message ?? "ошибка"}`
        );
      }
    }
  }

  return NextResponse.json({
    ok: true,
    organizationsProcessed: orgsTouched,
    currentDocumentsCreated: totalCurrentCreated,
    nextPeriodDocumentsCreated: totalNextCreated,
    errors: errors.slice(0, 10),
  });
}

export const GET = handle;
export const POST = handle;
