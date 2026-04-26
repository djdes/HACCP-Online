import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { isManagerRole } from "@/lib/user-roles";
import {
  encryptSecret,
  generateWebhookSecret,
} from "@/lib/integration-crypto";
import {
  TasksFlowError,
  type TasksFlowUser,
  tasksflowClient,
} from "@/lib/tasksflow-client";
import { syncTasksflowUsers } from "@/lib/tasksflow-user-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonUnexpectedError(operation: string, error: unknown) {
  console.error(`[tasksflow integration] ${operation} failed`, error);
  const message =
    error instanceof Error &&
    error.message.includes("Integration encryption secret")
      ? "На сервере не настроено шифрование ключей интеграций. Укажите INTEGRATION_KEY_SECRET или NEXTAUTH_SECRET."
      : "Внутренняя ошибка WeSetup при подключении TasksFlow. Попробуйте ещё раз или проверьте логи сервера.";

  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Read-only status of the TasksFlow integration for the active org.
 * Returns the integration row without secrets, plus a quick `linkedUsers`
 * count for the settings page header.
 */
export async function GET() {
  try {
    return await getIntegrationStatus();
  } catch (error) {
    return jsonUnexpectedError("GET", error);
  }
}

async function getIntegrationStatus() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!hasFullWorkspaceAccess(session.user)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(session);
  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId: orgId },
    select: {
      id: true,
      baseUrl: true,
      apiKeyPrefix: true,
      tasksflowCompanyId: true,
      enabled: true,
      lastSyncAt: true,
      label: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { links: true, taskLinks: true } },
    },
  });
  if (!integration) {
    return NextResponse.json({ integration: null });
  }
  return NextResponse.json({
    integration: {
      id: integration.id,
      baseUrl: integration.baseUrl,
      apiKeyPrefix: integration.apiKeyPrefix,
      tasksflowCompanyId: integration.tasksflowCompanyId,
      enabled: integration.enabled,
      lastSyncAt: integration.lastSyncAt,
      label: integration.label,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      linkedUserCount: integration._count.links,
      taskLinkCount: integration._count.taskLinks,
    },
  });
}

const connectSchema = z.object({
  baseUrl: z.string().url("Введите валидный URL TasksFlow"),
  apiKey: z
    .string()
    .trim()
    .startsWith("tfk_", "Ключ должен начинаться с tfk_")
    .min(16, "Слишком короткий ключ"),
  label: z.string().trim().max(100).optional().nullable(),
});

/**
 * Connect or reconnect the integration.
 *
 * Flow:
 *   1. Validate payload.
 *   2. Probe TasksFlow with the supplied key (`/api/users`). On 401/403 the
 *      key is rejected without writing anything to the DB.
 *   3. Encrypt + persist. Webhook secret is regenerated only when there is
 *      no existing integration row, so webhook subscribers stay valid
 *      across key rotations.
 *
 * Single integration per org (we upsert against `organizationId`).
 */
export async function POST(request: Request) {
  try {
    return await connectIntegration(request);
  } catch (error) {
    return jsonUnexpectedError("POST", error);
  }
}

