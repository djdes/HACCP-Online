import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/journal-previews/<code>?v=<renderedAt> — PNG-снимок журнала
 * текущей организации. Только своя организация: снимок — это реальные
 * записи с фамилиями сотрудников. Кэш браузера навсегда: версия в URL
 * меняется вместе с перерисовкой.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return new Response(null, { status: 401 });
  }
  const { code } = await params;
  const organizationId = getActiveOrgId(session);

  const preview = await db.journalPreview.findUnique({
    where: { organizationId_code: { organizationId, code } },
    select: { png: true, renderedAt: true },
  });
  if (!preview) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(preview.png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(preview.png.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Last-Modified": preview.renderedAt.toUTCString(),
    },
  });
}
