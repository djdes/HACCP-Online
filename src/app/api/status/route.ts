import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { currentAnnouncement, readPlatformStatus, serviceState } from "@/lib/platform-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/status — публичный статус сервиса для страницы /status и
 * внешних мониторов: база, сборка, аптайм процесса, Telegram-бот,
 * действующее объявление и последние инциденты. Без авторизации и без
 * кеша: сюда смотрят, когда что-то не так.
 */
const startedAt = Date.now();

async function readMarker(name: string): Promise<string | null> {
  try {
    return (await readFile(name, "utf-8")).trim() || null;
  } catch {
    return null;
  }
}

async function checkTelegram(origin: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${origin}/api/telegram/health`, { signal: controller.signal, cache: "no-store" });
    clearTimeout(timer);
    const body = (await response.json().catch(() => null)) as { ok?: boolean } | null;
    return { ok: response.ok && body?.ok === true, detail: response.ok ? "отвечает" : `HTTP ${response.status}` };
  } catch {
    return { ok: false, detail: "не отвечает" };
  }
}

export async function GET(request: Request) {
  let dbOk = true;
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbOk = false;
  }
  const origin = new URL(request.url).origin;
  const [buildSha, buildTime, telegram, settings, announcement] = await Promise.all([
    readMarker(".build-sha"),
    readMarker(".build-time"),
    checkTelegram(origin),
    readPlatformStatus(),
    currentAnnouncement(),
  ]);
  const state = serviceState(settings.incidents, dbOk);
  return NextResponse.json(
    {
      ok: dbOk,
      state,
      now: new Date().toISOString(),
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
      build: { sha: buildSha?.slice(0, 8) ?? null, time: buildTime },
      components: [
        { key: "web", title: "Сайт и API", ok: true, detail: "отвечает" },
        { key: "db", title: "База данных", ok: dbOk, detail: dbOk ? `${dbLatencyMs} мс` : "недоступна" },
        { key: "telegram", title: "Telegram-бот", ok: telegram.ok, detail: telegram.detail },
      ],
      announcement,
      incidents: settings.incidents.slice(0, 20),
    },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
