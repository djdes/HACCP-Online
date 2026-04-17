import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const feedbackSchema = z.object({
  type: z.enum(["bug", "suggestion"], { message: "Выберите тип обращения" }),
  message: z
    .string()
    .trim()
    .min(3, "Сообщение слишком короткое")
    .max(4000, "Сообщение слишком длинное"),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .or(z.literal("")),
});

/**
 * POST /api/feedback
 *
 * Stores an in-app feedback report. Any authenticated user can submit.
 * Snapshots userId/email/name/org at submission time so the record stays
 * useful after a user or org is later deleted (schema has no FKs on purpose).
 */
export async function POST(request: Request) {
  const session = await requireAuth();

  let parsed;
  try {
    parsed = feedbackSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Не удалось прочитать запрос" },
      { status: 400 }
    );
  }

  const orgId = getActiveOrgId(session);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  await db.feedbackReport.create({
    data: {
      userId: session.user.id,
      userEmail: session.user.email ?? null,
      userName: session.user.name ?? null,
      organizationId: orgId || null,
      organizationName: org?.name ?? session.user.organizationName ?? null,
      type: parsed.type,
      message: parsed.message,
      phone: parsed.phone ? parsed.phone : null,
    },
  });

  return NextResponse.json({ ok: true });
}
