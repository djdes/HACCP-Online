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
 *
 * Location — относительный: за nginx `request.url` приходит как
 * `http://localhost:3002/…`, и абсолютный адрес увёл бы на localhost.
 */
function relativeRedirect(next: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { Location: next } });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeMiniAppRedirectPath(url.searchParams.get("next") ?? "") ?? "/mini";

  const session = await getServerSession(authOptions);
  if (!session) return relativeRedirect(next);

  const buildingId = url.searchParams.get("building") ?? "";
  if (buildingId) {
    const context = await loadBuildingContext(session);
    const building = context.buildings.find((item) => item.id === buildingId);
    if (context.enabled && building) {
      await setActiveBuildingCookie(getActiveOrgId(session), building.id);
    }
  }
  return relativeRedirect(next);
}
