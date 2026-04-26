import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isManagementRole } from "@/lib/user-roles";
import { normalizePhone } from "@/lib/phone";
import { tryAutolinkTasksflowByPhone } from "@/lib/tasksflow-autolink";
import { recordAuditLog } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/staff/bulk
 *
 * Массовое добавление сотрудников из CSV/Excel-paste. Принимает либо
 * массив `rows`, либо raw `csv`-строку (TSV/CSV — auto-detect разделителя
 * по первой строке).
 *
 * Колонки (обязательны в этом порядке):
 *   ФИО \t Должность \t Телефон
 *
 * Должность матчится по точному имени `JobPosition.name` для текущей
 * org. Если не найдено — строка идёт в `errors`. Если телефон не
 * парсится в +7 — тоже в `errors`. Дубли (по phone в текущей org)
 * skipятся как `skipped`.
 *
 * Идемпотентно: повторная заливка того же CSV увеличит только `skipped`.
 *
 * Body (один из):
 *   { rows: [{ fullName, positionName, phone }, ...] }
 *   { csv: "ФИО\tДолжность\tТелефон\nИван Петров\tПовар\t+7..." }
 *
 * Доступ: management.
 */

const rowSchema = z.object({
  fullName: z.string().trim().min(2),
  positionName: z.string().trim().min(2),
  phone: z.string().trim().min(5),
});

const bodySchema = z.object({
  rows: z.array(rowSchema).optional(),
  csv: z.string().optional(),
});

function parseCsv(raw: string): { rows: z.infer<typeof rowSchema>[]; parseErrors: string[] } {
  const parseErrors: string[] = [];
  const rows: z.infer<typeof rowSchema>[] = [];
  const lines = raw
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Heuristic: если в первой строке есть «\t», это TSV, иначе CSV (`,` или `;`).
  const sample = lines[0] ?? "";
  const sep = sample.includes("\t") ? "\t" : sample.includes(";") ? ";" : ",";

  // Skip header line if it contains «ФИО» / «должность» / «телефон»
  let startIdx = 0;
  if (
    /ФИО|должн|телеф|name|position|phone/i.test(lines[0] ?? "")
  ) {
    startIdx = 1;
  }

  for (let i = startIdx; i < lines.length; i++) {
    const cells = lines[i].split(sep).map((c) => c.trim());
    if (cells.length < 3) {
      parseErrors.push(`Строка ${i + 1}: ожидалось 3 колонки, получено ${cells.length}`);
      continue;
    }
    const [fullName, positionName, phone] = cells;
    rows.push({ fullName, positionName, phone });
  }

  return { rows, parseErrors };
}

function syntheticEmail(orgId: string) {
  const salt = crypto.randomBytes(6).toString("hex");
  return `staff-${salt}@${orgId}.local.haccp`;
}

export async function POST(request: Request) {
  const session = await requireAuth();
  if (!isManagementRole(session.user.role) && !session.user.isRoot) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(session);

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  let rows = body.data.rows ?? [];
  const errors: Array<{ line: number; message: string; raw?: unknown }> = [];

  if (body.data.csv && rows.length === 0) {
    const parsed = parseCsv(body.data.csv);
    rows = parsed.rows;
    parsed.parseErrors.forEach((m, idx) => errors.push({ line: idx, message: m }));
  }

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Не нашёл ни одной строки. Колонки: ФИО / Должность / Телефон." },
      { status: 400 }
    );
  }

  const positions = await db.jobPosition.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, categoryKey: true },
  });
  const posByName = new Map(positions.map((p) => [p.name.toLowerCase(), p]));

  let created = 0;
  let skipped = 0;
  const createdUsers: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const pos = posByName.get(row.positionName.toLowerCase());
    if (!pos) {
      errors.push({
        line: i + 1,
        message: `Должность «${row.positionName}» не найдена. Создайте её сначала или применайте онбординг-шаблон.`,
        raw: row,
      });
      continue;
    }
    const phone = normalizePhone(row.phone);
    if (!phone) {
      errors.push({
        line: i + 1,
        message: `Не разобрал телефон «${row.phone}»`,
        raw: row,
      });
      continue;
    }

    const existing = await db.user.findFirst({
      where: { organizationId: orgId, phone },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const user = await db.user.create({
      data: {
        organizationId: orgId,
        name: row.fullName,
        email: syntheticEmail(orgId),
        passwordHash: "",
        role: pos.categoryKey === "management" ? "manager" : "cook",
        phone,
        jobPositionId: pos.id,
        positionTitle: pos.name,
        isActive: true,
        journalAccessMigrated: false,
      },
      select: { id: true, name: true },
    });
    createdUsers.push(user);
    created++;

    tryAutolinkTasksflowByPhone({
      organizationId: orgId,
      weSetupUserId: user.id,
      phone,
      name: user.name,
    }).catch((err) => console.error("[bulk] autolink failed", err));
  }

  await recordAuditLog({
    request,
    session,
    organizationId: orgId,
    action: "staff.bulk-import",
    entity: "User",
    entityId: null,
    details: {
      attempted: rows.length,
      created,
      skipped,
      errorCount: errors.length,
    },
  });

  return NextResponse.json({
    ok: true,
    created,
    skipped,
    errors,
    createdUsers,
  });
}
