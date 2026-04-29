import { NextResponse, type NextRequest } from "next/server";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/settings/journal-responsibles/<code>
 * Body: { positionIds: string[] }
 *
 * Перезаписывает JobPositionJournalAccess для конкретного шаблона
 * в текущей орге, без побочных эффектов на template.fillMode /
 * defaultAssigneeId / bonusAmountKopecks (в отличие от
 * /api/settings/journals/[code]/distribution, который дёргает всё).
 *
 * Используется страницей /settings/journal-responsibles — там админ
 * хочет тонко править только список ответственных должностей.
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

  return NextResponse.json({ ok: true, count: positionIds.length });
}
