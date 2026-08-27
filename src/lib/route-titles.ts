/**
 * Человеческие названия маршрутов кабинета — для хлебных крошек и кнопки
 * «Назад» (`components/layout/page-nav.tsx`).
 *
 * Это единственный источник подписей: карточки `/settings` берут `title`
 * отсюда же (`settings/page.tsx`), поэтому крошка и карточка не могут
 * разъехаться. Динамические сегменты (`[id]`, `[code]`) здесь не живут —
 * их подписи страницы кладут через `<PageCrumbs>`.
 */
export const ROUTE_TITLES: Record<string, string> = {
  "/batches": "Партии",
  "/bonuses": "Премии",
  "/capa": "CAPA",
  "/catch-up": "Догнать пропуски",
  "/changes": "Изменения",
  "/competencies": "Компетенции",
  "/control-board": "Панель контроля",
  "/dashboard": "Главная",
  "/equipment-fill": "Заполнение оборудования",
  "/journals": "Журналы",
  "/losses": "Потери",
  "/plans": "Производственный план",
  "/reports": "Отчёты",
  "/sanpin": "Справочник СанПиН",
  "/settings": "Настройки",
  "/task-fill": "Заполнение задачи",
  "/tasks": "Задачи",
  "/journals/new": "Новый журнал",
  "/settings/accounting": "Бухгалтерия",
  "/settings/api": "API интеграций",
  "/settings/areas": "Цеха и участки",
  "/settings/audit": "Журнал действий",
  "/settings/auto-journals": "Автосоздание журналов",
  "/settings/backup": "Авто-бэкап на Я.Диск",
  "/settings/buildings": "Здания и помещения",
  "/settings/compliance": "Compliance",
  "/settings/equipment": "Оборудование",
  "/settings/experimental": "Бета-функции",
  "/settings/inspector-portal": "Портал инспектора",
  "/settings/journal-access": "Журналы для сотрудников",
  "/settings/journal-bonuses": "Премии за журналы",
  "/settings/journal-checklists": "Чек-листы для журналов",
  "/settings/journal-difficulty": "Сложность журналов",
  "/settings/journal-flow": "Кто забирает задачу",
  "/settings/journal-periods": "Периоды журналов",
  "/settings/journal-pipelines": "Настройки журналов (pipeline)",
  "/settings/journal-responsibles": "Ответственные за журналы",
  "/settings/journal-task-mode": "Раздача и проверка задач",
  "/settings/journals": "Набор журналов",
  "/settings/journals-by-position": "Матрица «должность × журнал»",
  "/settings/notifications": "Уведомления",
  "/settings/onboarding": "Быстрая настройка",
  "/settings/onboarding-template": "Шаблоны заведений",
  "/settings/organization": "Информация об организации",
  "/settings/permissions": "Права доступа",
  "/settings/phone": "Привязка телефона",
  "/settings/position-staff-visibility": "Кто видит коллег",
  "/settings/products": "Справочник продуктов",
  "/settings/role-presets": "Пресеты ролей",
  "/settings/schedule": "График смен",
  "/settings/staff-hierarchy": "Иерархия управления",
  "/settings/subscription": "Подписка",
  "/settings/task-visibility": "Admin-флаг в TasksFlow",
  "/settings/users": "Сотрудники",
  "/settings/workload-balance": "Дашборд нагрузки",
  "/settings/integrations/tasksflow": "TasksFlow",
  "/settings/onboarding/advanced": "Продвинутая настройка",
  "/settings/users/invite": "Приглашение сотрудника",
};

/** Точное совпадение пути. Для динамических путей вернёт null. */
export function getRouteTitle(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return ROUTE_TITLES[clean] ?? null;
}
