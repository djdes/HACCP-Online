import { redirect } from "next/navigation";
import {
  Building2,
  ClipboardList,
  ListChecks,
  Network,
  Users,
  Wrench,
} from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { OnboardingFinishCta } from "@/components/settings/onboarding-finish-cta";
import {
  PhaseCard,
  type Phase,
  type SetupItem,
} from "@/components/settings/onboarding-phases";

export const dynamic = "force-dynamic";

/**
 * Быстрый старт — ровно 3 этапа по 2 карточки: объект → команда →
 * журналы. Всё остальное (Telegram, пресеты прав, иерархия,
 * pipeline-инструкции, TasksFlow, «зрелость») живёт на
 * `/settings/onboarding/advanced` — там оно не мешает новичку, который
 * первый раз открыл настройки и должен за 3 шага довести компанию до
 * состояния «сотрудники получают задачи».
 *
 * Карточки намеренно без описаний и без красных подсказок: заголовок,
 * иконка статуса и счётчик-пилюля читаются за секунду, а подробности
 * человек увидит на самой странице настройки.
 */
export default async function OnboardingPage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");
  const organizationId = getActiveOrgId(session);

  // Считаем только то, что нужно шести карточкам — тяжёлый Promise.all
  // из 17 count'ов остался на advanced-странице.
  const [
    org,
    positionsCount,
    activeUsersCount,
    buildingsCount,
    roomsCount,
    equipmentCount,
    activeTemplates,
    journalsWithResponsiblesCount,
    activeDocumentsCount,
  ] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { disabledJournalCodes: true },
    }),
    db.jobPosition.count({ where: { organizationId } }),
    db.user.count({
      where: { organizationId, isActive: true, archivedAt: null },
    }),
    db.building.count({ where: { organizationId } }),
    db.room.count({ where: { building: { organizationId } } }),
    db.equipment.count({ where: { area: { organizationId } } }),
    db.journalTemplate.findMany({
      where: { isActive: true },
      select: { code: true },
    }),
    db.journalTemplate
      .findMany({
        where: { isActive: true },
        select: {
          id: true,
          _count: {
            select: {
              positionAccess: { where: { organizationId } },
            },
          },
        },
      })
      .then((rows) => rows.filter((r) => r._count.positionAccess > 0).length),
    db.journalDocument.count({
      where: { organizationId, status: "active" },
    }),
  ]);

  const disabledCodes = new Set<string>(
    Array.isArray(org?.disabledJournalCodes)
      ? (org!.disabledJournalCodes as string[])
      : []
  );
  const enabledTemplatesCount = activeTemplates.filter(
    (t) => !disabledCodes.has(t.code)
  ).length;

  // === Items ===

  const buildingsItem: SetupItem = {
    title: "Помещения",
    href: "/settings/buildings",
    icon: Building2,
    state:
      buildingsCount === 0
        ? "empty"
        : roomsCount === 0
          ? "partial"
          : "complete",
    metric: `${buildingsCount} зд., ${roomsCount} помещ.`,
  };

  const equipmentItem: SetupItem = {
    title: "Оборудование",
    href: "/settings/equipment",
    icon: Wrench,
    state: equipmentCount === 0 ? "empty" : "complete",
    metric: `${equipmentCount}`,
  };

  // Должности заводятся на странице сотрудников — отдельного роута
  // /settings/job-positions в проекте нет.
  const positionsItem: SetupItem = {
    title: "Должности",
    href: "/settings/users",
    icon: ListChecks,
    state: positionsCount === 0 ? "empty" : "complete",
    metric: `${positionsCount}`,
  };

  const usersItem: SetupItem = {
    title: "Сотрудники",
    href: "/settings/users",
    icon: Users,
    state:
      activeUsersCount < 2
        ? "empty"
        : activeUsersCount < 4
          ? "partial"
          : "complete",
    metric: `${activeUsersCount}`,
  };

  const journalsSetItem: SetupItem = {
    title: "Набор журналов",
    href: "/settings/journals",
    icon: ClipboardList,
    state:
      enabledTemplatesCount === 0
        ? "empty"
        : enabledTemplatesCount < 5
          ? "partial"
          : "complete",
    metric: `${enabledTemplatesCount}`,
  };

  const responsiblesItem: SetupItem = {
    title: "Ответственные за журналы",
    href: "/settings/journal-responsibles",
    icon: Network,
    state:
      enabledTemplatesCount === 0
        ? "empty"
        : journalsWithResponsiblesCount >= enabledTemplatesCount
          ? "complete"
          : journalsWithResponsiblesCount > 0
            ? "partial"
            : "empty",
    metric: `${journalsWithResponsiblesCount}/${enabledTemplatesCount}`,
  };

  // === Phases ===

  const phases: Phase[] = [
    {
      id: "site",
      number: 1,
      title: "Объект",
      icon: Building2,
      items: [buildingsItem, equipmentItem],
    },
    {
      id: "team",
      number: 2,
      title: "Команда",
      icon: Users,
      items: [positionsItem, usersItem],
    },
    {
      id: "journals",
      number: 3,
      title: "Журналы",
      icon: ClipboardList,
      items: [journalsSetItem, responsiblesItem],
    },
  ];

  const statuses = phases.map((p) =>
    p.items.every((i) => i.state === "complete")
      ? ("complete" as const)
      : ("active" as const)
  );
  const firstActiveIdx = statuses.findIndex((s) => s !== "complete");
  const allDone = firstActiveIdx === -1;

  // CTA доступен только когда все три этапа закрыты. Список «сначала
  // закройте…» не передаём — шаги и так видны прямо над кнопкой.
  const finishReady = allDone;

  return (
    <div className="space-y-5">
      <header className="px-1">
        <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[#0b1024]">
          Быстрый старт
        </h1>
        <p className="mt-1.5 text-[15px] text-[#6f7282]">
          3 шага — и сотрудники получают задачи.
        </p>
      </header>

      <ol className="space-y-4">
        {phases.map((phase, idx) => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            status={statuses[idx]}
            isActive={idx === firstActiveIdx}
            isLocked={!allDone && idx > firstActiveIdx}
            isLast={idx === phases.length - 1}
          />
        ))}
      </ol>

      <OnboardingFinishCta
        prereqsReady={finishReady}
        missing={[]}
        activeDocumentsCount={activeDocumentsCount}
      />
    </div>
  );
}
