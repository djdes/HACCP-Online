import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { syncRoomChecklistItems } from "@/lib/cleaning-room-checklist-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  kind: z
    .enum(["guest", "kitchen", "wash", "bar", "storage", "other"])
    .optional(),
  sortOrder: z.number().int().optional(),
  // Cleaning unification: scope/days/detergent теперь хранятся на Room.
  // См. docs/superpowers/specs/2026-05-08-cleaning-unification.md
  detergent: z.string().max(500).optional().nullable(),
  currentScope: z.array(z.string().max(300)).max(50).optional(),
  generalScope: z.array(z.string().max(300)).max(50).optional(),
  currentDays: z.number().int().min(0).max(127).optional(),
  generalDays: z.number().int().min(0).max(127).optional(),
});

type Ctx = { params: Promise<{ id: string }> };

async function ensureOwn(orgId: string, roomId: string) {
  const r = await db.room.findFirst({
    where: { id: roomId, building: { organizationId: orgId } },
    select: { id: true },
  });
  return Boolean(r);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(auth.session);
  const { id } = await ctx.params;
  if (!(await ensureOwn(orgId, id))) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  let body: z.infer<typeof UpdateSchema>;
  try {
    body = UpdateSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 }
      );
    }
    throw err;
  }

  const cleanScope = (arr: string[] | undefined) =>
    arr === undefined
      ? undefined
      : arr.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 50);

  // Cleaning unification 2026-05-08: при изменении scope — синкаем
  // JournalChecklistItem'ы (TF task-fill подтягивает оттуда чек-лист).
  // Делаем ДО update Room чтобы не оставлять рассинхрона если sync упадёт.
  if (body.currentScope !== undefined || body.generalScope !== undefined) {
    await syncRoomChecklistItems({
      organizationId: orgId,
      roomId: id,
      currentScope: body.currentScope,
      generalScope: body.generalScope,
      createdByUserId: auth.session.user.id,
    });
  }

  const updated = await db.room.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.kind !== undefined ? { kind: body.kind } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.detergent !== undefined
        ? { detergent: body.detergent ?? "" }
        : {}),
      ...(body.currentScope !== undefined
        ? { currentScope: cleanScope(body.currentScope) ?? [] }
        : {}),
      ...(body.generalScope !== undefined
        ? { generalScope: cleanScope(body.generalScope) ?? [] }
        : {}),
      ...(body.currentDays !== undefined
        ? { currentDays: body.currentDays }
        : {}),
      ...(body.generalDays !== undefined
        ? { generalDays: body.generalDays }
        : {}),
    },
  });
  return NextResponse.json({ room: updated });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(auth.session);
  const { id } = await ctx.params;
  if (!(await ensureOwn(orgId, id))) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  await db.room.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
