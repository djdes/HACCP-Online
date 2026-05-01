import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Building2,
  ClipboardList,
  CloudUpload,
  Coins,
  CreditCard,
  FileSpreadsheet,
  Gauge,
  KeyRound,
  ListChecks,
  Package,
  Phone,
  Sparkles,
  Plug,
  Scale,
  ScrollText,
  Settings2,
  ShieldCheck,
  Shuffle,
  CalendarRange,
  Users,
  Wrench,
  Network,
} from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { PageGuide } from "@/components/ui/page-guide";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { hasCapability } from "@/lib/permission-presets";
// ThemeSwitcher убран отсюда — занимал много места. Переключатель темы
// живёт компактной иконкой-popover'ом в шапке (ThemeQuickSwitch).

export const dynamic = "force-dynamic";

const settingsCards = [
  {
    title: "Быстрая настройка",
    description: "За 3 шага: должности, сотрудники, TasksFlow",
    href: "/settings/onboarding",
    icon: Sparkles,
    iconClass: "text-[#5566f6]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Информация об организации",
    description: "Название, ИНН, адрес, бренд, часовой пояс — для договоров и printable PDF",
    href: "/settings/organization",
    icon: Building2,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Цеха и участки",
    description: "Производственные зоны и помещения",
    href: "/settings/areas",
    icon: Building2,
    iconClass: "text-[#5566f6]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Здания и помещения",
    description:
      "Точки бизнеса (корпуса) и помещения внутри — для журнала уборки",
    href: "/settings/buildings",
    icon: Building2,
    iconClass: "text-[#5566f6]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Оборудование",
    description: "Холодильники, печи, датчики",
    href: "/settings/equipment",
    icon: Wrench,
    iconClass: "text-[#7a5cff]",
    bgClass: "bg-[#f0edff]",
  },
  {
    title: "Сотрудники",
    description: "Роли, доступы, приглашения",
    href: "/settings/users",
    icon: Users,
    iconClass: "text-[#0ea5e9]",
    bgClass: "bg-[#e8f7ff]",
  },
  {
    title: "Иерархия управления",
    description: "Кто каких сотрудников видит и кому назначает",
    href: "/settings/staff-hierarchy",
    icon: Network,
    iconClass: "text-[#f59e0b]",
    bgClass: "bg-[#fff8eb]",
  },
  {
    title: "Видимость по должностям",
    description: "Кого видит каждая должность — драйвит TasksFlow и бот",
    href: "/settings/position-staff-visibility",
    icon: Users,
    iconClass: "text-[#0ea5e9]",
    bgClass: "bg-[#e8f7ff]",
  },
  {
    title: "Набор журналов",
    description: "Какие журналы ваша компания ведёт",
    href: "/settings/journals",
    icon: ClipboardList,
    iconClass: "text-[#d946ef]",
    bgClass: "bg-[#fdf4ff]",
  },
  {
    title: "Настройки журналов (pipeline)",
    description:
      "Pipeline-инструкции для каждого журнала — что взять, куда идти, что делать",
    href: "/settings/journal-pipelines",
    icon: ListChecks,
    iconClass: "text-[#5566f6]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Режим распределения задач",
    description:
      "Как сотрудники получают задачи: гонка / свободно / только админ",
    href: "/settings/journal-flow",
    icon: Shuffle,
    iconClass: "text-[#7a5cff]",
    bgClass: "bg-[#f0edff]",
  },
  {
    title: "Пресеты ролей",
    description:
      "Какие возможности у каждого preset'а (admin / head_chef / cook / …)",
    href: "/settings/role-presets",
    icon: ShieldCheck,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Периоды журналов",
    description:
      "На какой срок создаётся каждый журнал — месяц, N дней, год…",
    href: "/settings/journal-periods",
    icon: CalendarRange,
    iconClass: "text-[#10b981]",
    bgClass: "bg-[#ecfdf5]",
  },
  {
    title: "Справочник продуктов",
    description: "Импорт из Excel, iiko, 1С",
    href: "/settings/products",
    icon: Package,
    iconClass: "text-[#f59e0b]",
    bgClass: "bg-[#fff8eb]",
  },
  {
    title: "Привязка телефона",
    description: "Связать аккаунт с TasksFlow по номеру",
    href: "/settings/phone",
    icon: Phone,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Автосоздание журналов",
    description: "Чтобы каждый месяц не заводить вручную",
    href: "/settings/auto-journals",
    icon: Sparkles,
    iconClass: "text-[#5566f6]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Права доступа",
    description: "Группы, должности, индивидуальные права",
    href: "/settings/permissions",
    icon: ShieldCheck,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "График смен",
    description: "Кто сегодня на смене — для авто-назначений",
    href: "/settings/schedule",
    icon: CalendarRange,
    iconClass: "text-[#10b981]",
    bgClass: "bg-[#ecfdf5]",
  },
  {
    title: "Журналы для сотрудников",
    description: "Кто какие журналы видит и заполняет",
    href: "/settings/journal-access",
    icon: KeyRound,
    iconClass: "text-[#5566f6]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Ответственные за журналы",
    description:
      "Кто заполняет каждый журнал. Один клик — умные пресеты (уборка → уборщикам)",
    href: "/settings/journal-responsibles",
    icon: Network,
    iconClass: "text-[#7a5cff]",
    bgClass: "bg-[#f0edff]",
  },
  {
    title: "Режимы раздачи задач",
    description:
      "Уборку — по помещениям, гигиену — по сотрудникам, бракераж — одной сводкой. Гибкая настройка под вашу кухню",
    href: "/settings/journal-task-mode",
    icon: Settings2,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Сложность журналов",
    description:
      "Если в команде нет шеф-повара — поставьте сложность 1-5 и распределите задачи между поварами равномерно",
    href: "/settings/journal-difficulty",
    icon: Gauge,
    iconClass: "text-[#a16d32]",
    bgClass: "bg-[#fff8eb]",
  },
  {
    title: "Распределение задач",
    description:
      "Кто сколько журналов ведёт в месяц — таблица с подсветкой перекоса между поварами на одинаковой зарплате",
    href: "/settings/workload-balance",
    icon: Scale,
    iconClass: "text-[#10b981]",
    bgClass: "bg-[#ecfdf5]",
  },
  {
    title: "Иерархия журналов по должностям",
    description: "Тот же выбор, но в виде матрицы должность × журнал — для power-юзеров",
    href: "/settings/journals-by-position",
    icon: Network,
    iconClass: "text-[#7a5cff]",
    bgClass: "bg-[#f0edff]",
  },
  {
    title: "Премии за журналы",
    description: "Сколько ₽ за «единичные» журналы — мотивация в TasksFlow",
    href: "/settings/journal-bonuses",
    icon: Coins,
    iconClass: "text-[#b45309]",
    bgClass: "bg-[#fef3c7]",
  },
  {
    title: "Уведомления",
    description: "Telegram-бот, типы оповещений",
    href: "/settings/notifications",
    icon: Bell,
    iconClass: "text-[#10b981]",
    bgClass: "bg-[#ecfdf5]",
  },
  {
    title: "Подписка",
    description: "Тариф и период подписки",
    href: "/settings/subscription",
    icon: CreditCard,
    iconClass: "text-[#ec4899]",
    bgClass: "bg-[#fdf2f8]",
  },
  {
    title: "Журнал действий",
    description: "Аудит всех событий",
    href: "/settings/audit",
    icon: ScrollText,
    iconClass: "text-[#6b7280]",
    bgClass: "bg-[#f3f4f6]",
  },
  {
    title: "Compliance",
    description: "Кто может править выполненные записи журналов",
    href: "/settings/compliance",
    icon: ShieldCheck,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Портал инспектора",
    description: "Read-only ссылка для СЭС / Роспотребнадзора с TTL",
    href: "/settings/inspector-portal",
    icon: ShieldCheck,
    iconClass: "text-[#10b981]",
    bgClass: "bg-[#ecfdf5]",
  },
  {
    title: "Справочник СанПиН",
    description: "Нормативы и требования",
    href: "/sanpin",
    icon: BookOpen,
    iconClass: "text-[#14b8a6]",
    bgClass: "bg-[#f0fdfa]",
  },
  {
    title: "API интеграций",
    description: "Ключ для внешних систем и датчиков",
    href: "/settings/api",
    icon: KeyRound,
    iconClass: "text-[#8b5cf6]",
    bgClass: "bg-[#f5f3ff]",
  },
  {
    title: "TasksFlow",
    description: "Автозадачи уборщикам через tasksflow.ru",
    href: "/settings/integrations/tasksflow",
    icon: Plug,
    iconClass: "text-[#0ea5e9]",
    bgClass: "bg-[#e8f7ff]",
  },
  {
    title: "Авто-бэкап на Я.Диск",
    description: "Еженедельный JSON-дамп журналов в облако",
    href: "/settings/backup",
    icon: CloudUpload,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
  {
    title: "Бухгалтерия",
    description: "Еженедельная выгрузка списаний в 1С на email",
    href: "/settings/accounting",
    icon: FileSpreadsheet,
    iconClass: "text-[#3848c7]",
    bgClass: "bg-[#eef1ff]",
  },
];

export default async function SettingsPage() {
  const session = await requireAuth();
  // /settings — только admin'у. Заведующая (head_chef) попадала сюда
  // через legacy role=owner, видела карточки, кликала «Pipeline»/«Режим
  // задач»/«Пресеты» — мои страницы внутри проверяют admin.full и
  // редиректили на /journals. Чиним: head_chef сразу на /control-board.
  if (!hasCapability(session.user, "admin.full")) {
    if (hasCapability(session.user, "tasks.verify")) {
      redirect("/control-board");
    }
    if (!hasFullWorkspaceAccess(session.user)) {
      redirect("/journals");
    }
    // Manager без admin.full и без tasks.verify — оставляем legacy
    // /journals (на будущее когда manager preset появится).
    redirect("/journals");
  }
  const orgId = getActiveOrgId(session);

  const [areaCount, equipmentCount, userCount, productCount] =
    await Promise.all([
      db.area.count({ where: { organizationId: orgId } }),
      db.equipment.count({
        where: { area: { organizationId: orgId } },
      }),
      db.user.count({ where: { organizationId: orgId, isActive: true } }),
      db.product.count({ where: { organizationId: orgId, isActive: true } }),
    ]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage:
              "radial-gradient(ellipse at 30% 40%, black 40%, transparent 70%)",
          }}
        />
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Settings2 className="size-6" />
            </div>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                Настройки
              </h1>
              <p className="mt-1 text-[15px] text-white/70">
                {session.user.organizationName}
              </p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatPill label="Цехов" value={areaCount} />
            <StatPill label="Оборудования" value={equipmentCount} />
            <StatPill label="Сотрудников" value={userCount} />
            <StatPill label="Продуктов" value={productCount} />
          </div>
        </div>
      </section>

      <PageGuide
        storageKey="settings-hub"
        title="С чего начать новой команде"
        bullets={[
          {
            title: "Старт",
            body: "Запишите ИНН/адрес, добавьте сотрудников, настройте журналы которые ведёте.",
          },
          {
            title: "Команда и доступы",
            body: "Должности, иерархия (кто кого видит), пресеты прав ролей.",
          },
          {
            title: "Журналы",
            body: "Кто заполняет каждый журнал (Ответственные), как раздавать задачи в TasksFlow (Режимы), и какие журналы вообще нужны вашей кухне.",
          },
          {
            title: "Интеграции",
            body: "TasksFlow для смартфон-задач, Telegram для уведомлений, инспектор-портал для проверок.",
          },
        ]}
        qa={[
          {
            q: "Что если сделал что-то не так",
            a: "Большинство настроек обратимы — открой ту же страницу и поменяй. Опасные действия (удалить документы, изменить во всех) всегда спрашивают подтверждение.",
          },
          {
            q: "Сотрудник не видит задачи в TasksFlow",
            a: "Скорее всего у него нет TasksFlow-привязки. Зайди в «Сотрудники» и убедись что у него есть телефон + он принят в TasksFlow.",
          },
        ]}
      />

      {/* Card grid — сгруппирована по разделам, чтобы не оверлоадить
          новый админ. Сначала «Старт» (быстрая настройка), потом
          по логике действий. «Дополнительно» — collapsible, с
          редко-нужными вещами. */}
      <SettingsGroup
        title="Старт"
        subtitle="Минимум, чтобы запустить работу"
        items={settingsCards.filter((c) =>
          GROUP_START.has(c.href as string)
        )}
      />
      <SettingsGroup
        title="Команда и доступы"
        subtitle="Сотрудники, должности, иерархия"
        items={settingsCards.filter((c) =>
          GROUP_TEAM.has(c.href as string)
        )}
      />
      <SettingsGroup
        title="Журналы"
        subtitle="Что заполнять, кому, как и когда"
        items={settingsCards.filter((c) =>
          GROUP_JOURNALS.has(c.href as string)
        )}
      />
      <SettingsGroup
        title="Интеграции"
        subtitle="TasksFlow, Telegram, бухгалтерия"
        items={settingsCards.filter((c) =>
          GROUP_INTEGRATIONS.has(c.href as string)
        )}
      />
      <details className="group">
        <summary className="cursor-pointer list-none px-1 py-2 text-[14px] font-semibold text-[#6f7282] hover:text-[#0b1024]">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
          Дополнительно — для опытных
        </summary>
        <div className="mt-3">
          <SettingsGroup
            title=""
            subtitle=""
            items={settingsCards.filter((c) =>
              GROUP_ADVANCED.has(c.href as string)
            )}
          />
        </div>
      </details>
    </div>
  );
}

