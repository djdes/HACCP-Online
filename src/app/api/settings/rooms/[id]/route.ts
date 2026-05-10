import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { syncRoomChecklistItems } from "@/lib/cleaning-room-checklist-sync";
import { parseScopeSteps, type ScopeStep } from "@/lib/cleaning-document";

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
  // Scope-шаги принимаются в двух форматах:
  //  - legacy: string[]
  //  - new:    Array<{ label: string; requirePhoto?: boolean }>
  // parseScopeSteps в БД нормализует оба к { label, requirePhoto? }.
  currentScope: z
    .array(
      z.union([
        z.string().max(300),
        z.object({
          label: z.string().max(300),
          requirePhoto: z.boolean().optional(),
        }),
      ]),
    )
    .max(50)
    .optional(),
  generalScope: z
    .array(
      z.union([
        z.string().max(300),
        z.object({
          label: z.string().max(300),
          requirePhoto: z.boolean().optional(),
        }),
      ]),
    )
    .max(50)
    .optional(),
  currentDays: z.number().int().min(0).max(127).optional(),
  generalDays: z.number().int().min(0).max(127).optional(),
  // 2026-05-08+ schedule-type per scope + monthly day list.
  currentScheduleType: z.enum(["weekly", "monthly"]).optional(),
  generalScheduleType: z.enum(["weekly", "monthly"]).optional(),
  currentMonthDays: z
    .array(
      z.union([z.string().regex(/^([1-9]|[12][0-9]|3[01]|last)$/), z.literal("last")]),
    )
    .max(31)
    .optional(),
  generalMonthDays: z
    .array(
      z.union([z.string().regex(/^([1-9]|[12][0-9]|3[01]|last)$/), z.literal("last")]),
    )
    .max(31)
    .optional(),
  requirePhoto: z.boolean().optional(),
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

  // Нормализуем scope в единый формат ScopeStep[] (с валидацией label
  // и опциональным requirePhoto). Принятый input может быть смешанный:
  // часть string-ов (legacy), часть объектов — parseScopeSteps это
  // унифицирует.
  const cleanScopeSteps = (
    arr: Array<string | { label: string; requirePhoto?: boolean }> | undefined,
  ): ScopeStep[] | undefined =>
    arr === undefined ? undefined : parseScopeSteps(arr).slice(0, 50);

  // Для checklist-sync нужны только labels (ChecklistItem не хранит
  // requirePhoto — это атрибут pipeline, не самого пункта).
  const labelsOnly = (steps: ScopeStep[] | undefined): string[] | undefined =>
    steps === undefined ? undefined : steps.map((s) => s.label);

  const nextCurrentScope = cleanScopeSteps(body.currentScope);
  const nextGeneralScope = cleanScopeSteps(body.generalScope);

  // Cleaning unification 2026-05-08: при изменении scope — синкаем
  // JournalChecklistItem'ы (TF task-fill подтягивает оттуда чек-лист).
  // Делаем ДО update Room чтобы не оставлять рассинхрона если sync упадёт.
  if (nextCurrentScope !== undefined || nextGeneralScope !== undefined) {
    await syncRoomChecklistItems({
      organizationId: orgId,
      roomId: id,
      currentScope: labelsOnly(nextCurrentScope),
      generalScope: labelsOnly(nextGeneralScope),
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
      ...(nextCurrentScope !== undefined
        ? { currentScope: nextCurrentScope }
        : {}),
      ...(nextGeneralScope !== undefined
        ? { generalScope: nextGeneralScope }
        : {}),
      ...(body.currentDays !== undefined
        ? { currentDays: body.currentDays }
        : {}),
      ...(body.generalDays !== undefined
        ? { generalDays: body.generalDays }
        : {}),
      ...(body.currentScheduleType !== undefined
        ? { currentScheduleType: body.currentScheduleType }
        : {}),
      ...(body.generalScheduleType !== undefined
        ? { generalScheduleType: body.generalScheduleType }
        : {}),
      ...(body.currentMonthDays !== undefined
        ? { currentMonthDays: [...new Set(body.currentMonthDays)] }
        : {}),
      ...(body.generalMonthDays !== undefined
        ? { generalMonthDays: [...new Set(body.generalMonthDays)] }
        : {}),
      ...(body.requirePhoto !== undefined
        ? { requirePhoto: body.requirePhoto }
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
