import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  CloudUpload,
  Coins,
  CreditCard,
  FileSpreadsheet,
  Layers,
  ListChecks,
  Lock,
  Network,
  Package,
  PartyPopper,
  Plug,
  Rocket,
  ScrollText,
  Send,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { OnboardingFinishCta } from "@/components/settings/onboarding-finish-cta";

export const dynamic = "force-dynamic";

type State = "complete" | "partial" | "empty";

type SetupItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  state: State;
  metric?: string;
  issue?: string;
  /** Если true — пункт необязателен и не блокирует переход на следующий этап. */
  optional?: boolean;
};

type Phase = {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  items: SetupItem[];
  /**
   * Если этап «логически» завершён — показывается финальный блок (CTA
   * или информационный). Например, в этапе «Документы» это OnboardingFinishCta,
   * в этапе «TasksFlow» — кнопка «Открыть дашборд → отправить задачи».
   */
  finalNode?: React.ReactNode;
};

export default async function OnboardingPage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");
  const organizationId = getActiveOrgId(session);

  const [
    org,
    positionsCount,
    activeUsersCount,
    usersWithTg,
    usersWithPreset,
    buildingsCount,
    roomsCount,
    equipmentCount,
    managerScopesCount,
    tfIntegration,
    tfLinkedUsersCount,
    inspectorTokensCount,
    bonusJournalsCount,
    activeTemplatesCount,
    journalsWithResponsiblesCount,
    activeDocumentsCount,
  ] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: {
        type: true,
        name: true,
        inn: true,
        address: true,
        taskFlowMode: true,
        journalPipelinesJson: true,
        disabledJournalCodes: true,
      },
    }),
    db.jobPosition.count({ where: { organizationId } }),
    db.user.count({
      where: { organizationId, isActive: true, archivedAt: null },
    }),
    db.user.count({
      where: {
        organizationId,
        isActive: true,
        archivedAt: null,
        telegramChatId: { not: null },
      },
    }),
    db.user.count({
      where: {
        organizationId,
        isActive: true,
        archivedAt: null,
        permissionPreset: { not: null },
      },
    }),
    db.building.count({ where: { organizationId } }),
    db.room.count({ where: { building: { organizationId } } }),
    db.equipment.count({ where: { area: { organizationId } } }),
    db.managerScope.count({ where: { organizationId } }),
    db.tasksFlowIntegration.findFirst({
      where: { organizationId, enabled: true },
      select: { id: true, label: true },
    }),
    // У TasksFlowUserLink нет Prisma-relation на User (см. schema.prisma
    // l.1499 — composite-unique вместо @relation), поэтому фильтруем
    // через integration.organizationId. Для упрощения берём суммарно по
    // активным интеграциям орги.
    db.tasksFlowUserLink.count({
      where: { integration: { organizationId, enabled: true } },
    }),
    db.inspectorToken.count({
      where: { organizationId, revokedAt: null },
    }),
    db.journalTemplate.count({
      where: { isActive: true, bonusAmountKopecks: { gt: 0 } },
    }),
    db.journalTemplate.count({ where: { isActive: true } }),
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

  const disabled = Array.isArray(org?.disabledJournalCodes)
    ? (org!.disabledJournalCodes as string[]).length
    : 0;
  const enabledTemplatesCount = Math.max(0, activeTemplatesCount - disabled);
  const pipelinesCount = org?.journalPipelinesJson
    ? Object.keys(org.journalPipelinesJson as Record<string, unknown>).length
    : 0;

  // === Items ===

  const orgInfoItem: SetupItem = {
    title: "Название, ИНН, адрес",
    description: "Для договоров, печати журналов и шапки PDF",
    href: "/settings/organization",
    icon: Building2,
    state:
      org?.name && org?.inn && org?.address
        ? "complete"
        : org?.name
          ? "partial"
          : "empty",
    metric: org?.name ?? undefined,
    issue: !org?.inn
      ? "ИНН не указан"
      : !org?.address
        ? "Адрес не указан"
        : undefined,
  };

  const positionsItem: SetupItem = {
    title: "Должности",
    description:
      "Шеф, повар, продавец, уборщик — для распределения задач по ролям",
    href: "/settings/users",
    icon: ListChecks,
    state: positionsCount === 0 ? "empty" : "complete",
    metric: `${positionsCount}`,
    issue: positionsCount === 0 ? "Создайте хотя бы 4 должности" : undefined,
  };

  const buildingsItem: SetupItem = {
    title: "Здания и помещения",
    description:
      "Помещения = строки таблиц «Уборка», «Климат», «Санитарный день»",
    href: "/settings/buildings",
    icon: Building2,
    state:
      buildingsCount === 0
        ? "empty"
        : roomsCount === 0
          ? "partial"
          : "complete",
    metric: `${buildingsCount} зд., ${roomsCount} помещ.`,
    issue:
      buildingsCount === 0
        ? "Создайте здание (точку бизнеса)"
        : roomsCount === 0
          ? "Добавьте помещения внутри здания"
          : undefined,
  };

  const equipmentItem: SetupItem = {
    title: "Оборудование",
    description:
      "Холодильники с min/max — попадут в «Контроль температуры», «Поверка», «ППР»",
    href: "/settings/equipment",
    icon: Wrench,
    state: equipmentCount === 0 ? "empty" : "complete",
    metric: `${equipmentCount}`,
    issue:
      equipmentCount === 0
        ? "Добавьте холодильники / морозильники"
        : undefined,
  };

  const usersItem: SetupItem = {
    title: "Сотрудники",
    description: "Минимум: админ + 1 человек на каждую должность",
    href: "/settings/users",
    icon: Users,
    state:
      activeUsersCount < 2
        ? "empty"
        : activeUsersCount < 4
          ? "partial"
          : "complete",
    metric: `${activeUsersCount}`,
    issue:
      activeUsersCount < 2
        ? "Добавьте сотрудников"
        : activeUsersCount < 4
          ? "Команда меньше 4 — возможно нет всех ролей"
          : undefined,
  };

  const presetsItem: SetupItem = {
    title: "Permission-пресеты",
    description: "Кому что доступно: admin / head_chef / cook / seller",
    href: "/settings/role-presets",
    icon: ShieldCheck,
    state:
      activeUsersCount === 0
        ? "empty"
        : usersWithPreset === activeUsersCount
          ? "complete"
          : usersWithPreset > 0
            ? "partial"
            : "empty",
    metric: `${usersWithPreset}/${activeUsersCount}`,
    issue:
      activeUsersCount > 0 && usersWithPreset < activeUsersCount
        ? `${activeUsersCount - usersWithPreset} без preset'а — попадают на дефолт по role`
        : undefined,
    optional: true,
  };

  const hierarchyItem: SetupItem = {
    title: "Иерархия управления",
    description: "Заведующая видит свою подсменую через ManagerScope",
    href: "/settings/staff-hierarchy",
    icon: Network,
    state: managerScopesCount === 0 ? "empty" : "complete",
    metric: `${managerScopesCount}`,
    issue:
      managerScopesCount === 0
        ? "Без scope head_chef видит всех — норм для маленькой орги"
        : undefined,
    optional: true,
  };

  const telegramItem: SetupItem = {
    title: "Telegram-приглашения",
    description: "Без TG сотрудник не получит задачу из TasksFlow",
    href: "/settings/users",
    icon: Bell,
    state:
      activeUsersCount === 0
        ? "empty"
        : usersWithTg === activeUsersCount
          ? "complete"
          : usersWithTg > 0
            ? "partial"
            : "empty",
    metric: `${usersWithTg}/${activeUsersCount}`,
    issue:
      activeUsersCount > 0 && usersWithTg < activeUsersCount
        ? `${activeUsersCount - usersWithTg} без TG — задачи не дойдут`
        : undefined,
  };

  const journalsSetItem: SetupItem = {
    title: "Набор журналов",
    description: "Какие из 35 журналов реально ведёт ваша компания",
    href: "/settings/journals",
    icon: ClipboardList,
    state:
      enabledTemplatesCount === 0
        ? "empty"
        : enabledTemplatesCount < 5
          ? "partial"
          : "complete",
    metric: `${enabledTemplatesCount}`,
    issue:
      enabledTemplatesCount === 0
        ? "Включите минимум 5 базовых журналов"
        : undefined,
  };

  const responsiblesItem: SetupItem = {
    title: "Ответственные за журналы",
    description:
      "Кто заполняет каждый журнал. Один клик — умные пресеты по ХАССП",
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
    issue:
      enabledTemplatesCount > 0 &&
      journalsWithResponsiblesCount < enabledTemplatesCount
        ? `${enabledTemplatesCount - journalsWithResponsiblesCount} без ответственных`
        : undefined,
  };

  const pipelinesItem: SetupItem = {
    title: "Pipeline-инструкции",
    description: "Пошаговое ТЗ для журнала: чем подробнее, тем меньше вопросов",
    href: "/settings/journal-pipelines",
    icon: ListChecks,
    state:
      pipelinesCount === 0
        ? "empty"
        : pipelinesCount < 3
          ? "partial"
          : "complete",
    metric: `${pipelinesCount} настроено`,
    issue:
      pipelinesCount === 0 ? "Без pipeline сотрудник заполняет «как поймёт»" : undefined,
    optional: true,
  };

  const tfModeItem: SetupItem = {
    title: "Режим распределения задач",
    description: "Гонка / Свободно / Только админ — стиль работы команды",
    href: "/settings/journal-flow",
    icon: Shuffle,
    state: org?.taskFlowMode ? "complete" : "empty",
    metric:
      org?.taskFlowMode === "race"
        ? "Гонка"
        : org?.taskFlowMode === "shared"
          ? "Свободно"
          : org?.taskFlowMode === "manual"
            ? "Только админ"
            : "Не выбран",
  };

  const tfIntegrationItem: SetupItem = {
    title: "Подключение TasksFlow",
    description: "Telegram-бот, который доставляет задачи сотрудникам",
    href: "/settings/integrations/tasksflow",
    icon: Plug,
    state: tfIntegration ? "complete" : "empty",
    metric: tfIntegration?.label ?? undefined,
    issue: tfIntegration ? undefined : "Без TF — задачи только внутри сайта",
  };

  const tfLinkItem: SetupItem = {
    title: "Привязка сотрудников к TasksFlow",
    description:
      "Каждый сотрудник связывает свой TG с TF — иначе задачи silently пропускаются",
    href: "/settings/integrations/tasksflow",
    icon: Send,
    state: !tfIntegration
      ? "empty"
      : activeUsersCount === 0
        ? "empty"
        : tfLinkedUsersCount >= activeUsersCount
          ? "complete"
          : tfLinkedUsersCount > 0
            ? "partial"
            : "empty",
    metric:
      activeUsersCount > 0
        ? `${tfLinkedUsersCount}/${activeUsersCount}`
        : undefined,
    issue:
      tfIntegration &&
      activeUsersCount > 0 &&
      tfLinkedUsersCount < activeUsersCount
        ? `${activeUsersCount - tfLinkedUsersCount} без TF-привязки — пропустит fan-out`
        : undefined,
  };

  // === Optional / зрелость ===

  const extras: SetupItem[] = [
    {
      title: "Уведомления",
      description: "Кто получает Telegram-алерты при out-of-range / CAPA",
      href: "/settings/notifications",
      icon: Bell,
      state: "complete",
      metric: "Default",
    },
    {
      title: "Compliance / закрытие дня",
      description:
        "Кто может править выполненные записи и через сколько закрывается день",
      href: "/settings/compliance",
      icon: ShieldCheck,
      state: "complete",
    },
    {
      title: "Премии за журналы",
      description: "Бонусы сотрудникам за заполнение премиальных журналов",
      href: "/settings/journal-bonuses",
      icon: Coins,
      state: bonusJournalsCount === 0 ? "empty" : "complete",
      metric: `${bonusJournalsCount} премиальных`,
    },
    {
      title: "График смен",
      description: "Расписание для авто-назначений и компенсаций",
      href: "/settings/schedule",
      icon: Layers,
      state: "empty",
    },
    {
      title: "Авто-бэкап на Я.Диск",
      description: "Еженедельный JSON-дамп всех журналов в облако",
      href: "/settings/backup",
      icon: CloudUpload,
      state: "empty",
    },
    {
      title: "Бухгалтерия (1С)",
      description: "Еженедельный отчёт списаний на email бухгалтера",
      href: "/settings/accounting",
      icon: FileSpreadsheet,
      state: "empty",
    },
    {
      title: "Портал инспектора (СЭС/РПН)",
      description: "Read-only ссылка с TTL для проверяющих органов",
      href: "/settings/inspector-portal",
      icon: ShieldCheck,
      state: inspectorTokensCount === 0 ? "empty" : "complete",
      metric: `${inspectorTokensCount} активных токенов`,
    },
    {
      title: "Справочник продуктов",
      description: "Импорт из Excel / iiko / 1С — для списаний и приёмок",
      href: "/settings/products",
      icon: Package,
      state: "empty",
    },
    {
      title: "Подписка",
      description: "Тариф и период оплаты",
      href: "/settings/subscription",
      icon: CreditCard,
      state: "complete",
    },
    {
      title: "Аудит-журнал",
      description: "Кто что менял в системе — для compliance-проверок",
      href: "/settings/audit",
      icon: ScrollText,
      state: "complete",
    },
  ];

  // === Phase 5 (документы) — pre-flight для CTA ===
  const finishMissing: string[] = [];
  if (!org?.name || !org?.inn || !org?.address)
    finishMissing.push("Заполните название, ИНН и адрес организации");
  if (positionsCount === 0) finishMissing.push("Создайте должности");
  if (activeUsersCount < 2) finishMissing.push("Добавьте сотрудников");
  if (buildingsCount === 0)
    finishMissing.push("Заведите здания и помещения");
  if (equipmentCount === 0)
    finishMissing.push("Добавьте оборудование (холодильники)");
  if (enabledTemplatesCount === 0)
    finishMissing.push("Включите хотя бы один журнал");
  if (
    enabledTemplatesCount > 0 &&
    journalsWithResponsiblesCount < enabledTemplatesCount
  )
    finishMissing.push(
      `Назначьте ответственных ещё для ${enabledTemplatesCount - journalsWithResponsiblesCount} журналов`
    );
  const finishReady = finishMissing.length === 0;

  // === Phases ===

  const phases: Phase[] = [
    {
      id: "company",
      number: 1,
      title: "О компании",
      subtitle: "Юр-данные, которые попадают в шапку каждого PDF и договора",
      icon: Building2,
      items: [orgInfoItem],
    },
    {
      id: "structure",
      number: 2,
      title: "Структура заведения",
      subtitle:
        "Должности, помещения, оборудование — это строки в ваших журналах",
      icon: Layers,
      items: [positionsItem, buildingsItem, equipmentItem],
    },
    {
      id: "team",
      number: 3,
      title: "Команда",
      subtitle:
        "Сотрудники + Telegram (обязательно для TasksFlow). Permission-пресеты и иерархия — по желанию",
      icon: Users,
      items: [usersItem, telegramItem, presetsItem, hierarchyItem],
    },
    {
      id: "journals",
      number: 4,
      title: "Журналы",
      subtitle:
        "Какие журналы ведёте + кто их заполняет. Pipeline-инструкции — по желанию",
      icon: ClipboardList,
      items: [journalsSetItem, responsiblesItem, pipelinesItem],
    },
    {
      id: "documents",
      number: 5,
      title: "Создаём документы за сегодня",
      subtitle:
        "Один клик — заводятся документы по всем включённым журналам, с ответственными и автозаполнением цехов / оборудования",
      icon: FileSpreadsheet,
      items: [],
      finalNode: (
        <OnboardingFinishCta
          prereqsReady={finishReady}
          missing={finishMissing}
          activeDocumentsCount={activeDocumentsCount}
        />
      ),
    },
    {
      id: "tasksflow",
      number: 6,
      title: "TasksFlow — отправляем задачи",
      subtitle:
        "Подключаем бот, выбираем режим работы, привязываем сотрудников — и нажимаем «Отправить» на дашборде",
      icon: Plug,
      items: [tfModeItem, tfIntegrationItem, tfLinkItem],
      finalNode: (
        <SendTasksCta
          ready={Boolean(
            tfIntegration &&
              activeDocumentsCount > 0 &&
              tfLinkedUsersCount > 0
          )}
          activeDocumentsCount={activeDocumentsCount}
          tfLinkedUsersCount={tfLinkedUsersCount}
          tfConnected={Boolean(tfIntegration)}
        />
      ),
    },
  ];

  // === Phase status calc ===

  function phaseStatus(p: Phase): "complete" | "active" | "locked" {
    // Этап считается «complete» если все обязательные items complete.
    // Optional items не блокируют переход.
    const required = p.items.filter((i) => !i.optional);
    if (required.length === 0 && !p.finalNode) return "complete";
    if (required.length === 0) {
      // Этап только с finalNode — оцениваем по prereqsReady (для phase 5)
      // или вручную в SendTasksCta (для phase 6).
      if (p.id === "documents") {
        return finishReady && activeDocumentsCount > 0 ? "complete" : "active";
      }
      if (p.id === "tasksflow") {
        // Дополнительно — реальная отправка не отслеживается; считаем
        // complete если TF подключён и есть привязанные юзеры.
        return tfIntegration && tfLinkedUsersCount > 0 ? "complete" : "active";
      }
      return "active";
    }
    const allDone = required.every((i) => i.state === "complete");
    return allDone ? "complete" : "active";
  }

  const statuses = phases.map(phaseStatus);
  const firstActiveIdx = statuses.findIndex((s) => s !== "complete");
  const allDone = firstActiveIdx === -1;
  const completedPhases = statuses.filter((s) => s === "complete").length;
  const overallProgress = Math.round((completedPhases / phases.length) * 100);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
          <div className="absolute left-1/3 top-1/2 size-[280px] rounded-full bg-[#3d4efc] opacity-25 blur-[100px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Настройки
          </Link>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                {allDone ? (
                  <PartyPopper className="size-6" />
                ) : (
                  <Rocket className="size-6" />
                )}
              </div>
              <div>
                <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                  {allDone
                    ? "Всё готово — компания работает на полную"
                    : "Быстрый старт — 6 этапов"}
                </h1>
                <p className="mt-2 max-w-[640px] text-[15px] text-white/70">
                  {allDone
                    ? "Все этапы пройдены. Сотрудники получают задачи в Telegram, документы автоматически заводятся и заполняются по СанПиН."
                    : "Прошёл этап → разблокировался следующий. От «зарегистрировал компанию» до «сотрудники получают задачи в TasksFlow» — за 30–40 минут."}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-[12px] uppercase tracking-[0.16em] text-white/60">
                Готовность
              </div>
              <div className="text-[36px] font-semibold leading-none">
                {overallProgress}
                <span className="text-white/50">%</span>
              </div>
              <div className="text-[12px] text-white/60">
                {completedPhases}/{phases.length} этапов
              </div>
            </div>
          </div>

          {/* Mini-progress strip */}
          <div className="mt-6 flex items-center gap-1">
            {phases.map((p, idx) => {
              const s = statuses[idx];
              return (
                <div
                  key={p.id}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    s === "complete"
                      ? "bg-[#7cf5c0]"
                      : idx === firstActiveIdx
                        ? "bg-[#5566f6]"
                        : "bg-white/15"
                  }`}
                  title={`Этап ${p.number}: ${p.title}`}
                />
              );
            })}
          </div>
        </div>
      </section>

      <ol className="space-y-4">
        {phases.map((phase, idx) => {
          const status = statuses[idx];
          const isActive = idx === firstActiveIdx;
          const isLocked = !allDone && idx > firstActiveIdx;
          const isLast = idx === phases.length - 1;
          return (
            <PhaseCard
              key={phase.id}
              phase={phase}
              status={status}
              isActive={isActive}
              isLocked={isLocked}
              isLast={isLast}
            />
          );
        })}
      </ol>

      {/* Зрелость — optional features. Не блокируют ничего, показываются
          сразу для тех, кто хочет полный обзор возможностей. */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <span className="size-2 rounded-full bg-[#9b9fb3]" />
          <h2 className="text-[16px] font-semibold text-[#0b1024]">
            Зрелость
          </h2>
          <span className="text-[12px] text-[#9b9fb3]">·</span>
          <span className="text-[12px] text-[#9b9fb3]">
            Bonus-фичи для зрелых организаций — настраивайте когда захотите
          </span>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {extras.map((item) => (
            <SetupCard key={item.title} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  status,
  isActive,
  isLocked,
  isLast,
}: {
  phase: Phase;
  status: "complete" | "active" | "locked";
  isActive: boolean;
  isLocked: boolean;
  isLast: boolean;
}) {
  const Icon = phase.icon;
  const required = phase.items.filter((i) => !i.optional);
  const requiredDone = required.filter((i) => i.state === "complete").length;

  // Тон карточки.
  const tone =
    status === "complete"
      ? {
          card: "border-[#c8f0d5] bg-[#ecfdf5]/40",
          numBg: "bg-[#136b2a] text-white",
          numRing: "ring-[#136b2a]/30",
          iconBg: "bg-[#d9f4e1]",
          iconClr: "text-[#136b2a]",
          titleClr: "text-[#0b1024]",
          connector: "bg-[#136b2a]/30",
        }
      : isActive
        ? {
            card: "border-[#5566f6]/40 bg-gradient-to-br from-white to-[#f5f6ff] shadow-[0_14px_36px_-18px_rgba(85,102,246,0.45)]",
            numBg: "bg-gradient-to-br from-[#5566f6] to-[#7a5cff] text-white",
            numRing: "ring-[#5566f6]/30",
            iconBg: "bg-[#eef1ff]",
            iconClr: "text-[#5566f6]",
            titleClr: "text-[#0b1024]",
            connector: "bg-[#dcdfed]",
          }
        : {
            card: "border-[#ececf4] bg-[#fafbff] opacity-70",
            numBg: "bg-[#dcdfed] text-[#6f7282]",
            numRing: "ring-transparent",
            iconBg: "bg-[#fafbff]",
            iconClr: "text-[#9b9fb3]",
            titleClr: "text-[#6f7282]",
            connector: "bg-[#dcdfed]",
          };

  // Пройденные этапы свёрнуты, активные и заблокированные раскрыты,
  // чтобы пользователь видел что ждёт впереди.
  const expanded = status !== "complete";

  return (
    <li className="relative">
      <div className="flex gap-4">
        {/* Number column with connector line */}
        <div className="relative flex flex-col items-center self-stretch">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-full text-[15px] font-semibold shadow-[0_8px_22px_-10px_rgba(11,16,36,0.25)] ring-4 ${tone.numBg} ${tone.numRing}`}
          >
            {status === "complete" ? (
              <CheckCircle2 className="size-5" />
            ) : isLocked ? (
              <Lock className="size-4" />
            ) : (
              phase.number
            )}
          </div>
          {!isLast ? (
            <div className={`mt-1 w-px flex-1 ${tone.connector}`} />
          ) : null}
        </div>

        {/* Body */}
        <div className={`flex-1 rounded-3xl border p-5 ${tone.card}`}>
          <div className="flex items-start gap-4">
            <span
              className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${tone.iconBg} ${tone.iconClr}`}
            >
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  className={`text-[16px] font-semibold leading-tight ${tone.titleClr}`}
                >
                  Этап {phase.number}. {phase.title}
                </h3>
                {status === "complete" ? (
                  <span className="rounded-full bg-[#136b2a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Готово
                  </span>
                ) : isActive ? (
                  <span className="rounded-full bg-[#5566f6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Сейчас
                  </span>
                ) : null}
                {required.length > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      status === "complete"
                        ? "bg-[#ecfdf5] text-[#136b2a]"
                        : "bg-[#eef1ff] text-[#3848c7]"
                    }`}
                  >
                    {requiredDone}/{required.length}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#6f7282]">
                {phase.subtitle}
              </p>
            </div>
          </div>

          {expanded && phase.items.length > 0 ? (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {phase.items.map((item) => (
                <SetupCard key={item.title} item={item} />
              ))}
            </div>
          ) : null}

          {expanded && phase.finalNode ? (
            <div className="mt-5">{phase.finalNode}</div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────

function SetupCard({ item }: { item: SetupItem }) {
  const Icon = item.icon;
  const stateMeta =
    item.state === "complete"
      ? {
          border: "border-[#c8f0d5]",
          iconBg: "bg-[#d9f4e1]",
          iconClr: "text-[#136b2a]",
          stateIcon: CheckCircle2,
          stateClr: "text-[#136b2a]",
        }
      : item.state === "partial"
        ? {
            border: "border-[#ffe9b0]",
            iconBg: "bg-[#fff8eb]",
            iconClr: "text-[#a13a32]",
            stateIcon: AlertTriangle,
            stateClr: "text-[#a13a32]",
          }
        : {
            border: item.optional ? "border-[#ececf4]" : "border-[#ffd2cd]",
            iconBg: item.optional ? "bg-[#fafbff]" : "bg-[#fff4f2]",
            iconClr: item.optional ? "text-[#9b9fb3]" : "text-[#a13a32]",
            stateIcon: XCircle,
            stateClr: item.optional ? "text-[#9b9fb3]" : "text-[#a13a32]",
          };
  const StateIcon = stateMeta.stateIcon;
  return (
    <Link
      href={item.href}
      className={`group flex items-start gap-3 rounded-2xl border ${stateMeta.border} bg-white p-4 transition-all hover:shadow-[0_8px_24px_-12px_rgba(85,102,246,0.18)]`}
    >
      <span
        className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${stateMeta.iconBg} ${stateMeta.iconClr}`}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[14px] font-semibold leading-tight text-[#0b1024]">
              {item.title}
              {item.optional ? (
                <span className="rounded-full bg-[#fafbff] px-1.5 py-0.5 text-[10px] font-medium text-[#9b9fb3]">
                  по желанию
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 text-[12px] leading-snug text-[#6f7282]">
              {item.description}
            </div>
          </div>
          <StateIcon className={`size-4 shrink-0 ${stateMeta.stateClr}`} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
          {item.metric ? (
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                item.state === "complete"
                  ? "bg-[#ecfdf5] text-[#136b2a]"
                  : "bg-[#fafbff] text-[#3c4053]"
              }`}
            >
              {item.metric}
            </span>
          ) : null}
          {item.issue ? (
            <span className="text-[#a13a32]">{item.issue}</span>
          ) : null}
        </div>
      </div>
      <ArrowRight className="size-4 shrink-0 self-center text-[#9b9fb3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────

/**
 * Финальный CTA для этапа TasksFlow — отправляет пользователя на
 * дашборд, где живёт «Превью отправки задач TasksFlow». Реальная
 * отправка идёт оттуда (а не отсюда), потому что dashboard-карточка
 * показывает per-журнал статус «получит / не получит» с причиной.
 */
function SendTasksCta({
  ready,
  activeDocumentsCount,
  tfLinkedUsersCount,
  tfConnected,
}: {
  ready: boolean;
  activeDocumentsCount: number;
  tfLinkedUsersCount: number;
  tfConnected: boolean;
}) {
  if (!ready) {
    const blockers: string[] = [];
    if (!tfConnected) blockers.push("Подключите TasksFlow в этом этапе");
    if (activeDocumentsCount === 0)
      blockers.push("Создайте документы в этапе 5");
    if (tfLinkedUsersCount === 0)
      blockers.push("Сотрудники должны привязать TG к TasksFlow");

    return (
      <section className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff8eb] text-[#a13a32]">
            <Clock className="size-5" />
          </span>
          <div className="flex-1">
            <h3 className="text-[15px] font-semibold text-[#0b1024]">
              Отправить первые задачи — пока недоступно
            </h3>
            <p className="mt-1 text-[13px] text-[#6f7282]">
              Сначала закройте обязательные пункты выше:
            </p>
            <ul className="mt-2 space-y-1">
              {blockers.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 text-[12px] text-[#a13a32]"
                >
                  <span className="mt-1 inline-flex size-1.5 shrink-0 rounded-full bg-[#a13a32]" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#5566f6]/30 bg-gradient-to-br from-[#5566f6] to-[#7a5cff] p-5 text-white shadow-[0_20px_50px_-20px_rgba(85,102,246,0.55)]">
      <div className="pointer-events-none absolute -right-16 -top-16 size-[280px] rounded-full bg-white/10 blur-[80px]" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 size-[220px] rounded-full bg-[#0b1024]/30 blur-[60px]" />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Send className="size-6" />
          </span>
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/70">
              Финал быстрого старта
            </div>
            <h3 className="mt-1 text-[18px] font-semibold leading-tight">
              Можно отправлять первые задачи
            </h3>
            <p className="mt-1 max-w-[480px] text-[13px] text-white/80">
              Откройте дашборд → карточка «Превью отправки задач TasksFlow».
              Там видно кому что уйдёт, и кнопка «Отправить готовые».
            </p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl bg-white px-5 text-[14px] font-semibold text-[#5566f6] shadow-[0_10px_24px_-12px_rgba(0,0,0,0.45)] transition-opacity hover:opacity-90"
        >
          <Sparkles className="size-4" />
          Открыть дашборд
        </Link>
      </div>
    </section>
  );
}
