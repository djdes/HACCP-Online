import { NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/root/organizations/[id]
 *
 * ROOT-only удаление организации со всеми зависимостями (cascade на
 * Prisma-уровне покрывает users, journals, telegram-логи и т.д.).
 *
 * Безопасность:
 *   - 401 если не авторизован, 403 если не root.
 *   - 404 если организация не найдена.
 *   - Защита от удаления platform-org (id из PLATFORM_ORG_ID).
 *   - Запись в AuditLog (organizationId платформы).
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireRoot();
  const { id } = await context.params;

  const platformOrgId = (process.env.PLATFORM_ORG_ID ?? "").trim();
  if (platformOrgId && id === platformOrgId) {
    return NextResponse.json(
      { error: "Нельзя удалить platform-organization" },
      { status: 400 }
    );
  }

  const org = await db.organization.findUnique({
    where: { id },
    select: { id: true, name: true, type: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  }

  await db.organization.delete({ where: { id } });

  // AuditLog требует organizationId — пишем в platform-org, чтобы запись
  // была видна root-у на /root/audit. Если platform-org нет — пропускаем.
  if (platformOrgId) {
    await recordAuditLog({
      request,
      session: {
        user: {
          id: session.user.id,
          name: session.user.name ?? null,
          email: session.user.email ?? null,
        },
      },
      organizationId: platformOrgId,
      action: "root.organization.delete",
      entity: "Organization",
      entityId: id,
      details: { name: org.name, type: org.type },
    });
  }

  return NextResponse.json({ ok: true });
}
