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
  CloudUpload,
  Coins,
  CreditCard,
  FileSpreadsheet,
  Layers,
  ListChecks,
  Network,
  Package,
  PartyPopper,
  Plug,
  ScrollText,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Priority = "required" | "recommended" | "optional";
type State = "complete" | "partial" | "empty";

type SetupItem = {
  title: string;
  description: string;
  href: string;
  icon: typeof Sparkles;
  priority: Priority;
  state: State;
  metric?: string;
  issue?: string;
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
    docsWithResponsibleCount,
    docsTotalCount,
    managerScopesCount,
    tfIntegration,
    inspectorTokensCount,
    bonusJournalsCount,
    activeTemplatesCount,
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
    db.journalDocument.count({
      where: {
        organizationId,
        status: "active",
        responsibleUserId: { not: null },
      },
    }),
    db.journalDocument.count({
      where: { organizationId, status: "active" },
    }),
    db.managerScope.count({ where: { organizationId } }),
    db.tasksFlowIntegration.findFirst({
      where: { organizationId, enabled: true },
      select: { id: true, label: true },
    }),
    db.inspectorToken.count({
      where: { organizationId, revokedAt: null },
    }),
    db.journalTemplate.count({
      where: { isActive: true, bonusAmountKopecks: { gt: 0 } },
    }),
    db.journalTemplate.count({ where: { isActive: true } }),
  ]);

  const disabled = Array.isArray(org?.disabledJournalCodes)
    ? (org!.disabledJournalCodes as string[]).length
    : 0;
  const enabledTemplatesCount = activeTemplatesCount - disabled;
  const pipelinesCount = org?.journalPipelinesJson
    ? Object.keys(org.journalPipelinesJson as Record<string, unknown>).length
    : 0;

  const items: SetupItem[] = [
    // === REQUIRED ===
    {
      title: "Информация об организации",
      description: "Название, ИНН, адрес — для договоров и printable PDF",
      href: "/settings",
      icon: Building2,
      priority: "required",
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
    },
    {
      title: "Должности",
      description: "Шеф, повар, продавец, уборщик — для распределения задач",
      href: "/settings/users",
      icon: ListChecks,
      priority: "required",
      state: positionsCount === 0 ? "empty" : "complete",
      metric: `${positionsCount}`,
      issue: positionsCount === 0 ? "Создайте хотя бы 4 должности" : undefined,
    },
    {
      title: "Сотрудники",
      description: "Минимум: админ + 1 человек на каждую должность",
      href: "/settings/users",
      icon: Users,
      priority: "required",
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
    },
    {
      title: "Здания и помещения",
      description: "Для журнала уборки — список комнат / зон",
      href: "/settings/buildings",
      icon: Building2,
      priority: "required",
      state:
        buildingsCount === 0
          ? "empty"
          : roomsCount === 0
            ? "partial"
            : "complete",
      metric: `${buildingsCount} зданий, ${roomsCount} помещений`,
      issue:
        buildingsCount === 0
          ? "Создайте здание (точку бизнеса)"
          : roomsCount === 0
            ? "Добавьте помещения внутри здания"
            : undefined,
    },
    {
      title: "Оборудование",
      description: "Холодильники с tempMin/tempMax — для журнала температур",
      href: "/settings/equipment",
      icon: Wrench,
      priority: "required",
      state: equipmentCount === 0 ? "empty" : "complete",
      metric: `${equipmentCount}`,
      issue:
        equipmentCount === 0
          ? "Добавьте холодильники / морозильники"
          : undefined,
    },
    {
      title: "Набор журналов",
      description: "Какие из 35 журналов ваша компания реально ведёт",
      href: "/settings/journals",
      icon: ClipboardList,
      priority: "required",
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
    },
    {
      title: "Ответственные за журналы",
      description: "Кто отвечает за каждый активный документ",
      href: "/settings/journal-access",
      icon: Network,
      priority: "required",
      state:
        docsTotalCount === 0
          ? "empty"
          : docsWithResponsibleCount === docsTotalCount
            ? "complete"
            : docsWithResponsibleCount > 0
              ? "partial"
              : "empty",
      metric: `${docsWithResponsibleCount}/${docsTotalCount}`,
      issue:
        docsWithResponsibleCount < docsTotalCount
          ? `${docsTotalCount - docsWithResponsibleCount} журналов без ответственного`
          : undefined,
    },

    // === RECOMMENDED ===
    {
      title: "Permission-пресеты сотрудникам",
      description: "Выставить admin / head_chef / cook / seller / cashier",
      href: "/settings/role-presets",
      icon: ShieldCheck,
      priority: "recommended",
      state:
        usersWithPreset === 0
          ? "empty"
          : usersWithPreset === activeUsersCount
            ? "complete"
            : "partial",
      metric: `${usersWithPreset}/${activeUsersCount}`,
      issue:
        usersWithPreset < activeUsersCount
          ? `${activeUsersCount - usersWithPreset} без preset'а — попадают на дефолт по role`
          : undefined,
    },
    {
      title: "Иерархия управления",
      description: "Заведующая видит своих сотрудников через ManagerScope",
      href: "/settings/staff-hierarchy",
      icon: Network,
      priority: "recommended",
      state: managerScopesCount === 0 ? "empty" : "complete",
      metric: `${managerScopesCount}`,
      issue:
        managerScopesCount === 0
          ? "Без ManagerScope head_chef видит всех — но это не масштабируется"
          : undefined,
    },
    {
      title: "Telegram-приглашения",
      description: "Сотрудники подключают @wesetupbot и получают задачи",
      href: "/settings/users",
      icon: Bell,
      priority: "recommended",
      state:
        usersWithTg === 0
          ? "empty"
          : usersWithTg === activeUsersCount
            ? "complete"
            : "partial",
      metric: `${usersWithTg}/${activeUsersCount}`,
      issue:
        usersWithTg < activeUsersCount
          ? `${activeUsersCount - usersWithTg} не подключили TG — не получат задачи`
          : undefined,
    },
    {
      title: "Pipeline-инструкции",
      description:
        "Пошаговое ТЗ для каждого журнала — чем подробнее, тем меньше вопросов",
      href: "/settings/journal-pipelines",
      icon: ListChecks,
      priority: "recommended",
      state:
        pipelinesCount === 0
          ? "empty"
          : pipelinesCount < 3
            ? "partial"
            : "complete",
      metric: `${pipelinesCount} настроено`,
      issue:
        pipelinesCount === 0
          ? "Без pipeline сотрудник заполняет «как поймёт»"
          : undefined,
    },
    {
      title: "Режим распределения задач",
      description: "Гонка / Свободно / Только админ — стиль работы команды",
      href: "/settings/journal-flow",
      icon: Shuffle,
      priority: "recommended",
      state: org?.taskFlowMode ? "complete" : "empty",
      metric:
        org?.taskFlowMode === "race"
          ? "Гонка"
          : org?.taskFlowMode === "shared"
            ? "Свободно"
            : org?.taskFlowMode === "manual"
              ? "Только админ"
              : "Не выбран",
    },
    {
      title: "TasksFlow",
      description: "Задачи синхронизируются с Telegram-ботом TasksFlow",
      href: "/settings/integrations/tasksflow",
      icon: Plug,
      priority: "recommended",
      state: tfIntegration ? "complete" : "empty",
      metric: tfIntegration?.label ?? undefined,
      issue: tfIntegration ? undefined : "Без TF — claim'ы только в WeSetup",
    },

    // === OPTIONAL ===
    {
      title: "Уведомления",
      description: "Кто получает Telegram-алерты при out-of-range / CAPA",
      href: "/settings/notifications",
      icon: Bell,
      priority: "optional",
      state: "complete",
      metric: "Default",
    },
    {
      title: "Compliance / закрытие дня",
      description:
        "Кто может править выполненные записи и через сколько закрывается день",
      href: "/settings/compliance",
      icon: ShieldCheck,
      priority: "optional",
      state: "complete",
    },
    {
      title: "Премии за журналы",
      description: "Бонусы сотрудникам за заполнение премиальных журналов",
      href: "/settings/journal-bonuses",
      icon: Coins,
      priority: "optional",
      state: bonusJournalsCount === 0 ? "empty" : "complete",
      metric: `${bonusJournalsCount} премиальных`,
    },
    {
      title: "График смен",
      description: "Расписание для авто-назначений и компенсаций",
      href: "/settings/schedule",
      icon: Layers,
      priority: "optional",
      state: "empty",
    },
    {
      title: "Авто-бэкап на Я.Диск",
      description: "Еженедельный JSON-дамп всех журналов в облако",
      href: "/settings/backup",
      icon: CloudUpload,
      priority: "optional",
      state: "empty",
    },
    {
      title: "Бухгалтерия (1С)",
      description: "Еженедельный отчёт списаний на email бухгалтера",
      href: "/settings/accounting",
      icon: FileSpreadsheet,
      priority: "optional",
      state: "empty",
    },
    {
      title: "Портал инспектора (СЭС/РПН)",
      description: "Read-only ссылка с TTL для проверяющих органов",
      href: "/settings/inspector-portal",
      icon: ShieldCheck,
      priority: "optional",
      state: inspectorTokensCount === 0 ? "empty" : "complete",
      metric: `${inspectorTokensCount} активных токенов`,
    },
    {
      title: "Справочник продуктов",
      description: "Импорт из Excel / iiko / 1С — для списаний и приёмок",
      href: "/settings/products",
      icon: Package,
      priority: "optional",
      state: "empty",
    },
    {
      title: "Подписка",
      description: "Тариф и период оплаты",
      href: "/settings/subscription",
      icon: CreditCard,
      priority: "optional",
      state: "complete",
    },
    {
      title: "Аудит-журнал",
      description: "Кто что менял в системе — для compliance-проверок",
      href: "/settings/audit",
      icon: ScrollText,
      priority: "optional",
      state: "complete",
    },
  ];

  const required = items.filter((i) => i.priority === "required");
  const recommended = items.filter((i) => i.priority === "recommended");
  const optional = items.filter((i) => i.priority === "optional");

  const requiredDone = required.filter((i) => i.state === "complete").length;
  const recommendedDone = recommended.filter((i) => i.state === "complete").length;
  const overallProgress = Math.round(
    ((requiredDone * 3 + recommendedDone) /
      (required.length * 3 + recommended.length)) *
      100
  );

  const isReady = requiredDone === required.length;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Настройки
          </Link>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                {isReady ? (
                  <PartyPopper className="size-6" />
                ) : (
                  <Sparkles className="size-6" />
                )}
              </div>
              <div>
                <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                  {isReady ? "Готово к работе" : "Быстрая настройка"}
                </h1>
                <p className="mt-2 max-w-[640px] text-[15px] text-white/70">
                  Чек-лист всего функционала: обязательное → рекомендуемое →
                  опциональное. Зелёные ✓ — настроено. Красные ⚠ — нужно
                  настроить, иначе часть фич не сработает.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="text-[12px] uppercase tracking-[0.16em] text-white/60">
                Готовность
              </div>
              <div className="text-[36px] font-semibold leading-none">
                {overallProgress}<span className="text-white/50">%</span>
              </div>
              <div className="text-[12px] text-white/60">
                {requiredDone}/{required.length} обязательных
              </div>
            </div>
          </div>
        </div>
      </section>

      {!isReady ? (
        <div className="rounded-2xl border border-[#ffe9b0] bg-[#fff8eb] p-4 text-[13px] text-[#a13a32]">
          ⚠ Не все обязательные настройки заполнены. Поэтому «Отправить
          всем в TasksFlow» и автозадачи могут пропускать журналы без
          ответственного / без подключённых сотрудников.
        </div>
      ) : null}

      <SectionGroup
        title="Обязательное"
        subtitle="Без этого не работают core-фичи"
        accent="warn"
        items={required}
      />
      <SectionGroup
        title="Рекомендуемое"
        subtitle="По приоритету — каждое усиливает систему"
        accent="info"
        items={recommended}
      />
      <SectionGroup
        title="Опциональное"
        subtitle="Bonus-функционал для зрелых организаций"
        accent="muted"
        items={optional}
      />
    </div>
  );
}

