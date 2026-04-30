import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Phase E — verifier-decisions на уровне всего документа.
 *
 *   POST /api/journal-documents/<id>/verifier
 *   Body:
 *     { decision: "approve-all" }                      — одобрить весь
 *                                                          журнал целиком
 *     { decision: "reject-document", reason: "..." }   — отклонить
 *                                                          целиком (редко)
 *     { decision: "approve-cells", entryIds: [...] }   — одобрить
 *                                                          конкретные ячейки
 *     { decision: "reject-cells", entryIds: [...],
 *       reason: "..." }                                — отклонить
 *                                                          конкретные ячейки
 *
 * Доступ: verifierUserId документа ИЛИ admin.full орги.
 */

const Schema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve-all"),
  }),
  z.object({
    decision: z.literal("reject-document"),
    reason: z.string().min(2).max(500),
  }),
  z.object({
    decision: z.literal("approve-cells"),
    entryIds: z.array(z.string().min(1)).min(1).max(500),
  }),
  z.object({
    decision: z.literal("reject-cells"),
    entryIds: z.array(z.string().min(1)).min(1).max(500),
    reason: z.string().min(2).max(500),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: docId } = await params;
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const orgId = getActiveOrgId(session);

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 },
      );
    }
    throw err;
  }

  const doc = await db.journalDocument.findFirst({
    where: { id: docId, organizationId: orgId },
    select: {
      id: true,
      verifierUserId: true,
      responsibleUserId: true,
      status: true,
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  // Доступ: verifier документа ИЛИ admin.full орги. Если у документа
  // нет verifier'а — fallback на responsibleUserId, чтобы legacy
  // documents можно было закрывать.
  const isVerifier =
    session.user.id === doc.verifierUserId ||
    (doc.verifierUserId === null &&
      session.user.id === doc.responsibleUserId);
  const isAdmin = hasFullWorkspaceAccess({
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  });
  if (!isVerifier && !isAdmin) {
    return NextResponse.json(
      {
        error:
          "Только проверяющий по журналу или администратор может одобрять/отклонять",
      },
      { status: 403 },
    );
  }

  const now = new Date();

  // Helper для разрешения списка entryIds — проверяем что они
  // принадлежат этому документу (multi-tenant scope защищён через
  // doc.organizationId выше).
  async function ownedEntryIds(ids: string[]): Promise<string[]> {
    const owned = await db.journalDocumentEntry.findMany({
      where: { id: { in: ids }, documentId: docId },
      select: { id: true },
    });
    return owned.map((r) => r.id);
  }

  if (body.decision === "approve-all") {
    await db.$transaction([
      db.journalDocumentEntry.updateMany({
        where: { documentId: docId },
        data: {
          verificationStatus: "approved",
          verificationDecidedById: session.user.id,
          verificationDecidedAt: now,
          verificationRejectReason: null,
        },
      }),
      db.journalDocument.update({
        where: { id: docId },
        data: {
          verificationStatus: "approved",
          verificationDecidedById: session.user.id,
          verificationDecidedAt: now,
          verificationRejectReason: null,
        },
      }),
    ]);
    return NextResponse.json({ ok: true, decision: "approve-all" });
  }

  if (body.decision === "reject-document") {
    await db.journalDocument.update({
      where: { id: docId },
      data: {
        verificationStatus: "rejected",
        verificationDecidedById: session.user.id,
        verificationDecidedAt: now,
        verificationRejectReason: body.reason,
      },
    });
    // Push всем заполнителям этого документа — у каждого «весь журнал
    // возвращён». Группируем по уникальному employeeId.
    void (async () => {
      try {
        const { notifyEmployee, escapeTelegramHtml: esc } = await import(
          "@/lib/telegram"
        );
        const employees = await db.journalDocumentEntry.findMany({
          where: { documentId: docId },
          select: {
            employeeId: true,
            document: {
              select: { template: { select: { name: true } } },
            },
          },
          distinct: ["employeeId"],
        });
        const tplName =
          employees[0]?.document.template.name ?? "Журнал";
        for (const e of employees) {
          await notifyEmployee(
            e.employeeId,
            `🔁 <b>Журнал возвращён на доработку целиком</b>\n\n` +
              `Журнал: <b>${esc(tplName)}</b>\n` +
              `Причина: ${esc(body.reason)}\n\n` +
              `Откройте журнал и исправьте записи.`,
          ).catch(() => null);
        }
      } catch (err) {
        console.warn("[verifier reject-document] push batch failed", err);
      }
    })();
    return NextResponse.json({ ok: true, decision: "reject-document" });
  }

  if (body.decision === "approve-cells") {
    const ids = await ownedEntryIds(body.entryIds);
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "Ячейки не найдены" },
        { status: 404 },
      );
    }
    const result = await db.journalDocumentEntry.updateMany({
      where: { id: { in: ids } },
      data: {
        verificationStatus: "approved",
        verificationDecidedById: session.user.id,
        verificationDecidedAt: now,
        verificationRejectReason: null,
      },
    });
    return NextResponse.json({
      ok: true,
      decision: "approve-cells",
      affected: result.count,
    });
  }

  // reject-cells
  const ids = await ownedEntryIds(body.entryIds);
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Ячейки не найдены" },
      { status: 404 },
    );
  }
  // Перед updateMany'ем загружаем employeeId всех затронутых ячеек —
  // нужны для Telegram-push'а филерам.
  const rejectedEntries = await db.journalDocumentEntry.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      employeeId: true,
      date: true,
      employee: { select: { name: true } },
      document: {
        select: {
          template: { select: { code: true, name: true } },
        },
      },
    },
  });
  const result = await db.journalDocumentEntry.updateMany({
    where: { id: { in: ids } },
    data: {
      verificationStatus: "rejected",
      verificationDecidedById: session.user.id,
      verificationDecidedAt: now,
      verificationRejectReason: body.reason,
    },
  });

  // Push сотрудникам — fire-and-forget. Группируем по employee'у чтобы
  // не присылать N раз одному и тому же 5 одновременно отклонённых
  // ячеек: один push с агрегатом «у вас отклонили N ячеек в журнале X».
  void (async () => {
    try {
      const { notifyEmployee, escapeTelegramHtml: esc } = await import(
        "@/lib/telegram"
      );
      const byEmployee = new Map<
        string,
        {
          name: string;
          count: number;
          journalName: string;
          journalCode: string;
        }
      >();
      for (const e of rejectedEntries) {
        const ex = byEmployee.get(e.employeeId);
        if (ex) {
          ex.count += 1;
        } else {
          byEmployee.set(e.employeeId, {
            name: e.employee.name,
            count: 1,
            journalName: e.document.template.name,
            journalCode: e.document.template.code,
          });
        }
      }
      for (const [employeeId, info] of byEmployee) {
        const message =
          `🔁 <b>Запись возвращена на доработку</b>\n\n` +
          `Журнал: <b>${esc(info.journalName)}</b>\n` +
          `Возвращено ячеек: <b>${info.count}</b>\n` +
          `Причина: ${esc(body.reason)}\n\n` +
          `Откройте журнал в WeSetup и исправьте отмеченные ячейки.`;
        await notifyEmployee(employeeId, message).catch((err) =>
          console.warn(
            "[verifier reject-cells] notifyEmployee failed",
            err instanceof Error ? err.message : err,
          ),
        );
      }
    } catch (err) {
      console.warn("[verifier reject-cells] push batch failed", err);
    }
  })();

  return NextResponse.json({
    ok: true,
    decision: "reject-cells",
    affected: result.count,
  });
}

/**
 * Состояние проверки документа: счётчики ячеек по статусам.
 *
 *   GET /api/journal-documents/<id>/verifier
 *     200 → { docStatus, totals: { pending, approved, rejected, all } }
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: docId } = await params;
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const orgId = getActiveOrgId(auth.session);

  const doc = await db.journalDocument.findFirst({
    where: { id: docId, organizationId: orgId },
    select: {
      id: true,
      verifierUserId: true,
      responsibleUserId: true,
      verificationStatus: true,
      verificationDecidedAt: true,
      verificationRejectReason: true,
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
  }

  const all = await db.journalDocumentEntry.count({
    where: { documentId: docId },
  });
  const approved = await db.journalDocumentEntry.count({
    where: { documentId: docId, verificationStatus: "approved" },
  });
  const rejected = await db.journalDocumentEntry.count({
    where: { documentId: docId, verificationStatus: "rejected" },
  });
  const pending = all - approved - rejected;

  return NextResponse.json({
    docStatus: doc.verificationStatus,
    rejectReason: doc.verificationRejectReason,
    totals: { all, approved, rejected, pending },
  });
}
