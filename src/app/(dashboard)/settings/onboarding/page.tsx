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
  Lock,
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
import { OnboardingFinishCta } from "@/components/settings/onboarding-finish-cta";

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
    managerScopesCount,
    tfIntegration,
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
    db.inspectorToken.count({
      where: { organizationId, revokedAt: null },
    }),
    db.journalTemplate.count({
      where: { isActive: true, bonusAmountKopecks: { gt: 0 } },
    }),
    db.journalTemplate.count({ where: { isActive: true } }),
    // Сколько шаблонов уже имеет хотя бы одну ответственную должность
    // (per-position access rows) — для метрики «Ответственные за
    // журналы».
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
      .then(
        (rows) => rows.filter((r) => r._count.positionAccess > 0).length
      ),
    db.journalDocument.count({
      where: { organizationId, status: "active" },
    }),
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
      href: "/settings/organization",
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
      description:
        "Кто заполняет каждый журнал. Один клик — умные пресеты по ХАССП (бракераж → шеф, уборка → уборщикам)",
      href: "/settings/journal-responsibles",
      icon: Network,
      priority: "required",
      state:
        enabledTemplatesCount === 0
          ? "empty"
          : journalsWithResponsiblesCount >= enabledTemplatesCount
            ? "complete"
            : journalsWithResponsiblesCount > 0
              ? "partial"
              : "empty",
      metric: `${journalsWithResponsiblesCount}/${enabledTemplatesCount} настроено`,
      issue:
        journalsWithResponsiblesCount < enabledTemplatesCount
          ? `${enabledTemplatesCount - journalsWithResponsiblesCount} без ответственных — TasksFlow их пропустит`
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

  // Префлайт для CTA «Создать документы». Считаем готовность по тем
  // же параметрам, что и required-карточки, но в человеческих
  // формулировках для подсказки юзеру что именно ещё надо сделать.
  const finishMissing: string[] = [];
  if (positionsCount === 0) finishMissing.push("Создайте должности");
  if (activeUsersCount < 2) finishMissing.push("Добавьте сотрудников");
  if (buildingsCount === 0)
    finishMissing.push("Заведите здания и помещения (для уборки)");
  if (equipmentCount === 0)
    finishMissing.push("Добавьте оборудование (холодильники)");
  if (enabledTemplatesCount === 0)
    finishMissing.push("Включите хотя бы один журнал");
  if (
    enabledTemplatesCount > 0 &&
    journalsWithResponsiblesCount === 0
  )
    finishMissing.push("Назначьте ответственных за журналы");
  const finishReady = finishMissing.length === 0;

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

      <RequiredStepper items={required} />

      {/* Финальный CTA — блок становится «доступным» только когда
          обязательные шаги (должности, сотрудники, журналы,
          ответственные) проставлены. Один клик — создаёт документы. */}
      <OnboardingFinishCta
        prereqsReady={finishReady}
        missing={finishMissing}
        activeDocumentsCount={activeDocumentsCount}
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

/**
 * Поэтапный stepper для обязательной секции. Шаги проходятся по
 * порядку: первый незаполненный = «активный» (фиолетовый, с большой
 * кнопкой), следующие = «заблокированы» (серый замок, не кликаются).
 * Заполненные = зелёный чекмарк.
 *
 * Это enforcement через UX — юзер не может «перепрыгнуть» через шаг,
 * потому что физически не видит кнопку для следующих, пока не закроет
 * текущий. Так новый админ понимает «что делать прямо сейчас».
 */
function RequiredStepper({ items }: { items: SetupItem[] }) {
  // Активный = первый item у которого state != "complete".
  const activeIndex = items.findIndex((i) => i.state !== "complete");
  const allDone = activeIndex === -1;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <span className="size-2 rounded-full bg-[#a13a32]" />
        <h2 className="text-[16px] font-semibold text-[#0b1024]">
          Обязательное · поэтапно
        </h2>
        <span className="text-[12px] text-[#9b9fb3]">·</span>
        <span className="text-[12px] text-[#9b9fb3]">
          Идёт строго по порядку — следующий шаг разблокируется когда
          закрыт предыдущий
        </span>
      </div>
      <ol className="space-y-2.5">
        {items.map((item, index) => {
          let state: "done" | "active" | "locked";
          if (item.state === "complete") state = "done";
          else if (allDone || index === activeIndex) state = "active";
          else if (index < activeIndex) state = "done"; // partial считаем done для линии
          else state = "locked";
          return (
            <StepperRow
              key={item.title}
              item={item}
              index={index}
              state={state}
              isLast={index === items.length - 1}
            />
          );
        })}
      </ol>
    </section>
  );
}

