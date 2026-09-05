import { NextResponse } from "next/server";
import { loadBuildingContext, setActiveBuildingCookie } from "@/lib/active-building";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const switchLimiter = createRateLimiter({
  tokensPerInterval: 30,
  intervalMs: 60_000,
});

/**
 * POST /api/me/active-building { buildingId } — выбрать точку, в
 * которой человек работает сейчас (переключатель в шапке и в Mini App).
 *
 * Точка проверяется по контексту запроса: она должна принадлежать
 * активной организации и входить в точки сотрудника. Путь `/api/me/*`
 * входит в allowlist записи для партнёров уровня «просмотр», поэтому
 * партнёр в кабинете клиента переключает точки без отдельных прав.
 */
export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  if (!switchLimiter.consume(session.user.id)) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите немного." },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { buildingId?: unknown }
    | null;
  const buildingId = typeof body?.buildingId === "string" ? body.buildingId : "";
  if (!buildingId) {
    return NextResponse.json({ error: "Не указана точка" }, { status: 400 });
  }

  const context = await loadBuildingContext(session);
  if (!context.enabled) {
    return NextResponse.json(
      { error: "В организации не включены точки" },
      { status: 400 },
    );
  }
  const building = context.buildings.find((item) => item.id === buildingId);
  if (!building) {
    return NextResponse.json({ error: "Нет доступа к этой точке" }, { status: 403 });
  }

  const organizationId = getActiveOrgId(session);
  await setActiveBuildingCookie(organizationId, building.id);
  // В аккаунт — чтобы на другом устройстве открылась та же точка.
  await db.user
    .update({ where: { id: session.user.id }, data: { lastActiveBuildingId: building.id } })
    .catch(() => {});

  await db.auditLog
    .create({
      data: {
        organizationId,
        userId: session.user.id,
        userName: session.user.name ?? null,
        action: "building.switched",
        entity: "building",
        entityId: building.id,
        details: { name: building.name },
      },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true, building });
}