async function connectIntegration(request: Request) {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isManagerRole(session.user.role) && !session.user.isRoot) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(session);

  let payload: z.infer<typeof connectSchema>;
  try {
    payload = connectSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Неверный запрос" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Неверный запрос" }, { status: 400 });
  }

  // Strip trailing slash so probe uses the same form we'll persist.
  const baseUrl = payload.baseUrl.replace(/\/+$/, "");
  const client = tasksflowClient(baseUrl, payload.apiKey);
  let probeUsers: TasksFlowUser[];
  try {
    probeUsers = await client.ping();
  } catch (err) {
    if (err instanceof TasksFlowError) {
      const status = err.status === 0 ? 502 : err.status;
      return NextResponse.json(
        {
          error:
            err.status === 401 || err.status === 403
              ? "TasksFlow отклонил ключ. Проверьте, что ключ активен."
              : `TasksFlow вернул ошибку (${err.status}). ${err.message}`,
        },
        { status }
      );
    }
    return NextResponse.json(
      { error: "Не удалось связаться с TasksFlow" },
      { status: 502 }
    );
  }
  if (!Array.isArray(probeUsers)) {
    return NextResponse.json(
      {
        error:
          "TasksFlow вернул неожиданный формат ответа для /api/users. Проверьте URL: он должен вести именно на TasksFlow API.",
      },
      { status: 502 }
    );
  }

  // The /api/users response is filtered to the company that owns the key,
  // so the first user's companyId (if present) tells us which company we
  // just bound to. If TasksFlow ever stops returning companyId, we'll
  // resolve it later via /api/tasks.
  const tasksflowCompanyId =
    probeUsers.find((u) => typeof u.companyId === "number")?.companyId ?? null;

  const apiKeyEncrypted = encryptSecret(payload.apiKey);
  const apiKeyPrefix = payload.apiKey.slice(0, 12);

  const existing = await db.tasksFlowIntegration.findUnique({
    where: { organizationId: orgId },
    select: { webhookSecret: true },
  });
  const webhookSecret = existing?.webhookSecret ?? generateWebhookSecret();

  const integration = await db.tasksFlowIntegration.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      baseUrl,
      apiKeyEncrypted,
      apiKeyPrefix,
      tasksflowCompanyId,
      webhookSecret,
      label: payload.label ?? null,
    },
    update: {
      baseUrl,
      apiKeyEncrypted,
      apiKeyPrefix,
      tasksflowCompanyId,
      label: payload.label ?? null,
      enabled: true,
    },
    select: {
      id: true,
      baseUrl: true,
      apiKeyPrefix: true,
      tasksflowCompanyId: true,
    },
  });

  const [wesetupUsers, existingLinks] = await Promise.all([
    db.user.findMany({
      where: { organizationId: orgId, isActive: true, archivedAt: null },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.tasksFlowUserLink.findMany({
      where: { integrationId: integration.id },
      select: { id: true, wesetupUserId: true, source: true },
    }),
  ]);

  const userSync = await syncTasksflowUsers({
    integrationId: integration.id,
    wesetupUsers,
    existingLinks,
    remoteUsers: probeUsers,
    createRemoteUser: async ({ name, phone, isAdmin }) =>
      client.createUser({
        phone,
        ...(name ? { name } : {}),
        ...(isAdmin ? { isAdmin: true } : {}),
      }),
    upsertLink: async ({
      integrationId,
      wesetupUserId,
      phone,
      tasksflowUserId,
      tasksflowWorkerId,
      source,
    }) => {
      await db.tasksFlowUserLink.upsert({
        where: {
          integrationId_wesetupUserId: {
            integrationId,
            wesetupUserId,
          },
        },
        create: {
          integrationId,
          wesetupUserId,
          phone,
          tasksflowUserId,
          tasksflowWorkerId,
          source,
        },
        update: {
          phone,
          tasksflowUserId,
          tasksflowWorkerId,
          source,
        },
      });
    },
  });

  await db.tasksFlowIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });

  return NextResponse.json({
    integration,
    probedUserCount: probeUsers.length,
    userSync,
  });
}

export async function DELETE() {
  try {
    return await deleteIntegration();
  } catch (error) {
    return jsonUnexpectedError("DELETE", error);
  }
}

async function deleteIntegration() {
  const auth = await requireApiAuth();
  if (!auth.ok) return auth.response;
  const session = auth.session;
  if (!isManagerRole(session.user.role) && !session.user.isRoot) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }
  const orgId = getActiveOrgId(session);
  await db.tasksFlowIntegration
    .delete({ where: { organizationId: orgId } })
    .catch(() => null);
  return NextResponse.json({ ok: true });
}
