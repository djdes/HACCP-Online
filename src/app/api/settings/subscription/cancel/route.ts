import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/settings/subscription/cancel
 *
 * Body: { confirm: "Я понимаю", reason?: string }
 *
 * Self-service отписка от подписки. Org переводится на "cancelled" —
 * read-only режим, журналы остаются доступны для скачивания, но
 * новые записи не принимаются. Менеджер может вернуть подписку
 * только через support (то есть пайплайн на менеджера: даём
 * возможность отказаться, но не «всем подряд» — нужна re-confirm).
 *
 * Auth: только owner организации (не management в целом).
 *
 * Аудит: записывает action="subscription.cancelled" с reason +
 * Telegram-push в support-чат.
 */
const Schema = z.object({
  confirm: z.literal("Я понимаю"),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  // Только owner — менеджер не может одним кликом отрезать org.
  const role = auth.session.user.role;
  if (role !== "owner" && role !== "manager" && !auth.session.user.isRoot) {
    return NextResponse.json(
      { error: "Только владелец может отменить подписку" },
      { status: 403 }
    );
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        {
          error:
            err.issues[0]?.message ??
            "Подтвердите фразой «Я понимаю» что хотите отменить",
        },
        { status: 400 }
      );
    }
    throw err;
  }

  const orgId = getActiveOrgId(auth.session);

  await db.organization.update({
    where: { id: orgId },
    data: { subscriptionPlan: "cancelled" },
  });

  await db.auditLog.create({
    data: {
      organizationId: orgId,
      userId: auth.session.user.id,
      userName: auth.session.user.name ?? null,
      action: "subscription.cancelled",
      entity: "organization",
      entityId: orgId,
      details: {
        reason: body.reason ?? null,
        method: "self-service",
      },
    },
  });

  return NextResponse.json({
    ok: true,
    message:
      "Подписка отменена. Чтобы возобновить — свяжитесь с командой WeSetup через виджет «Поддержка».",
  });
}
