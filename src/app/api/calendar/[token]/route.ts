import { NextResponse } from "next/server";

import { collectCalendarEvents } from "@/lib/calendar/events";
import { buildIcs } from "@/lib/calendar/ics";
import { resolveCalendarUser } from "@/lib/calendar/token";
import { createRateLimiter } from "@/lib/rate-limit";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Календари опрашивают ленту сами, но не чаще раза в несколько минут;
// 30 запросов в минуту на токен — с запасом, а перебор токенов режется.
const limiter = createRateLimiter({ tokensPerInterval: 30, intervalMs: 60 * 1000 });

/** GET /api/calendar/<token>.ics — лента iCalendar без сессии, по личному токену. */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
  if (!limiter.consume(`calendar:${token.slice(0, 16)}`)) {
    return new NextResponse("Too many requests", { status: 429 });
  }
  const user = await resolveCalendarUser(token);
  if (!user || !user.isActive || !hasFullWorkspaceAccess(user)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const events = await collectCalendarEvents(user.organizationId);
  const body = buildIcs(events, { calendarName: `WeSetup — ${user.organization.name}`, now: new Date() });
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="wesetup.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
