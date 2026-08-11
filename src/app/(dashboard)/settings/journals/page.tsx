import { redirect } from "next/navigation";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { parseDisabledCodes } from "@/lib/disabled-journals";
import { getFillMode } from "@/lib/journal-routing";
import { JournalsSettingsClient } from "./journals-settings-client";
import { PageGuide } from "@/components/ui/page-guide";

export const dynamic = "force-dynamic";

export default async function JournalsSettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/dashboard");
  const organizationId = getActiveOrgId(session);

  const [templates, organization, positions, users, positionAccess] =
    await Promise.all([
      db.journalTemplate.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isMandatorySanpin: true,
          isMandatoryHaccp: true,
          fillMode: true,
          defaultAssigneeId: true,
          bonusAmountKopecks: true,
        },
      }),
      db.organization.findUnique({
        where: { id: organizationId },
        select: { disabledJournalCodes: true },
      }),
      db.jobPosition.findMany({
        where: { organizationId },
        orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, categoryKey: true },
      }),
      db.user.findMany({
        where: {
          organizationId,
          isActive: true,
          archivedAt: null,
          isRoot: false,
        },
        orderBy: [{ name: "asc" }],
        select: { id: true, name: true, jobPositionId: true },
      }),
      db.jobPositionJournalAccess.findMany({
        where: { organizationId },
        select: { templateId: true, jobPositionId: true },
      }),
    ]);

  const disabled = parseDisabledCodes(organization?.disabledJournalCodes);
  const accessByTemplate = new Map<string, string[]>();
  for (const row of positionAccess) {
    const list = accessByTemplate.get(row.templateId) ?? [];
    list.push(row.jobPositionId);
    accessByTemplate.set(row.templateId, list);
  }

  const items = templates.map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    description: t.description,
    isMandatorySanpin: t.isMandatorySanpin,
    isMandatoryHaccp: t.isMandatoryHaccp,
    enabled: !disabled.has(t.code),
    fillMode: getFillMode(t),
    defaultAssigneeId: t.defaultAssigneeId,
    allowedPositionIds: accessByTemplate.get(t.id) ?? [],
    bonusAmountKopecks: t.bonusAmountKopecks,
  }));

  return (
    <div className="space-y-5">
      <PageGuide
        title="Как настроить активные журналы"
        storageKey="settings-journals-v1"
        bullets={[
          { title: "Включите только нужные", body: "Из 35 журналов оставьте те, что обязательны для вашего профиля (общепит, мясокомбинат, бар). Остальные скройте, чтобы не загромождать дашборд." },
          { title: "Назначьте должность", body: "У каждого включённого журнала укажите, какая должность отвечает — повар, заведующая, кладовщик. Сотрудники с этой должностью увидят журнал." },
          { title: "Поставьте бонус (опционально)", body: "Сумма в копейках за заполнение журнала. Если не нужна мотивация — оставьте 0." },
        ]}
        qa={[
          { q: "Что значит «обязательный по СанПиН/ХАССП»?", a: "Это нормативные журналы — Роспотребнадзор может потребовать. Не выключайте их без оснований." },
          { q: "Как добавить новую должность?", a: "Перейдите в раздел «Сотрудники» в настройках и нажмите «+ Добавить должность»." },
        ]}
      />
      <JournalsSettingsClient
        items={items}
        positions={positions}
        users={users}
      />
    </div>
  );
}
