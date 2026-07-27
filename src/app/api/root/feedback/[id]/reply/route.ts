import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { upsertNotification } from "@/lib/notifications";

const replySchema = z.object({
  message: z.string().trim().min(1, "Введите текст ответа").max(5000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireRoot();
  const { id } = await params;

  const parsed = replySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const report = await db.feedbackReport.findUnique({ where: { id } });
  if (!report) {
    return NextResponse.json({ error: "Обращение не найдено" }, { status: 404 });
  }

  const respondedAt = new Date();
  const responseMessage = parsed.data.message;
  const updated = await db.feedbackReport.update({
    where: { id },
    data: {
      responseMessage,
      respondedAt,
      respondedById: session.user.id,
      respondedByName: session.user.name ?? session.user.email ?? "Администратор",
    },
  });

  let notified = false;
  if (report.userId && report.organizationId) {
    const recipient = await db.user.findFirst({
      where: {
        id: report.userId,
        organizationId: report.organizationId,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true },
    });
    if (recipient) {
      await upsertNotification({
        organizationId: report.organizationId,
        userId: recipient.id,
        kind: "feedback.reply",
        dedupeKey: `feedback.reply:${report.id}`,
        title: "Получен ответ на ваше обращение",
        items: [{ id: report.id, label: responseMessage }],
      });
      notified = true;
    }
  }

  return NextResponse.json({
    ok: true,
    notified,
    responseMessage: updated.responseMessage,
    respondedAt: updated.respondedAt,
    respondedByName: updated.respondedByName,
  });
}
