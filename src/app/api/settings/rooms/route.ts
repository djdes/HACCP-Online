import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  buildingId: z.string().min(1),
  name: z.string().trim().min(1, "Название обязательно").max(120),
  kind: z
    .enum(["guest", "kitchen", "wash", "bar", "storage", "other"])
    .default("other"),
  sortOrder: z.number().int().optional(),
});

/** POST — создать помещение в указанном здании. */
export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(auth.session);

  let body: z.infer<typeof CreateSchema>;
  try {
    body = CreateSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 }
      );
    }
    throw err;
  }

  const building = await db.building.findFirst({
    where: { id: body.buildingId, organizationId: orgId },
    select: { id: true },
  });
  if (!building) {
    return NextResponse.json(
      { error: "Здание не найдено в этой организации" },
      { status: 404 }
    );
  }

  const exists = await db.room.findFirst({
    where: { buildingId: body.buildingId, name: body.name },
    select: { id: true },
  });
  if (exists) {
    return NextResponse.json(
      { error: "Помещение с таким названием уже есть в здании" },
      { status: 409 }
    );
  }

  const created = await db.room.create({
    data: {
      buildingId: body.buildingId,
      name: body.name,
      kind: body.kind,
      sortOrder: body.sortOrder ?? 0,
    },
  });
  return NextResponse.json({ room: created });
}
