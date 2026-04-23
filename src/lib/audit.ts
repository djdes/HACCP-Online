import { db } from "./db";

export type AuditAction =
  | "journal_entry.create"
  | "journal_entry.copy"
  | "journal_entry.delete"
  | "attachment.upload"
  | "staff.add"
  | "staff.update"
  | "equipment.add"
  | "equipment.update";

export async function logAudit(args: {
  organizationId: string;
  userId?: string;
  userName?: string;
  action: AuditAction;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId,
        userName: args.userName,
        action: args.action,
        entity: args.entity,
        entityId: args.entityId,
        details: args.details as never,
        ipAddress: args.ipAddress,
      },
    });
  } catch (err) {
    // Audit logging should never break the main flow
    console.error("[audit] failed to log:", err);
  }
}