function StepperRow({
  item,
  index,
  state,
  isLast,
}: {
  item: SetupItem;
  index: number;
  state: "done" | "active" | "locked";
  isLast: boolean;
}) {
  const Icon = item.icon;
  const isActive = state === "active";
  const isLocked = state === "locked";
  const isDone = state === "done";

  // Цветовая палитра по состоянию.
  const tone =
    isActive
      ? {
          card: "border-[#5566f6]/40 bg-gradient-to-br from-white to-[#f5f6ff]",
          numBg: "bg-gradient-to-br from-[#5566f6] to-[#7a5cff] text-white",
          iconBg: "bg-[#eef1ff]",
          iconClr: "text-[#5566f6]",
          title: "text-[#0b1024]",
        }
      : isDone
        ? {
            card: "border-[#c8f0d5] bg-[#ecfdf5]/40",
            numBg: "bg-[#136b2a] text-white",
            iconBg: "bg-[#d9f4e1]",
            iconClr: "text-[#136b2a]",
            title: "text-[#0b1024]",
          }
        : {
            card: "border-[#ececf4] bg-[#fafbff] opacity-60",
            numBg: "bg-[#dcdfed] text-[#6f7282]",
            iconBg: "bg-[#fafbff]",
            iconClr: "text-[#9b9fb3]",
            title: "text-[#6f7282]",
          };

  const content = (
    <div className="flex items-start gap-4">
      {/* Number + connector */}
      <div className="relative flex flex-col items-center self-stretch">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold shadow-[0_4px_12px_-4px_rgba(11,16,36,0.18)] ${tone.numBg}`}
        >
          {isDone ? <CheckCircle2 className="size-4" /> : index + 1}
        </div>
        {!isLast ? (
          <div
            className={`mt-1 w-px flex-1 ${
              isDone ? "bg-[#136b2a]/40" : "bg-[#dcdfed]"
            }`}
          />
        ) : null}
      </div>
      {/* Body */}
      <div className="min-w-0 flex-1 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div
              className={`flex items-center gap-2 text-[15px] font-semibold leading-tight ${tone.title}`}
            >
              <span
                className={`flex size-7 items-center justify-center rounded-xl ${tone.iconBg} ${tone.iconClr}`}
              >
                <Icon className="size-4" />
              </span>
              {item.title}
              {isActive ? (
                <span className="rounded-full bg-[#5566f6] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Сейчас
                </span>
              ) : null}
              {isLocked ? (
                <Lock className="size-3.5 text-[#9b9fb3]" />
              ) : null}
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#6f7282]">
              {item.description}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              {item.metric ? (
                <span
                  className={`rounded-full px-2 py-0.5 font-medium ${
                    isDone
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
          {isActive ? (
            <Link
              href={item.href}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-2xl bg-[#5566f6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_22px_-10px_rgba(85,102,246,0.6)] transition-colors hover:bg-[#4a5bf0]"
            >
              Перейти
              <ArrowRight className="size-4" />
            </Link>
          ) : isDone ? (
            <Link
              href={item.href}
              className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[#c8f0d5] bg-white px-3 text-[12px] font-medium text-[#136b2a] hover:bg-[#ecfdf5]"
            >
              Изменить
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <li>
      <div
        className={`rounded-2xl border p-4 transition-shadow ${tone.card} ${
          isActive
            ? "shadow-[0_14px_36px_-18px_rgba(85,102,246,0.45)]"
            : ""
        }`}
      >
        {content}
      </div>
    </li>
  );
}
