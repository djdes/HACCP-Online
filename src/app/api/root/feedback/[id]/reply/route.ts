import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRoot } from "@/lib/auth-helpers";
import { applyFeedbackReply, FeedbackReplyError } from "@/lib/feedback-reply";

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

  // Вся доставка (колокольчик + Telegram + почта) живёт в общем модуле:
  // тот же путь используется, когда владелец отвечает реплаем из бота.
  try {
    const result = await applyFeedbackReply({
      reportId: id,
      message: parsed.data.message,
      respondedById: session.user.id,
      respondedByName:
        session.user.name ?? session.user.email ?? "Администратор",
    });

    return NextResponse.json({
      ok: true,
      channels: result.channels,
      notified: Object.values(result.channels).some(Boolean),
      responseMessage: result.responseMessage,
      respondedAt: result.respondedAt,
      respondedByName: result.respondedByName,
    });
  } catch (error) {
    if (error instanceof FeedbackReplyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("[feedback-reply] route failed:", error);
    return NextResponse.json(
      { error: "Не удалось отправить ответ" },
      { status: 500 },
    );
  }
}
