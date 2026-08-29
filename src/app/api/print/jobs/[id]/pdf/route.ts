import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateJournalDocumentPdf } from "@/lib/document-pdf";
import { authenticateAgent } from "@/lib/print-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/print/jobs/<id>/pdf — агент забирает бланк для печати.
 *
 * Отдельным запросом, а не полем в очереди: PDF журнала за месяц весит
 * сотни килобайт, и складывать его в каждую строку очереди (как делает
 * Magday со своими чеками) значило бы раздувать таблицу без нужды. Здесь
 * он собирается на лету тем же кодом, что и кнопка «Скачать PDF».
 *
 * Права журнала здесь НЕ проверяем: их проверил тот, кто нажал «На
 * принтер». Агент — это принтер организации, а не пользователь, своих
 * прав на журналы у него нет и быть не должно.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  }

  const { id } = await params;
  const job = await db.printJob.findFirst({
    where: {
      id,
      agentId: agent.id,
      organizationId: agent.organizationId,
      status: "printing",
    },
    select: { documentId: true },
  });

  if (!job?.documentId) {
    return NextResponse.json({ error: "Задание не найдено" }, { status: 404 });
  }

  try {
    const { buffer, fileName } = await generateJournalDocumentPdf({
      documentId: job.documentId,
      organizationId: agent.organizationId,
    });
    const uint8 = new Uint8Array(buffer);
    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(uint8.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось собрать PDF";
    return NextResponse.json(
      { error: message },
      { status: message === "Документ не найден" ? 404 : 500 },
    );
  }
}
