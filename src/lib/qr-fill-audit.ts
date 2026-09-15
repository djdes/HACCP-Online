import { recordAuditLog } from "@/lib/audit-log";

/**
 * Запись в журнал действий о показании, внесённом по QR без входа.
 *
 * Сессии нет, поэтому автор — сотрудник, выбравший себя в форме, с
 * пометкой «(QR)», а в деталях — объект, документ, срок и значения. По
 * этой записи руководитель отличит QR-замер от внесённого в кабинете.
 */
export async function recordQrFillAudit(input: {
  request: Request;
  organizationId: string;
  kind: "room" | "equipment";
  objectId: string;
  objectName: string;
  employee: { id: string; name: string };
  documentIds: string[];
  dateKey: string;
  slot?: string | null;
  temperature?: number | null;
  humidity?: number | null;
  outOfRange?: boolean;
}): Promise<void> {
  await recordAuditLog({
    request: input.request,
    session: { user: { id: input.employee.id, name: `${input.employee.name} (QR)` } },
    organizationId: input.organizationId,
    action: "journal.qr_fill",
    entity: input.kind === "room" ? "Room" : "Equipment",
    entityId: input.objectId,
    details: {
      kind: input.kind,
      objectName: input.objectName,
      documentIds: input.documentIds,
      dateKey: input.dateKey,
      ...(input.slot ? { slot: input.slot } : {}),
      ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
      ...(typeof input.humidity === "number" ? { humidity: input.humidity } : {}),
      outOfRange: input.outOfRange === true,
    },
  });
}

export const QR_FILL_RATE_LIMIT_ERROR =
  "Слишком много записей подряд с этого телефона. Подождите минуту и попробуйте снова.";

/** Ключ лимитера: адрес клиента + объект. */
export function qrFillRateKey(ip: string | null, kind: "room" | "equipment", objectId: string) {
  return `${ip ?? "unknown"}:${kind}:${objectId}`;
}
