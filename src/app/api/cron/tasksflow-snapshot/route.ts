import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import { tasksflowClientFor } from "@/lib/tasksflow-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/tasksflow-snapshot?secret=…
 *
 * Hourly snapshot всех TasksFlow данных по каждой нашей integration.
 * Исторический контекст: 28.04.2026 TasksFlow БД была полностью wipe'нута
 * (видимо `drizzle-kit push --force` через ручной SSH). У нас не было
 * backup'ов — потеряли tasks/invitations навсегда. Этот snapshot
 * призван закрыть тот же сценарий для будущего.
 *
 * Что сохраняем:
 *   - listUsers (TF /api/users)
 *   - listTasks (TF /api/tasks)
 *
 * Куда: /var/www/wesetupru/data/tasksflow-snapshots/YYYY-MM-DD/
 *       snapshot-{integrationId}-{ISO timestamp}.json.gz
 *
 * Ротация: пользователь сам зачищает старые директории через cron
 * (например `find … -mtime +30 -delete`). Auto-prune здесь не делаем —
 * лучше иметь больше backup'ов чем меньше.
 *
 * Идемпотентно: одна запись на каждый запуск (timestamp в имени файла).
 */
const SNAPSHOT_DIR = "/var/www/wesetupru/data/tasksflow-snapshots";

export async function POST(request: Request) {
  const cronAuth = checkCronSecret(request);
  if (cronAuth) return cronAuth;
  const integrations = await db.tasksFlowIntegration.findMany({
    where: { enabled: true },
    select: {
      id: true,
      organizationId: true,
      baseUrl: true,
      apiKeyEncrypted: true,
      tasksflowCompanyId: true,
    },
  });

  const now = new Date();
  const dateDir = path.join(
    SNAPSHOT_DIR,
    now.toISOString().slice(0, 10) // YYYY-MM-DD
  );
  await mkdir(dateDir, { recursive: true });

  type Result =
    | {
        integrationId: string;
        ok: true;
        users: number;
        tasks: number;
        bytes: number;
      }
    | {
        integrationId: string;
        ok: false;
        reason: string;
      };

  const results: Result[] = [];

  for (const integration of integrations) {
    try {
      const client = tasksflowClientFor(integration);
      const [users, tasks] = await Promise.all([
        client.listUsers(),
        client.listTasks(),
      ]);
      const payload = {
        snapshotAt: now.toISOString(),
        integrationId: integration.id,
        organizationId: integration.organizationId,
        tasksflowCompanyId: integration.tasksflowCompanyId,
        baseUrl: integration.baseUrl,
        users,
        tasks,
      };
      const json = JSON.stringify(payload);
      const gz = gzipSync(Buffer.from(json, "utf8"));
      const file = path.join(
        dateDir,
        `snapshot-${integration.id}-${now.toISOString().replace(/[:.]/g, "-")}.json.gz`
      );
      await writeFile(file, gz);
      results.push({
        integrationId: integration.id,
        ok: true,
        users: users.length,
        tasks: tasks.length,
        bytes: gz.byteLength,
      });
    } catch (err) {
      results.push({
        integrationId: integration.id,
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Bonus — wipe-detector. Если snapshot вернул < 50% от прошлого — alert
  // через AuditLog (его потом видно на /settings/audit). Не блокируем
  // саму работу — просто маркер для расследования.
  for (const r of results) {
    if (!r.ok) continue;
    try {
      const lastSuccess = await db.auditLog.findFirst({
        where: {
          action: "tasksflow.snapshot.ok",
          entityId: r.integrationId,
        },
        orderBy: { createdAt: "desc" },
        select: { details: true },
      });
      if (lastSuccess && lastSuccess.details) {
        const prev = lastSuccess.details as {
          users?: number;
          tasks?: number;
        };
        const prevUsers = prev.users ?? 0;
        const prevTasks = prev.tasks ?? 0;
        const drasticUsers =
          prevUsers >= 5 && r.users < Math.floor(prevUsers / 2);
        const drasticTasks =
          prevTasks >= 5 && r.tasks < Math.floor(prevTasks / 2);
        if (drasticUsers || drasticTasks) {
          const integ = integrations.find((i) => i.id === r.integrationId);
          await db.auditLog.create({
            data: {
              organizationId: integ?.organizationId ?? "platform",
              userId: null,
              userName: "tasksflow-snapshot-cron",
              action: "tasksflow.snapshot.WIPE_SUSPECTED",
              entity: "TasksFlowIntegration",
              entityId: r.integrationId,
              details: {
                prevUsers,
                prevTasks,
                nowUsers: r.users,
                nowTasks: r.tasks,
                message:
                  "Drastic drop в TF — возможно БД wipe'нута. Проверьте срочно.",
              },
            },
          });
        }
      }
      const integ = integrations.find((i) => i.id === r.integrationId);
      await db.auditLog.create({
        data: {
          organizationId: integ?.organizationId ?? "platform",
          userId: null,
          userName: "tasksflow-snapshot-cron",
          action: "tasksflow.snapshot.ok",
          entity: "TasksFlowIntegration",
          entityId: r.integrationId,
          details: { users: r.users, tasks: r.tasks, bytes: r.bytes },
        },
      });
    } catch {
      /* audit best-effort */
    }
  }

  return NextResponse.json({
    ok: true,
    snapshotDir: dateDir,
    integrations: results.length,
    results,
  });
}
