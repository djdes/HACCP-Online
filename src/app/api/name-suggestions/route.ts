import { NextResponse } from "next/server";

import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import {
  NAME_SUGGESTION_LIMIT,
  isNameSuggestionScope,
  normalizeSuggestionValue,
} from "@/lib/name-suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Память наименований организации для выпадающих списков окон журналов.
 *
 *   GET  ?scope=dish|product        → { values: string[] } — последние сверху
 *   POST { scope, values: string[] } → запомнить (upsert, поднять наверх)
 *
 * Доступ — любой сотрудник организации: строки в журналы вносит линейный
 * персонал, и подсказки нужны именно ему.
 */
export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const scope = new URL(request.url).searchParams.get("scope");
  if (!isNameSuggestionScope(scope)) {
    return NextResponse.json({ error: "Неизвестная область наименований" }, { status: 400 });
  }
  const rows = await db.nameSuggestion.findMany({
    where: { organizationId: getActiveOrgId(auth.session), scope },
    orderBy: [{ lastUsedAt: "desc" }, { useCount: "desc" }],
    take: NAME_SUGGESTION_LIMIT,
    select: { value: true },
  });
  return NextResponse.json({ values: rows.map((row) => row.value) });
}

export async function POST(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const body = (await request.json().catch(() => null)) as { scope?: unknown; values?: unknown } | null;
  if (!body || !isNameSuggestionScope(body.scope)) {
    return NextResponse.json({ error: "Неизвестная область наименований" }, { status: 400 });
  }
  const values = Array.from(
    new Set(
      (Array.isArray(body.values) ? body.values : [])
        .map(normalizeSuggestionValue)
        .filter((value): value is string => value !== null)
    )
  ).slice(0, 50);
  if (values.length === 0) return NextResponse.json({ saved: 0 });

  const organizationId = getActiveOrgId(auth.session);
  const now = new Date();
  await Promise.all(
    values.map((value) =>
      db.nameSuggestion.upsert({
        where: { organizationId_scope_value: { organizationId, scope: body.scope as string, value } },
        create: { organizationId, scope: body.scope as string, value, lastUsedAt: now },
        update: { lastUsedAt: now, useCount: { increment: 1 } },
      })
    )
  );
  return NextResponse.json({ saved: values.length });
}
