import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permission-presets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/verifications — задачи для проверки заведующей.
 *
 * Возвращает claim'ы со status=completed и verificationStatus=pending или null.
 * Эти задачи ждут одобрения заведующей.
 *
 * Доступ: capability `tasks.verify` (admin + head_chef).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (!hasCapability(session.user, "tasks.verify")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const organizationId = getActiveOrgId(session);

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? "pending"; // pending | approved | rejected | all

  const claims = await db.journalTaskClaim.findMany({
    where: {
      organizationId,
      status: "completed",
      ...(filter === "all"
        ? {}
        : filter === "pending"
          ? {
              OR: [
                { verificationStatus: null },
                { verificationStatus: "pending" },
              ],
            }
          : { verificationStatus: filter }),
    },
    include: {
      user: { select: { id: true, name: true } },
      verifiedBy: { select: { name: true } },
    },
    orderBy: { completedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    items: claims.map((c) => ({
      id: c.id,
      scopeLabel: c.scopeLabel,
      journalCode: c.journalCode,
      executedBy: c.user.name,
      executedById: c.user.id,
      completedAt: c.completedAt,
      verificationStatus: c.verificationStatus,
      verifiedBy: c.verifiedBy?.name ?? null,
      verifiedAt: c.verifiedAt,
      verifierComment: c.verifierComment,
      completionData: c.completionData,
      dateKey: c.dateKey,
    })),
  });
}
