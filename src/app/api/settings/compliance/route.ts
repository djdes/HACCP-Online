import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

/**
 * PATCH /api/settings/compliance
 *
 * Body: { requireAdminForJournalEdit?: boolean }
 *
 * Management-only. Updates the org-wide compliance toggles (currently
 * just one flag — gating who can re-open a completed journal task). We
 * accept a partial body so future flags can be added without breaking
 * older clients.
 */
export async function PATCH(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        requireAdminForJournalEdit?: unknown;
        shiftEndHour?: unknown;
        lockPastDayEdits?: unknown;
      }
    | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const data: {
    requireAdminForJournalEdit?: boolean;
    shiftEndHour?: number;
    lockPastDayEdits?: boolean;
  } = {};
  if (typeof body.requireAdminForJournalEdit === "boolean") {
    data.requireAdminForJournalEdit = body.requireAdminForJournalEdit;
  }
  if (typeof body.shiftEndHour === "number") {
    const h = Math.floor(body.shiftEndHour);
    if (h < 0 || h > 23) {
      return NextResponse.json(
        { error: "shiftEndHour должен быть от 0 до 23" },
        { status: 400 }
      );
    }
    data.shiftEndHour = h;
  }
  if (typeof body.lockPastDayEdits === "boolean") {
    data.lockPastDayEdits = body.lockPastDayEdits;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Нет полей для обновления" },
      { status: 400 }
    );
  }

  const updated = await db.organization.update({
    where: { id: getActiveOrgId(session) },
    data,
    select: {
      requireAdminForJournalEdit: true,
      shiftEndHour: true,
      lockPastDayEdits: true,
    },
  });

  return NextResponse.json(updated);
}
