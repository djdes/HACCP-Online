import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/server-session";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  // Раньше: ЛЮБОЙ authenticated сотрудник мог прочитать весь
  // audit-log своей org через mini-app, включая sensitive события:
  //   - user.role_changed, user.password_reset
  //   - impersonate.start/stop
  //   - closed_day.override
  //   - детали JSON всех изменений
  // Web-side /api/audit имеет isManagerRole-check, mini-side не имел.
  // Согласовано через `audit.view` capability (admin/head_chef).
  const canSee =
    hasCapability(session.user, "admin.full") ||
    hasCapability(session.user, "tasks.verify");
  if (!canSee) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const orgId = getActiveOrgId(session);

  const logs = await db.auditLog.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      userName: true,
      action: true,
      entity: true,
      entityId: true,
      details: true,
      createdAt: true,
    },
  });

  // Redact sensitive поля из details перед отдачей в клиент. Mini App
  // рендерит JSON.stringify(details).slice(0, 120) — без redaction
  // первые 120 байт password-hash или impersonation-reason могут
  // утечь в UI. Защита defense-in-depth: даже если admin'у можно
  // видеть log — сырые секреты отдавать всё равно не стоит.
  const redactedLogs = logs.map((log) => ({
    ...log,
    details: redactDetails(log.details),
  }));

  return NextResponse.json({ logs: redactedLogs });
}

const REDACT_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "newhash",
  "oldhash",
  "token",
  "secret",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "webhooksecret",
  "webhook_secret",
  "initdata",
  "init_data",
]);

function redactDetails(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactDetails(v));
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactDetails(v);
    }
  }
  return out;
}
