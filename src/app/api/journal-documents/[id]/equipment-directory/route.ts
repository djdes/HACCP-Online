import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ensureDefaultArea } from "@/lib/equipment-directory";

/**
 * «Добавить в справочник» из окна строки журнала (ППР, поверка, поломки).
 *
 * ПОЧЕМУ отдельная ручка, а не `POST /api/equipment`: та требует `areaId`,
 * которого в окне журнала нет. Здесь цех подбирается так же, как у
 * холодильного журнала (`ensureDefaultArea`), — человек вписал название и
 * получил единицу с QR, не уходя в настройки.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;
  const organizationId = getActiveOrgId(session);
  const document = await db.journalDocument.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  if (!document || document.organizationId !== organizationId) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    name?: unknown;
    type?: unknown;
  };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) {
    return NextResponse.json({ error: "Название обязательно" }, { status: 400 });
  }

  // Повторное нажатие не должно плодить дубли справочника.
  const existing = await db.equipment.findFirst({
    where: { name, area: { organizationId } },
    select: { id: true, name: true },
  });
  if (existing) {
    return NextResponse.json({ equipment: existing, created: false });
  }

  const areaId = await ensureDefaultArea(organizationId);
  const created = await db.equipment.create({
    data: {
      name,
      type: typeof body.type === "string" && body.type.trim() ? body.type.trim() : "other",
      areaId,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ equipment: created, created: true }, { status: 201 });
}
