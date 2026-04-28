import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import {
  parseJournalPeriodsJson,
  type JournalPeriodOverrideMap,
} from "@/lib/journal-period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET — текущая map переопределений периода per-template
 *       { [code]: { kind, days? } }.
 *
 * PUT — заменяет map целиком. Body:
 *       { periods: { [code]: { kind, days? } } }.
 *       kind ∈ "monthly" | "yearly" | "half-monthly" | "single-day"
 *               | "perpetual" | "days".
 *       Для kind="days" обязателен days ∈ [1..31].
 */
const Schema = z.object({
  periods: z.record(
    z.string(),
    z.object({
      kind: z.enum([
        "monthly",
        "yearly",
        "half-monthly",
        "single-day",
        "perpetual",
        "days",
      ]),
      days: z.number().int().min(1).max(31).optional(),
    })
  ),
});

export async function GET() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(auth.session);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { journalPeriods: true },
  });
  const periods = parseJournalPeriodsJson(org?.journalPeriods ?? null);
  return NextResponse.json({ periods });
}

export async function PUT(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(auth.session);

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 }
      );
    }
    throw err;
  }

  // Валидация days для kind="days".
  for (const [code, entry] of Object.entries(body.periods)) {
    if (entry.kind === "days") {
      if (!entry.days || entry.days < 1 || entry.days > 31) {
        return NextResponse.json(
          {
            error: `${code}: для режима «по N дней» нужно число дней 1–31`,
          },
          { status: 400 }
        );
      }
    }
  }

  const map: JournalPeriodOverrideMap = body.periods;
  await db.organization.update({
    where: { id: orgId },
    data: { journalPeriods: map },
  });

  return NextResponse.json({ ok: true, periods: map });
}
