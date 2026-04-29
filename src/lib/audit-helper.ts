import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * I6 — обёртка для записи AuditLog с минимумом boilerplate.
 *
 * Замысел: вызвать в любом API-handler'е после критичного действия
 * вместо ручного `db.auditLog.create({...})` с 6 полями. Удобно когда
 * action делается часто и нужно стабильное audit-наполнение.
 *
 * Пример:
 *   await audit({
 *     orgId: getActiveOrgId(session),
 *     action: "user.role_changed",
 *     entity: "user",
 *     entityId: userId,
 *     actor: session.user,
 *     details: { oldRole, newRole },
 *   });
 *
 * Не падает, не throw'ает — audit-failure не должен ломать business
 * logic. Логируется в console.
 */
export async function audit(args: {
  orgId: string;
  action: string;
  entity: string;
  entityId?: string;
  actor?: {
    id?: string | null;
    name?: string | null;
  };
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: args.orgId,
        userId: args.actor?.id ?? null,
        userName: args.actor?.name ?? null,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId ?? null,
        details:
          args.details === undefined
            ? Prisma.JsonNull
            : (args.details as Prisma.InputJsonValue),
      },
    });
  } catch (err) {
    console.warn(`[audit] failed for action="${args.action}":`, err);
  }
}

/**
 * Wrapper для async-handler'а с автоматическим audit'ом успеха/ошибки.
 *
 * Пример:
 *   await withAudit(
 *     { orgId, action: "user.deleted", entity: "user", entityId: id, actor },
 *     async () => {
 *       await db.user.delete({ where: { id } });
 *     }
 *   );
 *
 * Если fn() throw'ает — пишет audit с success: false + error message,
 * затем re-throw'ит ошибку.
 */
export async function withAudit<T>(
  args: {
    orgId: string;
    action: string;
    entity: string;
    entityId?: string;
    actor?: { id?: string | null; name?: string | null };
    details?: Record<string, unknown>;
  },
  fn: () => Promise<T>
): Promise<T> {
  try {
    const result = await fn();
    await audit({ ...args, details: { ...args.details, success: true } });
    return result;
  } catch (err) {
    await audit({
      ...args,
      details: {
        ...args.details,
        success: false,
        error: err instanceof Error ? err.message : "unknown",
      },
    });
    throw err;
  }
}
