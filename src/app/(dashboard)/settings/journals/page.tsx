import { redirect } from "next/navigation";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { parseDisabledCodes } from "@/lib/disabled-journals";
import { getFillMode } from "@/lib/journal-routing";
import { JournalsSettingsClient } from "./journals-settings-client";
import { PageGuide } from "@/components/ui/page-guide";
import { normalizeSphere } from "@/lib/org-profile";

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
        select: { disabledJournalCodes: true, type: true },
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
  const sphere = normalizeSphere(organization?.type);
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
        title="Как выбрать набор журналов"
        storageKey="settings-journals-v2"
        bullets={[
          { title: "Начните со сферы", body: "Набор строится от вида заведения: для ресторана обязательный минимум Роспотребнадзора — несколько журналов, а не все 35. Смените сферу — пересчитаем." },
          { title: "Остальное — по желанию", body: "Рекомендованные журналы выключены, но под рукой. «Остальные» свёрнуты: включайте, если реально ведёте." },
          { title: "Бумажные — отдельно", body: "Охрана труда и пожарная безопасность ведутся только на бумаге с живой подписью. Мы даём бланк для печати." },
        ]}
        qa={[
          { q: "Почему включено всего несколько журналов?", a: "Это обязательный минимум для вашей сферы. Всё остальное вы решаете сами — набор в любой момент можно расширить." },
          { q: "Что будет, если выключить обязательный?", a: "Журнал исчезнет из дашборда и задач, готовность считаться по нему не будет. За отсутствие обязательного журнала штрафуют по ст. 6.6 КоАП РФ — до 50 000 ₽ или приостановка до 90 суток." },
          { q: "Почему бумажные нельзя вести электронно?", a: "Инструктажи по охране труда и пожарной безопасности подтверждаются личной подписью работника в журнале. Электронная форма инспектором не принимается." },
        ]}
      />
      <JournalsSettingsClient
        items={items}
        positions={positions}
        users={users}
        sphere={sphere}
      />
    </div>
  );
}
