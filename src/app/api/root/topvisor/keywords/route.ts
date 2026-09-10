import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import {
  TopvisorError,
  addKeyword,
  deleteKeywords,
  isTopvisorConfigured,
  listGroups,
  listKeywords,
} from "@/lib/topvisor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Разумный потолок на одну пачку — заливка идёт по одной фразе за запрос. */
const MAX_BATCH = 300;

function failure(error: unknown) {
  if (error instanceof TopvisorError) {
    return NextResponse.json(
      { error: `Topvisor: ${error.message}`, code: error.code },
      { status: 502 }
    );
  }
  throw error;
}

/** GET — фразы и группы проекта. */
export async function GET() {
  await requireRoot();
  if (!isTopvisorConfigured()) {
    return NextResponse.json({ configured: false, keywords: [], groups: [] });
  }
  try {
    const [keywords, groups] = await Promise.all([listKeywords(), listGroups()]);
    return NextResponse.json({ configured: true, keywords, groups });
  } catch (error) {
    return failure(error);
  }
}

/**
 * POST — добавить фразы пачкой.
 *
 * Массового метода у Topvisor нет: документированный
 * add/keywords_2/keywords/import трактует CSV как список имён по строкам
 * и заносит заголовок с запятыми прямо в имя фразы. Поэтому шлём по
 * одной и собираем отчёт, а не падаем на первой ошибке.
 */
export async function POST(request: Request) {
  await requireRoot();
  if (!isTopvisorConfigured()) {
    return NextResponse.json({ error: "Topvisor не настроен" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    phrases?: unknown;
    groupId?: unknown;
    target?: unknown;
  } | null;

  const groupId = Number(body?.groupId);
  if (!Number.isFinite(groupId) || groupId <= 0) {
    return NextResponse.json({ error: "Не выбрана группа" }, { status: 400 });
  }

  const raw = Array.isArray(body?.phrases) ? body.phrases : [];
  // Дедуп внутри пачки: Topvisor молча создаст две одинаковые фразы,
  // и они будут конкурировать в отчёте.
  const seen = new Set<string>();
  const phrases: string[] = [];
  for (const item of raw) {
    const phrase = String(item ?? "").trim();
    if (!phrase) continue;
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    phrases.push(phrase);
  }

  if (phrases.length === 0) {
    return NextResponse.json({ error: "Пустой список фраз" }, { status: 400 });
  }
  if (phrases.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `За раз можно добавить не больше ${MAX_BATCH} фраз` },
      { status: 400 }
    );
  }

  const target = typeof body?.target === "string" ? body.target.trim() : "";

  let existing: Set<string>;
  try {
    existing = new Set(
      (await listKeywords()).map((k) => (k.name ?? "").trim().toLowerCase())
    );
  } catch (error) {
    return failure(error);
  }

  let added = 0;
  let skipped = 0;
  const failed: Array<{ phrase: string; reason: string }> = [];

  for (const phrase of phrases) {
    if (existing.has(phrase.toLowerCase())) {
      skipped += 1;
      continue;
    }
    try {
      await addKeyword({ name: phrase, groupId, target });
      existing.add(phrase.toLowerCase());
      added += 1;
    } catch (error) {
      failed.push({
        phrase,
        reason:
          error instanceof TopvisorError ? error.message : "Неизвестная ошибка",
      });
    }
  }

  return NextResponse.json({ added, skipped, failed });
}

/** DELETE — удалить выбранные фразы. */
export async function DELETE(request: Request) {
  await requireRoot();
  if (!isTopvisorConfigured()) {
    return NextResponse.json({ error: "Topvisor не настроен" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = (Array.isArray(body?.ids) ? body.ids : [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Не выбрано ни одной фразы" }, { status: 400 });
  }

  try {
    return NextResponse.json({ deleted: await deleteKeywords(ids) });
  } catch (error) {
    return failure(error);
  }
}
