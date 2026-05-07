import { db } from "@/lib/db";
import {
  QuickStartCardCompact,
  QuickStartCardFull,
  type QuickStartItem,
} from "./quick-start-card-client";

/**
 * Server-side компонент: считает прогресс настройки организации и
 * отдаёт client-side card. Если ВСЁ настроено — возвращает null
 * (auto-hide). Если что-то не настроено — карточка сама решает,
 * показать развёрнуто или свернуто (по localStorage).
 *
 * Items идут от самого критичного (без чего журналы не работают) к
 * second-tier (приятно иметь, но не блокирует). Каждая блок-карточка
 * ведёт на свою настроечную страницу.
 */
/**
 * Server-side компонент. Считает прогресс настройки и рендерит:
 *   • mode="compact" (default, на /dashboard) — компактная карточка
 *     с прогрессом и одной большой кнопкой «Открыть быстрый старт»
 *     → /settings/onboarding. Auto-hide когда всё done.
 *   • mode="full" (на /settings/onboarding) — полная grid из 16
 *     карточек с описанием каждого шага. Не скрывается.
 */
export async function QuickStartCard({
  organizationId,
  mode = "compact",
}: {
  organizationId: string;
  mode?: "compact" | "full";
}) {
  const [
    org,
    positionsCount,
    activeUsersCount,
    areasCount,
    equipmentCount,
    productsCount,
    enabledJournalCount,
    responsiblesAssignedCount,
    activeDocumentsCount,
    pipelineNodesCount,
    tasksflowIntegration,
    usersWithTelegramCount,
    checklistItemsCount,
    autoJournalsCount,
  ] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: {
        name: true,
        inn: true,
        address: true,
        phone: true,
        journalResponsibleUsersJson: true,
      },
    }),
    db.jobPosition.count({ where: { organizationId } }),
    db.user.count({
      where: {
        organizationId,
        isActive: true,
        archivedAt: null,
        // Считаем только сотрудников, не самого админа
      },
    }),
    db.area.count({ where: { organizationId } }),
    db.equipment.count({ where: { area: { organizationId } } }),
    db.product.count({ where: { organizationId } }),
    db.journalTemplate.count({ where: { isActive: true } }).then(() => {
      // Сколько journal-кодов НЕ в disabledJournalCodes для этой орги
      return db.organization
        .findUnique({
          where: { id: organizationId },
          select: { disabledJournalCodes: true },
        })
        .then(async (r) => {
          const disabled = Array.isArray(r?.disabledJournalCodes)
            ? (r!.disabledJournalCodes as string[])
            : [];
          const totalActive = await db.journalTemplate.count({
            where: { isActive: true, code: { notIn: disabled } },
          });
          return totalActive;
        });
    }),
    Promise.resolve(0).then(async () => {
      const row = await db.organization.findUnique({
        where: { id: organizationId },
        select: { journalResponsibleUsersJson: true },
      });
      const json = row?.journalResponsibleUsersJson;
      if (!json || typeof json !== "object" || Array.isArray(json)) return 0;
      // Считаем сколько журналов имеют хотя бы 1 заполненный slot.
      const obj = json as Record<string, Record<string, string | null>>;
      let filledJournals = 0;
      for (const slots of Object.values(obj)) {
        if (
          slots &&
          typeof slots === "object" &&
          Object.values(slots).some((v) => typeof v === "string" && v.length > 0)
        ) {
          filledJournals += 1;
        }
      }
      return filledJournals;
    }),
    db.journalDocument.count({
      where: {
        organizationId,
        status: "active",
      },
    }),
    db.journalPipelineNode.count({
      where: { template: { organizationId } },
    }).catch(() => 0),
    db.tasksFlowIntegration.findFirst({
      where: { organizationId },
      select: { id: true, enabled: true },
    }).catch(() => null),
    db.user.count({
      where: {
        organizationId,
        isActive: true,
        archivedAt: null,
        telegramChatId: { not: null },
      },
    }).catch(() => 0),
    db.journalChecklistItem.count({ where: { organizationId } }).catch(() => 0),
    Promise.resolve(0).then(async () => {
      const row = await db.organization.findUnique({
        where: { id: organizationId },
        select: { autoJournalCodes: true },
      });
      const codes = Array.isArray(row?.autoJournalCodes)
        ? (row!.autoJournalCodes as string[])
        : [];
      return codes.length;
    }),
  ]);

  // Sane defaults для пустых значений.
  const orgName = org?.name?.trim() || "";
  const orgInn = org?.inn?.trim() || "";
  const orgAddress = org?.address?.trim() || "";

  const items: QuickStartItem[] = [
    {
      id: "company",
      icon: "Briefcase",
      label: "Профиль компании",
      description: "Название, ИНН, адрес — попадают в шапку всех журналов и PDF.",
      status: orgName && orgInn && orgAddress ? "done" : orgName ? "partial" : "empty",
      href: "/settings/organization",
      cta: "Заполнить реквизиты",
      category: "company",
    },
    {
      id: "positions",
      icon: "Briefcase",
      label: "Должности",
      description: "Минимум 2 (например, Заведующая + Повар). К должности привязываются журналы.",
      status: positionsCount >= 2 ? "done" : positionsCount > 0 ? "partial" : "empty",
      meta: `${positionsCount} ${pluralize(positionsCount, "должность", "должности", "должностей")}`,
      href: "/settings/users",
      cta: "Добавить должности",
      category: "team",
    },
    {
      id: "users",
      icon: "UsersIcon",
      label: "Сотрудники",
      description: "Те, кто реально заполняет журналы. Без них некому раздавать задачи.",
      status: activeUsersCount >= 2 ? "done" : activeUsersCount > 0 ? "partial" : "empty",
      meta: `${activeUsersCount} ${pluralize(activeUsersCount, "сотрудник", "сотрудника", "сотрудников")}`,
      href: "/settings/users",
      cta: "Пригласить команду",
      category: "team",
    },
    {
      id: "areas",
      icon: "Building2",
      label: "Цеха и зоны (для оборудования)",
      description: "Горячий цех, холодный цех, склад. Используются для привязки оборудования (холодильники, печи) и в журналах климата.",
      status: areasCount >= 1 ? "done" : "empty",
      meta: `${areasCount} ${pluralize(areasCount, "цех", "цеха", "цехов")}`,
      href: "/settings/areas",
      cta: "Создать цеха",
      category: "structure",
    },
    {
      id: "equipment",
      icon: "Wrench",
      label: "Оборудование",
      description: "Холодильники, плиты, морозилки. Подтянутся в журнал температурного режима.",
      status: equipmentCount >= 1 ? "done" : "empty",
      meta: `${equipmentCount} ${pluralize(equipmentCount, "единица", "единицы", "единиц")}`,
      href: "/settings/equipment",
      cta: "Завести холодильники",
      category: "structure",
    },
    {
      id: "products",
      icon: "Boxes",
      label: "Продукты и сырьё",
      description: "Каталог наименований для журналов брака, входного контроля, прослеживаемости.",
      status: productsCount >= 1 ? "done" : "empty",
      meta: `${productsCount} ${pluralize(productsCount, "позиция", "позиции", "позиций")}`,
      href: "/settings/products",
      cta: "Загрузить каталог",
      category: "structure",
    },
    {
      id: "journals",
      icon: "ClipboardList",
      label: "Активные журналы",
      description: "Включите только нужные для вашего профиля (35 на выбор).",
      status: enabledJournalCount > 0 ? "done" : "empty",
      meta: `${enabledJournalCount} вкл.`,
      href: "/settings/journals",
      cta: "Выбрать журналы",
      category: "journals",
    },
    {
      id: "responsibles",
      icon: "ShieldCheck",
      label: "Ответственные за журналы",
      description: "Кто заполняет и кто проверяет каждый журнал. Без этого задачи никому не уйдут.",
      status:
        responsiblesAssignedCount >= 5
          ? "done"
          : responsiblesAssignedCount > 0
            ? "partial"
            : "empty",
      meta: `${responsiblesAssignedCount} ${pluralize(responsiblesAssignedCount, "журнал", "журнала", "журналов")} настроено`,
      href: "/settings/journal-responsibles",
      cta: "Назначить ответственных",
      category: "journals",
    },
    {
      id: "pipelines",
      icon: "Workflow",
      label: "Пайплайны (пошаговые инструкции)",
      description: "Для каждого журнала — шаги что делать. Сотрудник идёт по чек-листу.",
      status: pipelineNodesCount >= 5 ? "done" : pipelineNodesCount > 0 ? "partial" : "empty",
      meta: `${pipelineNodesCount} ${pluralize(pipelineNodesCount, "узел", "узла", "узлов")}`,
      href: "/settings/journal-pipelines",
      cta: "Настроить шаги",
      category: "journals",
    },
    {
      id: "checklists",
      icon: "ListChecks",
      label: "Чек-листы внутри задач",
      description: "Дополнительные подзадачи, которые сотрудник отмечает галочками.",
      status: checklistItemsCount > 0 ? "done" : "empty",
      meta: `${checklistItemsCount} ${pluralize(checklistItemsCount, "пункт", "пункта", "пунктов")}`,
      href: "/settings/journal-checklists",
      cta: "Добавить чек-листы",
      category: "journals",
    },
    {
      id: "documents",
      icon: "FileText",
      label: "Документы на текущий период",
      description: "Чтобы сегодня можно было заполнять — нужны открытые документы.",
      status: activeDocumentsCount >= 1 ? "done" : "empty",
      meta: `${activeDocumentsCount} ${pluralize(activeDocumentsCount, "документ", "документа", "документов")}`,
      href: "/journals",
      cta: "Создать документы",
      category: "documents",
    },
    {
      id: "tasksflow",
      icon: "Workflow",
      label: "TasksFlow / распределение задач",
      description: "Куда уходят задачи: в чат-бот, в общий список, в наряды. Без этого сотрудники их не видят.",
      status: tasksflowIntegration?.enabled
        ? "done"
        : tasksflowIntegration
          ? "partial"
          : "empty",
      href: "/settings/integrations/tasksflow",
      cta: "Подключить TasksFlow",
      category: "integrations",
    },
    {
      id: "telegram",
      icon: "Send",
      label: "Telegram-бот для сотрудников",
      description: "Каждый сотрудник связывает Telegram — туда приходят push'и о новых задачах.",
      status:
        usersWithTelegramCount >= Math.max(1, Math.floor(activeUsersCount / 2))
          ? "done"
          : usersWithTelegramCount > 0
            ? "partial"
            : "empty",
      meta: `${usersWithTelegramCount} из ${activeUsersCount} подключено`,
      href: "/settings/users",
      cta: "Разослать инвайты",
      category: "integrations",
    },
    {
      id: "auto-journals",
      icon: "Bell",
      label: "Авто-создание документов",
      description: "Какие журналы система каждый месяц/неделю создаёт сама — чтоб не забывали.",
      status: autoJournalsCount >= 1 ? "done" : "empty",
      meta: `${autoJournalsCount} ${pluralize(autoJournalsCount, "журнал", "журнала", "журналов")} в авто-режиме`,
      href: "/settings/auto-journals",
      cta: "Включить автостарт",
      category: "documents",
    },
    {
      id: "compliance",
      icon: "Settings2",
      label: "Контроль и проверка",
      description: "Нужно ли требовать фото на каждом шаге, кто может править задним числом.",
      status: "info",
      href: "/settings/compliance",
      cta: "Открыть настройки",
      category: "advanced",
    },
    {
      id: "schedule",
      icon: "CalendarRange",
      label: "Календарь и периоды",
      description: "Выходные дни и периодичность каждого журнала (раз в день / неделя / месяц).",
      status: "info",
      href: "/settings/journal-periods",
      cta: "Открыть календарь",
      category: "advanced",
    },
  ];

  const completed = items.filter((i) => i.status === "done").length;
  const blocking = items.filter((i) => i.status === "empty" && isBlocking(i.id)).length;
  const totalRequired = items.filter((i) => i.status !== "info").length;

  // Если ВСЁ done и нет blocking — карточка на dashboard не нужна
  // (compact mode auto-hide). На settings/onboarding (full mode)
  // оставляем — пользователь специально перешёл сюда.
  if (
    mode === "compact" &&
    completed >= totalRequired &&
    blocking === 0 &&
    items.every((i) => i.status === "done" || i.status === "info")
  ) {
    return null;
  }

  if (mode === "full") {
    return (
      <QuickStartCardFull
        items={items}
        completed={completed}
        total={totalRequired}
      />
    );
  }
  return (
    <QuickStartCardCompact
      items={items}
      completed={completed}
      total={totalRequired}
    />
  );
}

const BLOCKING_IDS = new Set([
  "company",
  "positions",
  "users",
  "journals",
  "responsibles",
]);
function isBlocking(id: string): boolean {
  return BLOCKING_IDS.has(id);
}

function pluralize(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100;
  const n10 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n10 > 1 && n10 < 5) return few;
  if (n10 === 1) return one;
  return many;
}

