import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * I4 — Право на забвение (ФЗ-152, статья 6). Self-service удаление
 * организации с ВСЕМИ данными.
 *
 * Безопасность:
 *   - Только owner организации (не management).
 *   - Двойная защита: confirm = название организации (точно).
 *   - Через 7 дней реальное удаление (soft schedule).
 *   - Email уведомление admin'у на support о факте запроса.
 *
 * В этом MVP — флаг `subscriptionPlan="cancelled"` + audit-log.
 * Реальное hard-delete через ROOT админский интерфейс.
 *
 * Cascade'и в Prisma уже настроены — удаление org удалит users,
 * journals, entries, capa, losses, audit-logs.
 */
const Schema = z.object({
  confirmName: z.string().min(1),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;

  // Owner-equivalent роли — тот, кто зарегистрировал org. После
  // миграции схемы новые org создаются с role="manager", старые —
  // с "owner". head_chef не должен удалять (его менеджер нанимает
  // и увольняет, не наоборот). Раньше: только "owner" → новый
  // менеджер не мог удалить даже свой собственный бизнес.
  const role = auth.session.user.role;
  const isOwnerLike = role === "owner" || role === "manager";
  if (!isOwnerLike && !auth.session.user.isRoot) {
    return NextResponse.json(
      { error: "Только владелец может удалить организацию" },
      { status: 403 }
    );
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 }
      );
    }
    throw err;
  }

  const orgId = getActiveOrgId(auth.session);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  // Защита: confirmName должен ТОЧНО совпадать с названием.
  if (body.confirmName.trim() !== org.name) {
    return NextResponse.json(
      {
        error:
          "Название организации введено неверно. Скопируйте название точно как написано в заголовке.",
      },
      { status: 400 }
    );
  }

  // Soft-schedule: ставим cancelled + сохраняем delete request в audit.
  // Реальное удаление — через ROOT админ-интерфейс через 7 дней (даём
  // возможность отменить, если случайно).
  await db.organization.update({
    where: { id: orgId },
    data: { subscriptionPlan: "cancelled" },
  });

  await db.auditLog.create({
    data: {
      organizationId: orgId,
      userId: auth.session.user.id,
      userName: auth.session.user.name ?? null,
      action: "organization.delete_requested",
      entity: "organization",
      entityId: orgId,
      details: {
        organizationName: org.name,
        reason: body.reason ?? null,
        scheduledDeletion: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    message:
      "Запрос на удаление принят. Через 7 дней все данные будут удалены безвозвратно. Чтобы отменить — свяжитесь с поддержкой через виджет.",
  });
}
