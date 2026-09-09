import { NextResponse } from "next/server";

import { renderBadgeSvg } from "@/lib/badge/render";
import { getBadgeStatusByCode } from "@/lib/badge/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /b/<code>/badge.svg — картинка бейджа для вставки на сайт организации. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const status = await getBadgeStatusByCode(code);
  if (!status) {
    return new NextResponse(renderBadgeSvg({ percent: null }), {
      status: 404,
      headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  return new NextResponse(renderBadgeSvg({ percent: status.percent, days: status.days }), {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
    },
  });
}
