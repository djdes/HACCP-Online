import { NextResponse, type NextRequest } from "next/server";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { cascadeResponsibleToActiveDocuments } from "@/lib/journal-responsibles-cascade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/settings/journal-responsibles/<code>
 * Body: {
 *   positionIds: string[],
 *   slotUsers?: { [slotId: string]: string | null }
 * }
 *
 *   1. JobPositionJournalAccess — eligibility должностей для bulk-assign.
 *   2. Сохраняет slotUsers в Organization.journalResponsibleUsersJson
 *      (per-slot карта; у каждого журнала своя схема слотов).
 *   3. Каскадно ставит responsibleUserId на ВСЕХ активных документах
 *      этого журнала (берётся primary-slot из schema).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasCapability(session.user, "admin.full")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const { code } = await params;
  const organizationId = getActiveOrgId(session);

  const template = await db.journalTemplate.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Журнал не найден" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const positionIdsRaw = (body as { positionIds?: unknown } | null)?.positionIds;
  const positionIds: string[] = Array.isArray(positionIdsRaw)
    ? positionIdsRaw.filter(
        (p: unknown): p is string => typeof p === "string" && p.length > 0
      )
    : [];

  const slotUsersRaw = (body as { slotUsers?: unknown } | null)?.slotUsers;
  const slotUsers: Record<string, string | null> = {};
  if (slotUsersRaw && typeof slotUsersRaw === "object") {
    for (const [slotId, userId] of Object.entries(
      slotUsersRaw as Record<string, unknown>
    )) {
      if (typeof slotId !== "string") continue;
      slotUsers[slotId] =
        typeof userId === "string" && userId.length > 0 ? userId : null;
    }
  }

  if (positionIds.length > 0) {
    const owned = await db.jobPosition.findMany({
      where: { id: { in: positionIds }, organizationId },
      select: { id: true },
    });
    if (owned.length !== positionIds.length) {
      return NextResponse.json(
        { error: "Некоторые должности не принадлежат организации" },
        { status: 400 }
      );
    }
  }

  // Защита от подмены чужих userId.
  const userIds = Object.values(slotUsers).filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  if (userIds.length > 0) {
    const owned = await db.user.findMany({
      where: {
        id: { in: userIds },
        organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (owned.length !== new Set(userIds).size) {
      return NextResponse.json(
        { error: "Некоторые сотрудники не принадлежат организации" },
        { status: 400 }
      );
    }
  }

  await db.$transaction([
    db.jobPositionJournalAccess.deleteMany({
      where: { templateId: template.id, organizationId },
    }),
    ...(positionIds.length > 0
      ? [
          db.jobPositionJournalAccess.createMany({
            data: positionIds.map((jobPositionId) => ({
              templateId: template.id,
              organizationId,
              jobPositionId,
            })),
          }),
        ]
      : []),
  ]);

  const cascade = await cascadeResponsibleToActiveDocuments({
    organizationId,
    templateId: template.id,
    journalCode: code,
    positionIds,
    slotUsers,
  });

  return NextResponse.json({
    ok: true,
    count: positionIds.length,
    documentsUpdated: cascade.documentsUpdated,
    slotUsers: cascade.savedSlots,
  });
}
