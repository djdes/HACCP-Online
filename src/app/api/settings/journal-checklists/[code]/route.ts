import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings/journal-checklists/[code] — список не-архивных
 * пунктов чек-листа для журнала. Доступно админу/руководителю.
 *
 * POST — создать новый пункт. Body: {label, required?, hint?}.
 *        sortOrder автоматически = max + 1.
 */
const CreateBody = z.object({
  label: z.string().min(1).max(200),
  required: z.boolean().optional(),
  hint: z.string().max(500).optional(),
  /** Опционально привязка к комнате (для cleaning-журналов). */
  roomId: z.string().nullable().optional(),
  /** "daily" (default) | "weekly" | "monthly" */
  frequency: z.enum(["daily", "weekly", "monthly"]).optional(),
  /** Дни недели для frequency=weekly (1=Пн ... 7=Вс). */
  weekDays: z.array(z.number().int().min(1).max(7)).optional(),
  /** День месяца для frequency=monthly (1-31). */
  monthDay: z.number().int().min(1).max(31).nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const organizationId = getActiveOrgId(session);
  const { code } = await params;

  // Фильтр по roomId через query-string. ?roomId=null → только общие
  // (roomId IS NULL). ?roomId=<id> → пункты для этой комнаты.
  // Без параметра → все пункты журнала (общие + per-room).
  const url = new URL(request.url);
  const roomFilter = url.searchParams.get("roomId");
  const where: { organizationId: string; journalCode: string; archivedAt: null; roomId?: string | null } = {
    organizationId,
    journalCode: code,
    archivedAt: null,
  };
  if (roomFilter !== null) {
    where.roomId = roomFilter === "null" ? null : roomFilter;
  }

  const items = await db.journalChecklistItem.findMany({
    where,
    orderBy: [{ roomId: "asc" }, { sortOrder: "asc" }],
  });
  // Подгружаем имена комнат для UI чтобы не дёргать отдельным запросом.
  const roomIds = [
    ...new Set(items.map((i) => i.roomId).filter((id): id is string => Boolean(id))),
  ];
  const rooms = roomIds.length
    ? await db.room.findMany({
        where: { id: { in: roomIds } },
        select: { id: true, name: true, kind: true },
      })
    : [];
  const roomNameById = Object.fromEntries(rooms.map((r) => [r.id, r.name]));
  return NextResponse.json({ items, rooms, roomNameById });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasCapability(session.user, "admin.full")) {
    return NextResponse.json({ error: "Нет прав" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);
  const { code } = await params;

  const body = await request.json().catch(() => null);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Неверный формат тела запроса", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // sortOrder = next after max в этой room-scope (или общем).
  const targetRoomId = parsed.data.roomId ?? null;
  const lastItem = await db.journalChecklistItem.findFirst({
    where: {
      organizationId,
      journalCode: code,
      archivedAt: null,
      roomId: targetRoomId,
    },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const sortOrder = (lastItem?.sortOrder ?? -1) + 1;

  const item = await db.journalChecklistItem.create({
    data: {
      organizationId,
      journalCode: code,
      roomId: targetRoomId,
      label: parsed.data.label.trim(),
      required: parsed.data.required ?? true,
      hint: parsed.data.hint?.trim() || null,
      frequency: parsed.data.frequency ?? "daily",
      weekDays: parsed.data.weekDays ?? [],
      monthDay: parsed.data.monthDay ?? null,
      sortOrder,
      createdByUserId: session.user.id,
    },
  });

  await recordAuditLog({
    request,
    session,
    organizationId,
    action: "checklist.item.create",
    entity: "JournalChecklistItem",
    entityId: item.id,
    details: {
      journalCode: code,
      roomId: item.roomId,
      label: item.label,
      required: item.required,
      hint: item.hint,
      frequency: item.frequency,
      weekDays: item.weekDays,
      monthDay: item.monthDay,
    },
  });

  return NextResponse.json({ item });
}
