import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/organizations/auto-journals
 * Body: { codes: string[] }
 *
 * Сохраняет список templateCode'ов, для которых cron каждый день
 * проверяет наличие активного документа и создаёт новый на текущий
 * месяц если нет. Managed через /settings/auto-journals.
 */
const bodySchema = z.object({
  codes: z.array(z.string().min(1)),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (
    !hasFullWorkspaceAccess({
      role: session.user.role,
      isRoot: session.user.isRoot,
    })
  ) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Некорректный список" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Некорректный список" }, { status: 400 });
  }
  const organizationId = getActiveOrgId(session);
  const unique = Array.from(new Set(parsed.codes));
  await db.organization.update({
    where: { id: organizationId },
    data: { autoJournalCodes: unique },
  });
  return NextResponse.json({ codes: unique });
}
