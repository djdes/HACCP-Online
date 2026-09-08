import { NextResponse } from "next/server";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { isWebPushConfigured, webPushPublicKey } from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Подписка устройства на push-уведомления кабинета.
 *
 * GET  — публичный ключ VAPID и сколько устройств уже подписано.
 * POST — сохранить подписку браузера.
 * DELETE — отписать это устройство.
 *
 * Пока ключи VAPID не заданы в env, GET отвечает `configured: false`, и
 * кнопка в интерфейсе просто не показывается. Так отсутствие настройки
 * на сервере не превращается в ошибку у человека на экране.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const configured = isWebPushConfigured();
  const devices = configured
    ? await db.webPushSubscription
        .count({ where: { userId: session.user.id } })
        .catch(() => 0)
    : 0;

  return NextResponse.json({
    configured,
    publicKey: webPushPublicKey(),
    devices,
  });
}

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Уведомления не настроены на сервере" },
      { status: 503 },
    );
  }

  const parsed = subscribeSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректная подписка" }, { status: 400 });
  }

  const organizationId = getActiveOrgId(session);
  const userAgent = request.headers.get("user-agent")?.slice(0, 255) ?? null;

  // upsert по endpoint, а не по паре с пользователем: endpoint — это
  // адрес конкретного браузера. Если планшет кухни передали другому
  // сотруднику и тот подписался, подписка должна ПЕРЕЕХАТЬ на него.
  // Иначе прошлый владелец продолжал бы получать чужие уведомления.
  await db.webPushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      organizationId,
      userId: session.user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
    },
    update: {
      organizationId,
      userId: session.user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
      failureCount: 0,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: string;
  } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : null;
  if (!endpoint) {
    return NextResponse.json({ error: "Нет адреса подписки" }, { status: 400 });
  }

  // Удаляем только свою: чужой endpoint знать неоткуда, но проверка
  // стоит одного условия.
  await db.webPushSubscription
    .deleteMany({ where: { endpoint, userId: session.user.id } })
    .catch(() => null);

  return NextResponse.json({ ok: true });
}
