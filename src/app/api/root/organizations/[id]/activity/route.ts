import { NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth-helpers";
import { getOrgActivity } from "@/lib/org-activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/root/organizations/<id>/activity — что организация реально делает.
 *
 * Питает панель, которая открывается кликом по числу записей в метриках.
 * Грузится по требованию, а не вместе со страницей: в метриках сотня
 * организаций, и тянуть ленту каждой ради одной открытой — бессмысленно.
 *
 * ROOT-only, как и вся ветка /api/root (middleware отдаёт 404 остальным),
 * но requireRoot здесь всё равно свой: маршрут отдаёт имена сотрудников
 * чужой организации.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireRoot();
  const { id } = await params;

  const activity = await getOrgActivity(id);
  if (!activity) {
    return NextResponse.json(
      { error: "Организация не найдена" },
      { status: 404 },
    );
  }

  return NextResponse.json(activity);
}
