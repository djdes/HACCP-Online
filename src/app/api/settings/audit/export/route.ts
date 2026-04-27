import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/settings/audit/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Возвращает CSV (UTF-8 BOM, разделитель «;») со всеми AuditLog
 * записями за период. Для compliance-аудита: РПН/ХАССП-аудитор
 * просит выгрузку «кто что делал за полгода» — теперь один тап.
 *
 * Колонки:
 *   Дата | Действие | Сущность | Кто | Email | IP | Детали (JSON)
 *
 * Auth: management.
 *
 * Default: последние 90 дней если from/to не указаны.
 */

function csvEscape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  if (!hasFullWorkspaceAccess(auth.session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(auth.session);

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const now = new Date();
  const from = fromStr
    ? new Date(`${fromStr}T00:00:00.000Z`)
    : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const to = toStr
    ? new Date(`${toStr}T23:59:59.999Z`)
    : now;

  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    return NextResponse.json(
      { error: "Некорректные from/to" },
      { status: 400 }
    );
  }

  const rows = await db.auditLog.findMany({
    where: {
      organizationId: orgId,
      createdAt: { gte: from, lte: to },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
    select: {
      createdAt: true,
      action: true,
      entity: true,
      entityId: true,
      userName: true,
      userId: true,
      ipAddress: true,
      details: true,
    },
  });

  const headers = [
    "Дата",
    "Действие",
    "Сущность",
    "ID объекта",
    "Кто",
    "User ID",
    "IP",
    "Детали (JSON)",
  ];

  const lines: string[] = [headers.map(csvEscape).join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt
          .toISOString()
          .replace("T", " ")
          .replace(/\.\d+Z$/, ""),
        r.action,
        r.entity,
        r.entityId ?? "",
        r.userName ?? "",
        r.userId ?? "",
        r.ipAddress ?? "",
        r.details ? JSON.stringify(r.details) : "",
      ]
        .map(csvEscape)
        .join(";")
    );
  }

  // BOM — для корректного открытия в Excel.
  const csv = "﻿" + lines.join("\r\n");

  const fromKey = from.toISOString().slice(0, 10);
  const toKey = to.toISOString().slice(0, 10);
  const filename = `audit-${orgId.slice(0, 8)}-${fromKey}-to-${toKey}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
