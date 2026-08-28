import { NextResponse } from "next/server";
import { renderPaperJournalPdf } from "@/lib/paper-journal-pdf";
import { paperJournalById } from "@/lib/sphere-journal-rules";
import { SAMPLE_ORGANIZATION } from "@/lib/journal-sample-fixtures";
import { clientIp } from "@/lib/client-ip";
import { journalSampleRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Публичный образец бумажного бланка в PDF.
 *
 * Зачем публичный: этим роутом пользуется генератор превью
 * (scripts/render-journal-sample-thumbs.ts) — ровно как электронными
 * образцами. К БД не обращается, шапка — вымышленная «Ромашка», так
 * что отдать чужие данные роут физически не может.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const journal = paperJournalById(id);
  if (!journal) {
    return NextResponse.json({ error: "Бланк не найден" }, { status: 404 });
  }

  const ip = clientIp(request) ?? "unknown";
  if (!journalSampleRateLimiter.consume(`sample:${ip}`)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте через минуту" },
      { status: 429 },
    );
  }

  try {
    const buffer = renderPaperJournalPdf({
      journal,
      organization: SAMPLE_ORGANIZATION,
      rows: [],
      blankRows: 18,
    });

    const inline = new URL(request.url).searchParams.get("inline") === "1";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(
          `obrazec-${journal.id}.pdf`,
        )}`,
        // Бланк детерминирован — пустая таблица с фиксированной шапкой.
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("paper journal sample pdf failed", id, error);
    return NextResponse.json(
      { error: "Не получилось собрать бланк" },
      { status: 500 },
    );
  }
}
