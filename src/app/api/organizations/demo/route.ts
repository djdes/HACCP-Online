import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  createDemoOrganization,
  deleteDemoOrganization,
} from "@/lib/demo-organization";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { ORG_SPHERE_VALUES } from "@/lib/validators";
import { rewriteSessionClaims } from "@/lib/session-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  sphere: z.enum(ORG_SPHERE_VALUES).default("restaurant"),
});

/**
 * Демо-организация аккаунта — одна на аккаунт, id клиенту знать не надо.
 * Только владелец аккаунта: демо создаётся внутри его аккаунта (в тарифе
 * не считается, но переключатель и список организаций — его).
 */
async function requireAccountOwner() {
  const auth = await requireApiAuth();
  if (!auth.ok) return { ok: false as const, response: auth.response };
  const { session } = auth;

  if (!hasFullWorkspaceAccess(session.user)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Нет доступа" }, { status: 403 }),
    };
  }

  const account = await db.account.findUnique({
    where: { ownerUserId: session.user.id },
    select: { id: true },
  });
  if (!account) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Демо-организацию может создать только владелец аккаунта" },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, session, account };
}

/**
 * POST /api/organizations/demo — создать демо со сферой из анкеты и сразу
 * переключить человека в него. Если живое демо уже есть — просто
 * переключаем (created=false).
 */
export async function POST(request: Request) {
  const guard = await requireAccountOwner();
  if (!guard.ok) return guard.response;
  const { session, account } = guard;

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Проверьте поля" },
      { status: 400 },
    );
  }

  const t0 = Date.now();
  const result = await createDemoOrganization({
    accountId: account.id,
    ownerUserId: session.user.id,
    sphere: parsed.data.sphere,
  });

  if (result.created) {
    await db.auditLog.create({
      data: {
        organizationId: result.organizationId,
        userId: session.user.id,
        userName: session.user.name ?? null,
        action: "org.demo.created",
        entity: "organization",
        entityId: result.organizationId,
        details: {
          sphere: parsed.data.sphere,
          ...(result.seed ?? {}),
          durationMs: Date.now() - t0,
        },
      },
    });
  }

  await rewriteSessionClaims({ activeOrganizationId: result.organizationId });
  await db.user.update({
    where: { id: session.user.id },
    data: { lastActiveOrganizationId: result.organizationId },
  });

  return NextResponse.json({
    ok: true,
    organizationId: result.organizationId,
    created: result.created,
  });
}

/**
 * DELETE /api/organizations/demo — удалить демо аккаунта. Если человек
 * сейчас внутри демо — возвращаем его в домашнюю организацию, чтобы
 * следующий запрос не упал на несуществующий activeOrganizationId.
 */
export async function DELETE() {
  const guard = await requireAccountOwner();
  if (!guard.ok) return guard.response;
  const { session, account } = guard;

  const demo = await db.organization.findFirst({
    where: { accountId: account.id, isDemo: true },
    select: { id: true, name: true },
  });
  if (!demo) {
    return NextResponse.json({ error: "Демо-организации нет" }, { status: 404 });
  }

  const wasActive = getActiveOrgId(session) === demo.id;
  const homeOrgId = session.user.organizationId;

  const counts = await deleteDemoOrganization(demo.id);

  if (wasActive) {
    await rewriteSessionClaims({ activeOrganizationId: homeOrgId });
  }
  await db.user.update({
    where: { id: session.user.id },
    data: { lastActiveOrganizationId: homeOrgId },
  });

  await db.auditLog.create({
    data: {
      organizationId: homeOrgId,
      userId: session.user.id,
      userName: session.user.name ?? null,
      action: "org.demo.deleted",
      entity: "organization",
      entityId: demo.id,
      details: { name: demo.name, ...counts },
    },
  });

  return NextResponse.json({ ok: true, ...counts });
}
