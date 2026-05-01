import { NextResponse, type NextRequest } from "next/server";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/journals/traceability?batchKey=XYZ
 *
 * Возвращает все JournalEntry с этим batchKey в текущей организации.
 * Используется в UI для показа «истории партии»: где принято → как
 * приготовлено → когда отпущено / списано.
 *
 * Это ХАССП-требование (ТР ТС 021/2011 «Прослеживаемость продукции»):
 * по любому идентификатору партии нужно за минуту восстановить весь
 * её путь от поступления до отпуска.
 */
export async function GET(request: NextRequest) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const organizationId = getActiveOrgId(session);

  const batchKey = request.nextUrl.searchParams.get("batchKey")?.trim();
  if (!batchKey) {
    return NextResponse.json(
      { error: "Параметр batchKey обязателен" },
      { status: 400 },
    );
  }
  if (batchKey.length > 100) {
    return NextResponse.json(
      { error: "batchKey слишком длинный" },
      { status: 400 },
    );
  }

  const entries = await db.journalEntry.findMany({
    where: {
      organizationId,
      batchKey,
    },
    select: {
      id: true,
      data: true,
      createdAt: true,
      filledBy: { select: { id: true, name: true } },
      template: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  return NextResponse.json({
    batchKey,
    count: entries.length,
    entries: entries.map((e) => ({
      id: e.id,
      journalCode: e.template.code,
      journalName: e.template.name,
      createdAt: e.createdAt.toISOString(),
      filledBy: e.filledBy.name,
      data: e.data,
    })),
  });
}
