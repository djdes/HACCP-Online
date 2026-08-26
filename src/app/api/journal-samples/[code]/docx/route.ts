import { NextResponse } from "next/server";
import {
  isDocxSampleCode,
  renderJournalDocumentDocx,
} from "@/lib/document-docx";
import {
  buildJournalSampleInput,
  isSampleJournalCode,
} from "@/lib/journal-sample-fixtures";
import { clientIp } from "@/lib/client-ip";
import { journalSampleRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Публичный образец журнала в DOCX — для тех, кто хочет дописать
 * бланк в Word. Собирается не для всех журналов: см. DOCX_SAMPLE_CODES.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!isSampleJournalCode(code) || !isDocxSampleCode(code)) {
    return NextResponse.json(
      { error: "Для этого журнала образец есть только в PDF" },
      { status: 404 }
    );
  }

  const ip = clientIp(request) ?? "unknown";
  if (!journalSampleRateLimiter.consume(`sample:${ip}`)) {
    return NextResponse.json(
      { error: "Слишком много запросов. Попробуйте через минуту" },
      { status: 429 }
    );
  }

  try {
    const { buffer, fileName } = await renderJournalDocumentDocx(
      buildJournalSampleInput(code),
      code
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("journal sample docx failed", code, error);
    return NextResponse.json(
      { error: "Не получилось собрать образец" },
      { status: 500 }
    );
  }
}
