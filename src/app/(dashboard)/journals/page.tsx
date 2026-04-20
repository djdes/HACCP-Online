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

  const items = visibleTemplates.map((template) => ({
    id: template.id,
    code: template.code,
    name: template.name,
    description: template.description,
    isMandatorySanpin: template.isMandatorySanpin,
    isMandatoryHaccp: template.isMandatoryHaccp,
    filledToday: filledTodayIds.has(template.id),
    disabled: disabledCodes.has(template.code),
  }));

  return <JournalsBrowser templates={items} />;
}
