import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashInspectorToken } from "@/lib/inspector-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * B6 — Электронная подпись инспектора.
 *
 * POST /api/inspector/[token]/sign
 * Body: { inspectorName?: string, templatesViewed?: string[] }
 *
 * Не требует auth — open URL, защищённый только токеном (HMAC-hash
 * проверяется через `hashInspectorToken`). После подписи — row
 * `InspectorVisit` остаётся навсегда (audit trail).
 *
 * Не уведомляет org через Telegram (это спам). Админ видит подписи
 * в `/settings/inspector-portal` рядом с tokens.
 */
const Schema = z.object({
  inspectorName: z.string().trim().max(200).optional(),
  templatesViewed: z.array(z.string()).max(40).optional(),
});

function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return null;
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const tokenHash = hashInspectorToken(token);

  const dbToken = await db.inspectorToken.findUnique({
    where: { tokenHash },
    select: { id: true, revokedAt: true, expiresAt: true },
  });
  if (!dbToken) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }
  if (dbToken.revokedAt || dbToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Токен недействителен" }, { status: 410 });
  }

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await request.json().catch(() => ({})));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Bad input" },
        { status: 400 }
      );
    }
    throw err;
  }

  const visit = await db.inspectorVisit.create({
    data: {
      tokenId: dbToken.id,
      ipAddress: clientIp(request),
      userAgent: request.headers.get("user-agent") ?? null,
      inspectorName: body.inspectorName ?? null,
      templatesViewed: body.templatesViewed ?? [],
    },
  });

  return NextResponse.json({
    ok: true,
    visitId: visit.id,
    signedAt: visit.signedAt.toISOString(),
  });
}
