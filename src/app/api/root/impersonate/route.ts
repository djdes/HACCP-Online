import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decode, encode } from "next-auth/jwt";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request?: Request): string | null {
  if (!request) return null;
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim();
  return null;
}

/**
 * Перевыпускает NextAuth session-token cookie с новым actingAsOrganizationId.
 * Делается напрямую через encode/decode из next-auth/jwt — обходит баг
 * update() в NextAuth v4 + Next.js 16, где update() возвращает успех, но
 * cookie не всегда сразу пишется в response, и следующий
 * getServerSession() видит старый JWT.
 */
async function rewriteSessionToken(
  next: string | null
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return { ok: false, reason: "NEXTAUTH_SECRET не задан" };

  const isHttps =
    process.env.NEXTAUTH_URL?.startsWith("https://") ||
    process.env.VERCEL === "1";
  // Custom NextAuth cookie name из src/lib/auth.ts:
  //   __Secure-haccp-online.session-token (https) / haccp-online.session-token (http).
  // Был баг: использовалось дефолтное "next-auth.session-token", из-за чего
  // импersonate всегда падал с «Cookie сессии не найден».
  const cookieName = isHttps
    ? "__Secure-haccp-online.session-token"
    : "haccp-online.session-token";

  const cookieStore = await cookies();
  const current = cookieStore.get(cookieName)?.value;
  if (!current) return { ok: false, reason: "Cookie сессии не найден" };

  let decoded: Record<string, unknown> | null = null;
  try {
    decoded = (await decode({ token: current, secret })) as Record<
      string,
      unknown
    > | null;
  } catch {
    return { ok: false, reason: "Не удалось декодировать JWT" };
  }
  if (!decoded) return { ok: false, reason: "JWT пустой" };

  if (decoded.isRoot !== true) {
    return { ok: false, reason: "Только ROOT может impersonate" };
  }

  decoded.actingAsOrganizationId = next;

  const maxAgeSec = 30 * 24 * 60 * 60;
  // decode возвращает Record<string, unknown>, encode хочет JWT; для
  // re-encode достаточно cast — все нужные поля уже есть в decoded.
  const fresh = await encode({
    token: decoded as Parameters<typeof encode>[0]["token"],
    secret,
    maxAge: maxAgeSec,
  });

  cookieStore.set(cookieName, fresh, {
    httpOnly: true,
    secure: isHttps,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  });

  return { ok: true };
}

/**
 * POST /api/root/impersonate — validates the target org and writes an
 * AuditLog row. The client then calls `useSession().update()` to refresh
 * its JWT with the new `actingAsOrganizationId` claim. This endpoint does
 * not return a cookie — the browser keeps the same session, just with the
 * claim overwritten, so stopping impersonation is a clean mirror.
 *
 * DELETE — clears the claim (logs a matching stop entry).
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isRoot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const organizationId =
    typeof body?.organizationId === "string" ? body.organizationId : null;
  if (!organizationId) {
    return NextResponse.json(
      { error: "organizationId обязателен" },
      { status: 400 }
    );
  }

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  }

  await db.auditLog.create({
    data: {
      organizationId: org.id,
      userId: session.user.id,
      userName: session.user.name ?? session.user.email ?? "root",
      action: "impersonate.start",
      entity: "Organization",
      entityId: org.id,
      details: { organizationName: org.name },
      ipAddress: clientIp(request),
    },
  });

  const rewrite = await rewriteSessionToken(org.id);
  if (!rewrite.ok) {
    return NextResponse.json(
      { error: `Не удалось обновить сессию: ${rewrite.reason}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, organization: org });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isRoot) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const target = session.user.actingAsOrganizationId;
  if (target) {
    await db.auditLog.create({
      data: {
        organizationId: target,
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? "root",
        action: "impersonate.stop",
        entity: "Organization",
        entityId: target,
        ipAddress: clientIp(request),
      },
    });
  }
  // Чистим actingAsOrganizationId в JWT — даже если update() от клиента
  // не сработает, сервер уже выпустит cookie без impersonation.
  await rewriteSessionToken(null);
  return NextResponse.json({ ok: true });
}
