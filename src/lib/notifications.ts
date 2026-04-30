import { db } from "@/lib/db";
import { getDbRoleValuesWithLegacy, MANAGEMENT_ROLES } from "@/lib/user-roles";

/**
 * Shape of a single check-box row inside a Notification.
 *
 * Rendered as a list under the notification title. `id` is the stable
 * identifier of the missing thing (employee id, position id, etc) so the
 * client can send back which ones were dismissed/ticked.
 */
export type NotificationItem = {
  id: string;
  label: string;
  /// Optional secondary text rendered faded to the right (e.g. position).
  hint?: string;
  /// Optional per-item link target. Если задан — клик по подзадаче
  /// ведёт сюда, а не на общий `linkHref` группы. Полезно когда у каждой
  /// подзадачи свой документ/журнал/раздел.
  href?: string;
};

export function asNotificationItems(raw: unknown): NotificationItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is Record<string, unknown> => !!v && typeof v === "object")
    .map((v) => ({
      id: typeof v.id === "string" ? v.id : "",
      label: typeof v.label === "string" ? v.label : "",
      hint: typeof v.hint === "string" ? v.hint : undefined,
      href: typeof v.href === "string" ? v.href : undefined,
    }))
    .filter((it) => it.id && it.label);
}

/**
 * Парсит JSON-массив id'шников подзадач, которые юзер пометил
 * прочитанными. На уровне DB это просто Json — здесь нормализуем
 * к Set<string>, безопасно отбросив всё, что не строка.
 */
export function asDismissedItemIds(raw: unknown): Set<string> {
  if (!Array.isArray(raw)) return new Set();
  return new Set(
    raw.filter((v): v is string => typeof v === "string" && v.length > 0)
  );
}

/**
 * Create or merge a notification. If a row with the same (userId, dedupeKey)
 * already exists and is not dismissed, items are merged in (by id) and the
 * row is surfaced again by clearing readAt.
 */
export async function upsertNotification(args: {
  organizationId: string;
  userId: string;
  kind: string;
  dedupeKey: string;
  title: string;
  linkHref?: string | null;
  linkLabel?: string | null;
  items: NotificationItem[];
}): Promise<void> {
  const existing = await db.notification.findUnique({
    where: {
      userId_dedupeKey: { userId: args.userId, dedupeKey: args.dedupeKey },
    },
  });
  if (!existing || existing.dismissedAt) {
    await db.notification.upsert({
      where: {
        userId_dedupeKey: { userId: args.userId, dedupeKey: args.dedupeKey },
      },
      create: {
        organizationId: args.organizationId,
        userId: args.userId,
        kind: args.kind,
        dedupeKey: args.dedupeKey,
        title: args.title,
        linkHref: args.linkHref ?? null,
        linkLabel: args.linkLabel ?? null,
        items: args.items as unknown as object,
      },
      update: {
        title: args.title,
        linkHref: args.linkHref ?? null,
        linkLabel: args.linkLabel ?? null,
        items: args.items as unknown as object,
        readAt: null,
        dismissedAt: null,
      },
    });
    return;
  }
  const merged: NotificationItem[] = [
    ...asNotificationItems(existing.items),
  ];
  for (const incoming of args.items) {
    if (!merged.some((m) => m.id === incoming.id)) merged.push(incoming);
  }
  await db.notification.update({
    where: { id: existing.id },
    data: {
      title: args.title,
      linkHref: args.linkHref ?? null,
      linkLabel: args.linkLabel ?? null,
      items: merged as unknown as object,
      readAt: null,
    },
  });
}

/**
 * Fan-out: create the same notification for every management user in the
 * organisation (manager/head_chef and legacy owner/technologist). New
 * employees trigger a notification to every boss, not just one.
 */
export async function notifyManagement(args: {
  organizationId: string;
  kind: string;
  dedupeKey: string;
  title: string;
  linkHref?: string | null;
  linkLabel?: string | null;
  items: NotificationItem[];
}): Promise<void> {
  // Раньше: inline-list ["manager", "head_chef", "owner", "technologist"].
  // Если когда-нибудь добавим новую management-роль (или legacy alias),
  // это inline-listing забывал бы её. Используем стандартный helper —
  // согласовано с другими fan-out местами (compliance cron, expiry cron).
  const managers = await db.user.findMany({
    where: {
      organizationId: args.organizationId,
      isActive: true,
      archivedAt: null,
      role: { in: getDbRoleValuesWithLegacy(MANAGEMENT_ROLES) },
    },
    select: { id: true },
  });
  await Promise.all(
    managers.map((m) =>
      upsertNotification({
        organizationId: args.organizationId,
        userId: m.id,
        kind: args.kind,
        dedupeKey: args.dedupeKey,
        title: args.title,
        linkHref: args.linkHref ?? null,
        linkLabel: args.linkLabel ?? null,
        items: args.items,
      })
    )
  );
}
