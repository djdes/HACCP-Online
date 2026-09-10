import { NextResponse } from "next/server";

import { checkCronSecret } from "@/lib/cron-auth";
import { db } from "@/lib/db";
import { raisePlatformAlert } from "@/lib/platform-alerts";
import { findDrops, formatDropsMessage } from "@/lib/seo-position-alerts";
import { getPositionsHistory, isTopvisorConfigured } from "@/lib/topvisor";
import {
  DEFAULT_REGION_INDEXES,
  regionLabel,
} from "@/lib/topvisor-regions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ключ в PlatformSetting: дата среза, о котором уже сообщали.
 *
 * Своей таблицы под это не заводим — хватает существующего key-value.
 * Без отметки крон бы слал одно и то же каждую ночь: съём позиций
 * происходит 2-3 раза в неделю, а крон ходит ежедневно, и в промежутке
 * свежий срез остаётся тем же самым.
 */
const LAST_DATE_KEY = "seo.alerts.lastDate";

/** Окно поиска: съёмы редкие, за две недели точно наберётся два среза. */
const WINDOW_DAYS = 14;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Ночной крон: сравнивает два свежих среза позиций и сообщает о
 * падениях в Telegram админу платформы.
 *
 *   GET/POST /api/cron/seo-alerts?secret=$CRON_SECRET
 *
 * Съём НЕ запускает и денег не тратит — только читает. Запуск съёма
 * остаётся ручным решением владельца, потому что он платный.
 *
 * Расписание живёт в crontab на сервере: наличие этого файла в
 * репозитории само по себе ничего не планирует.
 */
async function handle(request: Request) {
  const denied = checkCronSecret(request);
  if (denied) return denied;

  if (!isTopvisorConfigured()) {
    return NextResponse.json({ skipped: "topvisor-not-configured" });
  }

  const regionIndex = DEFAULT_REGION_INDEXES[0] ?? 1;
  const to = new Date();
  const from = new Date(to.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const matrix = await getPositionsHistory({
    regionIndex,
    dateFrom: isoDate(from),
    dateTo: isoDate(to),
  });

  const result = findDrops(matrix);
  if (!result.date || !result.previousDate) {
    return NextResponse.json({ skipped: "not-enough-snapshots" });
  }

  const seen = await db.platformSetting.findUnique({
    where: { key: LAST_DATE_KEY },
    select: { value: true },
  });
  if (seen?.value === result.date) {
    return NextResponse.json({ skipped: "already-reported", date: result.date });
  }

  // Отметку ставим и когда падений нет: иначе на следующую ночь тот же
  // срез снова пройдёт весь путь и, если позиции к тому моменту
  // просядут в отчёте Topvisor, придёт алерт о «старом» срезе.
  await db.platformSetting.upsert({
    where: { key: LAST_DATE_KEY },
    create: { key: LAST_DATE_KEY, value: result.date },
    update: { value: result.date },
  });

  if (result.drops.length === 0) {
    return NextResponse.json({ date: result.date, drops: 0, alert: "no-drops" });
  }

  const alert = await raisePlatformAlert({
    kind: "seo-positions",
    dedupeKey: `${regionIndex}:${result.date}`,
    text: formatDropsMessage(result, regionLabel(regionIndex)),
  });

  return NextResponse.json({
    date: result.date,
    previousDate: result.previousDate,
    drops: result.drops.length,
    alert,
  });
}

export const GET = handle;
export const POST = handle;
