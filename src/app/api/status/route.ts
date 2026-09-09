import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { getInboundBot } from "@/lib/bot/bot-app";
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

/**
 * Telegram-бот — тем же getMe(), что и /api/telegram/health, но напрямую,
 * без HTTP-вызова самого себя: сервер не всегда достаёт свой публичный
 * адрес изнутри, и проверка ложно горела красным.
 */
async function checkTelegram(): Promise<{ ok: boolean; detail: string }> {
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return { ok: false, detail: "токен не настроен" };
  const bot = getInboundBot();
  if (!bot) return { ok: false, detail: "не инициализирован" };
  const started = Date.now();
  try {
    const me = await Promise.race([
      bot.api.getMe(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
    ]);
    return { ok: Boolean(me?.username), detail: `${Date.now() - started} мс` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error && error.message === "timeout" ? "не отвечает" : "ошибка" };
  }
}

export async function GET() {
  let dbOk = true;
  let dbLatencyMs = 0;
  try {
    const t0 = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbOk = false;
  }
  const [buildSha, buildTime, telegram, settings, announcement] = await Promise.all([
    readMarker(".build-sha"),
    readMarker(".build-time"),
    checkTelegram(),
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