const GROUP_START = new Set([
  "/settings/onboarding",
  "/settings/organization",
  "/settings/users",
  "/settings/buildings",
  "/settings/equipment",
  "/settings/journals",
]);
const GROUP_TEAM = new Set([
  "/settings/role-presets",
  "/settings/staff-hierarchy",
  "/settings/position-staff-visibility",
  "/settings/permissions",
  "/settings/schedule",
  "/settings/phone",
]);
const GROUP_JOURNALS = new Set([
  "/settings/journal-responsibles",
  "/settings/journal-pipelines",
  "/settings/journal-flow",
  "/settings/journal-periods",
  "/settings/journal-bonuses",
  "/settings/journal-difficulty",
  "/settings/workload-balance",
  "/settings/auto-journals",
  "/settings/journal-access",
  "/settings/journals-by-position",
  "/settings/areas",
  "/settings/products",
]);
const GROUP_INTEGRATIONS = new Set([
  "/settings/integrations/tasksflow",
  "/settings/notifications",
  "/settings/accounting",
]);
const GROUP_ADVANCED = new Set([
  "/settings/api",
  "/settings/backup",
  "/settings/audit",
  "/settings/compliance",
  "/settings/inspector-portal",
  "/sanpin",
  "/settings/subscription",
]);

function SettingsGroup({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: typeof settingsCards;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      {title ? (
        <div className="px-1">
          <h2 className="text-[16px] font-semibold text-[#0b1024]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-[12px] text-[#6f7282]">{subtitle}</p>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="group">
              <div className="flex h-full items-start gap-4 rounded-2xl border border-[#ececf4] bg-white px-5 py-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:border-[#d6d9ee] hover:shadow-[0_8px_24px_-12px_rgba(85,102,246,0.18)]">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${card.bgClass}`}
                >
                  <Icon className={`size-5 ${card.iconClass}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[15px] font-semibold text-[#0b1024]">
                      {card.title}
                    </div>
                    <ArrowRight className="size-4 text-[#c7ccea] transition-all group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
                  </div>
                  <div className="mt-1 text-[13px] text-[#6f7282]">
                    {card.description}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
      <div className="text-[24px] font-semibold leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[12px] text-white/60">{label}</div>
    </div>
  );
}
