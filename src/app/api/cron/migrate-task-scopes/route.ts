import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import { TEMPLATE_SCOPE_DEFAULTS } from "@/lib/journal-task-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-off (idempotent) migration: проставляет JournalTemplate.taskScope,
 * allowNoEvents, noEventsReasons по дефолтам из journal-task-scope.ts.
 *
 * GET/POST /api/cron/migrate-task-scopes?secret=$CRON_SECRET
 *
 * Вызывается ОДИН раз после deploy schema change. Можно дёргать снова —
 * безопасно (UPDATE по точному совпадению значений defaults).
 *
 * После того как все ручные правки в /settings/journals/[code] будут
 * сделаны менеджерами, повторный запуск НЕ затрёт их кастомизацию,
 * потому что мы пишем только когда поле = текущему дефолту schema
 * (т.е. ещё не было ручной правки).
 */
async function handle(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  {
    const cronAuth = checkCronSecret(request);
    if (cronAuth) return cronAuth;
  }

  const force = searchParams.get("force") === "1";

  const templates = await db.journalTemplate.findMany({
    select: {
      id: true,
      code: true,
      taskScope: true,
      allowNoEvents: true,
      noEventsReasons: true,
      allowFreeTextReason: true,
    },
  });

  const report = {
    total: templates.length,
    updated: 0,
    unchanged: 0,
    skipped: [] as string[],
  };

  for (const t of templates) {
    const cfg = TEMPLATE_SCOPE_DEFAULTS[t.code];
    if (!cfg) {
      // Unknown template — оставляем как есть (default из schema).
      report.skipped.push(t.code);
      continue;
    }

    // Skip if already matches AND not force — пользователь уже мог
    // переопределить через settings UI.
    if (
      !force &&
      t.taskScope === cfg.taskScope &&
      t.allowNoEvents === cfg.allowNoEvents
    ) {
      report.unchanged += 1;
      continue;
    }

    const updates: {
      taskScope?: string;
      allowNoEvents?: boolean;
      noEventsReasons?: string[];
      allowFreeTextReason?: boolean;
    } = {};

    if (force || t.taskScope !== cfg.taskScope) {
      updates.taskScope = cfg.taskScope;
    }
    if (force || t.allowNoEvents !== cfg.allowNoEvents) {
      updates.allowNoEvents = cfg.allowNoEvents;
    }
    if (cfg.noEventsReasons) {
      updates.noEventsReasons = cfg.noEventsReasons;
    }
    if (cfg.allowFreeTextReason !== undefined) {
      updates.allowFreeTextReason = cfg.allowFreeTextReason;
    }

    if (Object.keys(updates).length > 0) {
      await db.journalTemplate.update({
        where: { id: t.id },
        data: updates,
      });
      report.updated += 1;
    } else {
      report.unchanged += 1;
    }
  }

  return NextResponse.json({ ok: true, report });
}

export const GET = handle;
export const POST = handle;
