import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { getPipelineForJournal } from "@/lib/journal-pipelines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/journal-pipelines/[code] — pipeline для journalCode (org-override
 * или default fallback). Любой залогиненный читает.
 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ code: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { code } = await ctx.params;
  const organizationId = getActiveOrgId(session);
  const pipeline = await getPipelineForJournal(organizationId, code);
  return NextResponse.json({ pipeline });
}