function SectionGroup({
  title,
  subtitle,
  accent,
  items,
}: {
  title: string;
  subtitle: string;
  accent: "warn" | "info" | "muted";
  items: SetupItem[];
}) {
  const dotColor =
    accent === "warn"
      ? "bg-[#a13a32]"
      : accent === "info"
        ? "bg-[#3848c7]"
        : "bg-[#9b9fb3]";
  return (
    <section className="space-y-3">
      <div className="px-1">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${dotColor}`} />
          <h2 className="text-[16px] font-semibold text-[#0b1024]">{title}</h2>
          <span className="text-[12px] text-[#9b9fb3]">·</span>
          <span className="text-[12px] text-[#9b9fb3]">{subtitle}</span>
        </div>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {items.map((item) => (
          <SetupCard key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}

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
            border:
              item.priority === "required"
                ? "border-[#ffd2cd]"
                : "border-[#ececf4]",
            iconBg:
              item.priority === "required" ? "bg-[#fff4f2]" : "bg-[#fafbff]",
            iconClr:
              item.priority === "required"
                ? "text-[#a13a32]"
                : "text-[#9b9fb3]",
            stateIcon: XCircle,
            stateClr:
              item.priority === "required"
                ? "text-[#a13a32]"
                : "text-[#9b9fb3]",
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
            <div className="text-[14px] font-semibold leading-tight text-[#0b1024]">
              {item.title}
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
