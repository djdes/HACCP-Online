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
 *   responsibleUserId?: string | null  // конкретный сотрудник
 * }
 *
 * Сохраняет:
 *   1. JobPositionJournalAccess — eligibility должностей для bulk-assign.
 *   2. Каскадно ставит responsibleUserId на ВСЕХ активных документах
 *      этого журнала (текущая орга). Юзер просил «всё сразу же
 *      заполнялось в документ» — это про этот шаг.
 *
 * Если responsibleUserId не передан — подбирается первый подходящий
 * сотрудник из выбранных должностей (alphabetical), чтобы документ
 * сразу получил конкретного ответственного.
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

  const responsibleUserIdRaw = (body as { responsibleUserId?: unknown } | null)
    ?.responsibleUserId;
  const responsibleUserId: string | null =
    typeof responsibleUserIdRaw === "string" && responsibleUserIdRaw.length > 0
      ? responsibleUserIdRaw
      : null;

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

  // Каскад в активные документы — мгновенный эффект «появилось в шапке
  // печатной версии и на странице документа».
  const cascade = await cascadeResponsibleToActiveDocuments({
    organizationId,
    templateId: template.id,
    positionIds,
    responsibleUserId,
  });

  return NextResponse.json({
    ok: true,
    count: positionIds.length,
    documentsUpdated: cascade.documentsUpdated,
    pickedUserId: cascade.pickedUserId,
  });
}
