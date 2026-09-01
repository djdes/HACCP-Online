import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ASSISTANT_SETTING_KEYS, readAssistantSettings } from "@/lib/assistant/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Настройки интеграции ассистента. Только для управляющего платформой.
 *
 * Токен наружу не возвращается ни в каком виде — только признак «задан».
 * Пустое значение при сохранении означает «не менять»: иначе правка
 * соседнего поля стирала бы токен.
 */

const schema = z.object({
  token: z.string().trim().max(300).optional(),
  projectId: z.string().trim().max(200).optional(),
  apiUrl: z.string().trim().max(300).optional(),
  baseUrl: z.string().trim().max(300).optional(),
  enabled: z.boolean().optional(),
});

async function put(key: string, value: string) {
  await db.platformSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function GET() {
  await requireRoot();
  const settings = await readAssistantSettings();
  return NextResponse.json({
    hasToken: Boolean(settings.token),
    projectId: settings.projectId ?? "",
    apiUrl: settings.apiUrl ?? "",
    baseUrl: settings.baseUrl ?? "",
    enabled: settings.enabled !== "off",
  });
}

export async function POST(request: Request) {
  await requireRoot();

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 }
    );
  }

  const { token, projectId, apiUrl, baseUrl, enabled } = parsed.data;

  if (token) await put(ASSISTANT_SETTING_KEYS.token, token);
  if (projectId !== undefined) {
    await put(ASSISTANT_SETTING_KEYS.projectId, projectId);
  }
  if (apiUrl !== undefined) await put(ASSISTANT_SETTING_KEYS.apiUrl, apiUrl);
  if (baseUrl !== undefined) await put(ASSISTANT_SETTING_KEYS.baseUrl, baseUrl);
  if (enabled !== undefined) {
    await put(ASSISTANT_SETTING_KEYS.enabled, enabled ? "on" : "off");
  }

  return NextResponse.json({ ok: true });
}
