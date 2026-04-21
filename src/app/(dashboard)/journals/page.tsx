import { JournalsBrowser } from "@/components/journals/journals-browser";
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { aclActorFromSession, getAllowedJournalCodes } from "@/lib/journal-acl";
import { getTemplatesFilledToday } from "@/lib/today-compliance";
import { parseDisabledCodes } from "@/lib/disabled-journals";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const dynamic = "force-dynamic";

export default async function JournalsPage() {
  const session = await requireAuth();
  const isManager = hasFullWorkspaceAccess(session.user);

  const allowedCodes = await getAllowedJournalCodes(
    aclActorFromSession(session)
  );

  const [templates, organization] = await Promise.all([
    db.journalTemplate.findMany({
      where: {
        isActive: true,
        ...(allowedCodes ? { code: { in: allowedCodes } } : {}),
      },
      orderBy: { sortOrder: "asc" },
    }),
    db.organization.findUnique({
      where: { id: session.user.organizationId },
      select: { disabledJournalCodes: true },
    }),
  ]);

  const disabledCodes = parseDisabledCodes(organization?.disabledJournalCodes);

  // Employees (cooks, waiters) don't need to see disabled journals —
  // they can't navigate to settings to re-enable them, so showing the
  // «Отключённые» section would be a dead end. Managers still see the
  // full picture so they can toggle things back.
  const visibleTemplates = isManager
    ? templates
    : templates.filter((t) => !disabledCodes.has(t.code));

  const filledTodayIds = await getTemplatesFilledToday(
    session.user.organizationId,
    new Date(),
    visibleTemplates.map((t) => ({ id: t.id, code: t.code })),
    disabledCodes
  );

  // Которые журналы УЖЕ имеют активный документ на сегодня — их
  // bulk-create-кнопка не трогает. Используем для UI-бейджа «есть
  // документ» и для default-фильтра selection.
  const activeTemplateIds = new Set<string>(
    (
      await db.journalDocument.findMany({
        where: {
          organizationId: session.user.organizationId,
          status: "active",
          dateFrom: { lte: new Date() },
          dateTo: { gte: new Date() },
        },
        select: { templateId: true },
        distinct: ["templateId"],
      })
    ).map((d) => d.templateId)
  );

  const items = visibleTemplates.map((template) => ({
    id: template.id,
    code: template.code,
    name: template.name,
    description: template.description,
    isMandatorySanpin: template.isMandatorySanpin,
    isMandatoryHaccp: template.isMandatoryHaccp,
    filledToday: filledTodayIds.has(template.id),
    disabled: disabledCodes.has(template.code),
    hasActiveDocumentToday: activeTemplateIds.has(template.id),
  }));

  return <JournalsBrowser templates={items} canBulkCreate={isManager} />;
}
