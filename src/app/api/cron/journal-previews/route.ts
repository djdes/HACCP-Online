import { NextResponse } from "next/server";
import { checkCronSecret } from "@/lib/cron-auth";
import { runJournalPreviewCron } from "@/lib/journal-preview/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/journal-previews — снимки первой страницы активных
 * документов для карточек журналов.
 *
 * Внешний crontab каждые 10 минут. За прогон — не больше 60 рендеров и
 * ~4 минут: остаток доедет следующим запуском, а пользователь никогда не
 * ждёт рендер — пока снимка нет, карточка показывает стандартный образец.
 * Тем же прогоном чистятся снимки отключённых журналов и документов,
 * которых нет уже 30 дней.
 */
export async function GET(request: Request) {
  const authError = checkCronSecret(request);
  if (authError) return authError;

  const result = await runJournalPreviewCron();
  return NextResponse.json({ ok: true, ...result });
}
