import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { aclActorFromSession, hasJournalAccess } from "@/lib/journal-acl";
import { generateJournalDocumentPdf } from "@/lib/document-pdf";

function wantsBrowserPage(request: Request) {
  const accept = request.headers.get("accept") || "";
  const destination = request.headers.get("sec-fetch-dest") || "";
  return destination === "document" || accept.includes("text/html");
}

function buildPdfErrorResponse(request: Request, message: string, status: number) {
  if (wantsBrowserPage(request)) {
    const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Ошибка печати</title>
    <style>
      body { font-family: Arial, sans-serif; background:#f5f7fb; color:#111827; margin:0; }
      .card { max-width:720px; margin:64px auto; background:#fff; border:1px solid #dbe1ea; border-radius:24px; padding:32px; box-shadow:0 12px 30px rgba(15,23,42,.08); }
      h1 { margin:0 0 12px; font-size:28px; }
      p { margin:0; font-size:18px; line-height:1.5; color:#4b5563; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>Не удалось открыть PDF</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;

    return new Response(html, {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({ error: message }, { status });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return buildPdfErrorResponse(request, "Не авторизован", 401);
    }

    const { id } = await params;
    const orgId = getActiveOrgId(session);

    // ACL-check: раньше любой org-member мог скачать PDF любого
    // журнала, включая journals на которые у него нет доступа
    // (UserJournalAccess.canRead). Подгружаем template.code и
    // проверяем через hasJournalAccess.
    const docMeta = await db.journalDocument.findUnique({
      where: { id },
      select: {
        organizationId: true,
        template: { select: { code: true } },
      },
    });
    if (!docMeta || docMeta.organizationId !== orgId) {
      return buildPdfErrorResponse(request, "Документ не найден", 404);
    }
    const access = await hasJournalAccess(
      aclActorFromSession({
        user: {
          id: session.user.id,
          role: session.user.role,
          isRoot: session.user.isRoot === true,
        },
      }),
      docMeta.template.code
    );
    if (!access) {
      return buildPdfErrorResponse(request, "Нет доступа к этому журналу", 403);
    }

    const { buffer, fileName } = await generateJournalDocumentPdf({
      documentId: id,
      organizationId: orgId,
    });

    const uint8 = new Uint8Array(buffer);

    return new Response(uint8, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(uint8.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";
    return buildPdfErrorResponse(
      request,
      message,
      message === "Документ не найден" ? 404 : 500
    );
  }
}
