import { db } from "@/lib/db";
import { renderEmailLayout, sendRawEmail } from "@/lib/email";
import { getDbRoleValuesWithLegacy, MANAGEMENT_ROLES } from "@/lib/user-roles";

/**
 * Самостоятельное удаление организации: руководитель запрашивает, 30 дней
 * холда с баннером и возможностью отменить, потом крон удаляет данные.
 */
export const DELETION_HOLD_DAYS = 30;

export function deletionDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DELETION_HOLD_DAYS * 86_400_000);
}

async function managementEmails(organizationId: string): Promise<string[]> {
  const users = await db.user.findMany({
    where: { organizationId, isActive: true, role: { in: getDbRoleValuesWithLegacy(MANAGEMENT_ROLES) } },
    select: { email: true },
  });
  return Array.from(new Set(users.map((u) => u.email).filter((e): e is string => Boolean(e && e.includes("@") && !e.endsWith(".local")))));
}

export async function requestOrganizationDeletion(organizationId: string, userId: string, now: Date = new Date()): Promise<{ dueAt: Date }> {
  const org = await db.organization.update({
    where: { id: organizationId },
    data: { deletionRequestedAt: now, deletionRequestedById: userId },
    select: { name: true },
  });
  const dueAt = deletionDueAt(now);
  const when = dueAt.toLocaleDateString("ru-RU", { timeZone: "Europe/Moscow", day: "numeric", month: "long", year: "numeric" });
  const html = renderEmailLayout(
    `Удаление организации «${org.name}» запланировано`,
    `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3f3f46">Руководитель запросил удаление организации. Все журналы, документы и сотрудники будут удалены <b>${when}</b>. До этого дня удаление можно отменить в кабинете — баннер сверху страницы.</p>
     <p style="margin:0;font-size:13px;color:#a1a1aa">Если вы не запрашивали удаление — отмените его и смените пароль.</p>`
  );
  for (const to of await managementEmails(organizationId)) {
    await sendRawEmail(to, `Удаление организации «${org.name}» ${when}`, html).catch(() => false);
  }
  return { dueAt };
}

export async function cancelOrganizationDeletion(organizationId: string): Promise<void> {
  await db.organization.update({ where: { id: organizationId }, data: { deletionRequestedAt: null, deletionRequestedById: null } });
}

/** Крон: удалить организации, у которых холд истёк. Ошибку одной не роняет остальные. */
export async function purgeDueDeletions(now: Date = new Date()): Promise<{ deleted: string[]; failed: Array<{ id: string; error: string }> }> {
  const threshold = new Date(now.getTime() - DELETION_HOLD_DAYS * 86_400_000);
  const due = await db.organization.findMany({ where: { deletionRequestedAt: { lte: threshold } }, select: { id: true, name: true } });
  const deleted: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const org of due) {
    try {
      await db.organization.delete({ where: { id: org.id } });
      deleted.push(org.id);
      console.info("[org-deletion] deleted", org.id, org.name);
    } catch (error) {
      failed.push({ id: org.id, error: error instanceof Error ? error.message.slice(0, 200) : "error" });
      console.error("[org-deletion] failed", org.id, error);
    }
  }
  return { deleted, failed };
}
