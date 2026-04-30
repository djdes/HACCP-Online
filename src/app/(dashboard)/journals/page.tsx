import { redirect } from "next/navigation";
import { JournalsBrowser } from "@/components/journals/journals-browser";
import { PageGuide } from "@/components/ui/page-guide";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { aclActorFromSession, getAllowedJournalCodes } from "@/lib/journal-acl";
import { getTemplatesFilledToday } from "@/lib/today-compliance";
import { parseDisabledCodes } from "@/lib/disabled-journals";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { hasCapability } from "@/lib/permission-presets";

export const dynamic = "force-dynamic";

export default async function JournalsPage() {
  const session = await requireAuth();
  // Заведующая (head_chef) и не-admin'ы не должны видеть «журналы как
  // журналы». Перенаправляем туда где они работают.
  if (!hasCapability(session.user, "journals.view")) {
    if (hasCapability(session.user, "tasks.verify")) {
      redirect("/control-board");
    }
    redirect("/mini/today");
  }
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
      where: { id: getActiveOrgId(session) },
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
    getActiveOrgId(session),
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
          organizationId: getActiveOrgId(session),
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

  return (
    <div className="space-y-5">
      <PageGuide
        storageKey="journals-list"
        title="Как работать с журналами"
        bullets={[
          {
            title: "Зелёная галочка",
            body: "журнал заполнен сегодня — проверка пройдёт. Серый — ещё не заполнили.",
          },
          {
            title: "Открыть журнал",
            body: "клик по карточке — открывается активный документ за текущий период (месяц/полмесяца/год).",
          },
          {
            title: "Серый журнал",
            body: "отключён в /settings/journals — этой кухне не нужен. Можно включить обратно там же.",
          },
          {
            title: "«Разослать всем»",
            body: "одной кнопкой создаются TasksFlow-задачи для незаполненных журналов. Сотрудники видят их в смартфоне.",
          },
        ]}
        qa={[
          {
            q: "Журнал отключён, но всё равно нужно вести",
            a: "Зайди в /settings/journals и включи обратно. Также проверь /settings/journal-responsibles — там должны быть назначены исполнители.",
          },
          {
            q: "У сотрудника нет доступа к журналу",
            a: "Доступ контролируется per-должность. Открой /settings/journal-access — там матрица «должность × журнал».",
          },
        ]}
      />
      <JournalsBrowser templates={items} canBulkCreate={isManager} />
    </div>
  );
}
