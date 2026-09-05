import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { loadBuildingContext, setActiveBuildingCookie } from "@/lib/active-building";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { sanitizeMiniAppRedirectPath } from "@/lib/journal-obligation-links";
import { getServerSession } from "@/lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/active-building/go?building=<id>&next=/mini/…
 *
 * Переход по ссылке, которая должна открыться в конкретной точке:
 * обязательство Mini App по точке, отличной от текущей. Ставим cookie и
 * редиректим на `next` (только внутри /mini). Недоступная точка cookie не
 * трогает — человек просто попадает по ссылке в своей текущей точке.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeMiniAppRedirectPath(url.searchParams.get("next") ?? "") ?? "/mini";
  const target = new URL(next, url.origin);

  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.redirect(target);

  const buildingId = url.searchParams.get("building") ?? "";
  if (buildingId) {
    const context = await loadBuildingContext(session);
    const building = context.buildings.find((item) => item.id === buildingId);
    if (context.enabled && building) {
      await setActiveBuildingCookie(getActiveOrgId(session), building.id);
    }
  }
  return NextResponse.redirect(target);
}
