import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isManagementRole } from "@/lib/user-roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Доступ руководителя к организациям аккаунта.
 *
 * Раздавать доступ может только владелец аккаунта: организации делят
 * тариф и лимит мест, и передавать это право дальше — значит потерять
 * контроль над тем, кто видит выручку соседней точки.
 *
 * Домашнюю организацию человека здесь не трогаем: она задана
 * `User.organizationId`, и «отобрать» её через членство нельзя.
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const account = await db.account.findUnique({
    where: { ownerUserId: session.user.id },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json(
      { error: "Доступом к организациям управляет владелец аккаунта" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const organizationId =
    typeof body?.organizationId === "string" ? body.organizationId : "";
  const enabled = body?.enabled === true;
  if (!userId || !organizationId) {
    return NextResponse.json({ error: "Проверьте параметры" }, { status: 400 });
  }

  const [organization, user] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, accountId: true, name: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        organizationId: true,
        organization: { select: { accountId: true } },
      },
    }),
  ]);

  if (!organization || organization.accountId !== account.id) {
    return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  }
  // Чужого человека в свою организацию не пускаем даже владельцу
  // аккаунта: userId приходит из тела запроса, и без этой проверки
  // подставленный id открывал бы доступ постороннему.
  if (!user || user.organization?.accountId !== account.id) {
    return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  }
  // Переключаться между точками имеет смысл только руководству:
  // линейный сотрудник работает в одной, и лишний доступ ему — риск
  // без пользы (см. план: «линейные сотрудники — в одной организации»).
  if (enabled && !isManagementRole(user.role)) {
    return NextResponse.json(
      { error: "Доступ к нескольким организациям — только для руководителей" },
      { status: 400 },
    );
  }
  if (user.organizationId === organizationId) {
    return NextResponse.json(
      { error: "Это домашняя организация сотрудника — доступ и так есть" },
      { status: 400 },
    );
  }

  if (enabled) {
    await db.organizationMember.upsert({
      where: { userId_organizationId: { userId, organizationId } },
      create: { userId, organizationId, role: "manager" },
      update: { role: "manager" },
    });
  } else {
    await db.organizationMember.deleteMany({
      where: { userId, organizationId, role: { not: "owner" } },
    });
  }

  await db.auditLog.create({
    data: {
      organizationId,
      userId: session.user.id,
      userName: session.user.name ?? null,
      action: enabled ? "org.member.added" : "org.member.removed",
      entity: "user",
      entityId: userId,
      details: { organizationName: organization.name, userName: user.name },
    },
  });

  return NextResponse.json({ ok: true });
}
