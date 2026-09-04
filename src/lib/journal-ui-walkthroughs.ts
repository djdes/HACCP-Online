import { TOUR, type TourAnchor } from "@/lib/tour-anchors";

/**
 * «Как заполнить?» — шаги по ИНТЕРФЕЙСУ журнала: куда нажать, что
 * произойдёт. Правила заполнения (кого осматривать, чем мерить) живут
 * отдельно — `journal-doc-guides.ts` и `/journals/<code>/guide`.
 *
 * Каждый шаг привязан к странице (`list` — список документов журнала,
 * `document` — сам документ) и, если возможно, к элементу через
 * `data-tour` (`anchor`). Спотлайт-тур подсвечивает элемент на экране;
 * если анкора на странице нет (например, в мобильных карточках), берётся
 * `fallbackAnchor`, иначе шаг пропускается.
 *
 * Тексты — императив, 1–2 предложения, без воды. Целевая аудитория —
 * новый сотрудник без обучения. Пилюля «Руководитель» (`forManager`) —
 * подсказка «кто это делает», а не гейт: шаг видят все.
 *
 * Мини-копии контролов (`preview`) рисует client-компонент
 * `walkthrough-previews.tsx` по ключу — JSX здесь нельзя (RSC не
 * сериализует функции).
 */

export type WalkthroughPage = "list" | "document";

export type WalkthroughPreviewKey =
  | "button-create"
  | "button-add"
  | "status-cycle"
  | "temp-toggle"
  | "button-add-room"
  | "button-add-row"
  | "measure-cells";

export type WalkthroughStep = {
  /** Стабильный id — используется в `?tour=<id>`. */
  id: string;
  page: WalkthroughPage;
  anchor?: TourAnchor;
  fallbackAnchor?: TourAnchor;
  title: string;
  body: string;
  forManager?: boolean;
  /** Только для узких экранов (< 640px): телефон, Mini App. */
  mobileOnly?: boolean;
  preview?: WalkthroughPreviewKey;
};

const WALKTHROUGHS: Record<string, WalkthroughStep[]> = {
  hygiene: [
    {
      id: "create-document",
      page: "list",
      anchor: TOUR.createDocument,
      title: "Создайте документ",
      body: "Нажмите «Создать документ»: период на 15 дней и название подставятся сами, выберите, кто проводит осмотр. При включённом автосоздании документ уже в списке.",
      forManager: true,
      preview: "button-create",
    },
    {
      id: "open-document",
      page: "list",
      anchor: TOUR.documentCard,
      title: "Откройте документ",
      body: "Нажмите на карточку нужного периода — откроется таблица «сотрудники × дни».",
    },
    {
      id: "add-staff",
      page: "document",
      anchor: TOUR.addStaff,
      title: "Добавьте сотрудников",
      body: "«Добавить» → «Заполнить из списка сотрудников». У каждого две строки: осмотр и температура.",
      forManager: true,
      preview: "button-add",
    },
    {
      id: "staff-card",
      page: "document",
      anchor: TOUR.staffCard,
      title: "Раскройте карточку сотрудника",
      body: "Нажмите на имя — откроется список дней.",
      mobileOnly: true,
    },
    {
      id: "status-cell",
      page: "document",
      anchor: TOUR.statusCell,
      fallbackAnchor: TOUR.staffCard,
      title: "Отметьте осмотр за сегодня",
      body: "Нажмите на клетку сегодняшнего дня. Каждое нажатие меняет отметку по кругу: Зд. → В → Б/л → От → Отп. Правая кнопка мыши — выбрать сразу.",
      preview: "status-cycle",
    },
    {
      id: "temperature-cell",
      page: "document",
      anchor: TOUR.temperatureCell,
      fallbackAnchor: TOUR.staffCard,
      title: "Температура выше 37°?",
      body: "Во второй строке сотрудника: «нет» — всё в порядке, «да» — выше 37°.",
      preview: "temp-toggle",
    },
    {
      id: "autofill",
      page: "document",
      anchor: TOUR.autofill,
      title: "Включите автозаполнение",
      body: "Каждый день в 06:00 всем поставится «Зд.» и «температура ниже 37», выходные, отпуска и больничные отметятся сами. Температура или болезнь — исправьте в тот же день, прошлые дни закрыты.",
      forManager: true,
    },
    {
      id: "finish",
      page: "document",
      anchor: TOUR.moreActions,
      title: "Сохранять не нужно",
      body: "Каждая отметка сохраняется сразу. Когда период закончился: «⋯» → «Закончить журнал».",
    },
  ],

  climate_control: [
    {
      id: "create-document",
      page: "list",
      anchor: TOUR.createDocument,
      title: "Создайте документ",
      body: "Нажмите «Создать документ»: дата начала и ответственный. Название подставится само.",
      forManager: true,
      preview: "button-create",
    },
    {
      id: "open-document",
      page: "list",
      anchor: TOUR.documentCard,
      title: "Откройте документ",
      body: "Нажмите на карточку — откроется бланк с помещениями и замерами.",
    },
    {
      id: "add-room",
      page: "document",
      anchor: TOUR.addRoom,
      title: "Добавьте помещения",
      body: "«+ Добавить помещение» → выберите склад из справочника. Нормы температуры и влажности — из карточки помещения. Только склады с продуктами.",
      forManager: true,
      preview: "button-add-room",
    },
    {
      id: "journal-settings",
      page: "document",
      anchor: TOUR.journalSettings,
      title: "Задайте время контроля",
      body: "«Настройки журнала» → время замера (по умолчанию 10:00) и «не заполнять в выходные».",
      forManager: true,
    },
    {
      id: "autofill",
      page: "document",
      anchor: TOUR.autofill,
      title: "Автозаполнение",
      body: "Тумблер «Автоматически заполнять журнал»: строка на каждый день создаётся сама, замеры проставляются в пределах нормы, введённые вручную значения не трогаются.",
      forManager: true,
    },
    {
      id: "view-toggle",
      page: "document",
      anchor: TOUR.viewToggle,
      title: "Переключитесь на «Таблица»",
      body: "На телефоне карточки только для просмотра — значения вводятся в таблице.",
      mobileOnly: true,
    },
    {
      id: "add-row",
      page: "document",
      anchor: TOUR.addRow,
      title: "Добавьте строку за сегодня",
      body: "Если автозаполнение выключено: «Добавить строку» → дата и кто измерял.",
      preview: "button-add-row",
    },
    {
      id: "measure-input",
      page: "document",
      anchor: TOUR.measureInput,
      fallbackAnchor: TOUR.viewToggle,
      title: "Впишите показания",
      body: "Температура (°C) и влажность (%) по каждому помещению — сохраняется при выходе из клетки. Красная цифра — вне нормы: ниже появится поле «Корректирующие действия», напишите, что сделали.",
      preview: "measure-cells",
    },
    {
      id: "finish",
      page: "document",
      anchor: TOUR.moreActions,
      title: "Закончить журнал",
      body: "В конце месяца: «⋯» → «Закончить журнал». Сохранять не нужно — всё пишется сразу.",
    },
  ],
};

export const WALKTHROUGH_CODES: ReadonlySet<string> = new Set(Object.keys(WALKTHROUGHS));

export function getJournalWalkthrough(code: string): WalkthroughStep[] | null {
  return WALKTHROUGHS[code] ?? null;
}

export function hasJournalWalkthrough(code: string): boolean {
  return code in WALKTHROUGHS;
}

/** Шаги, которые имеет смысл показывать на этом устройстве. */
export function visibleWalkthroughSteps(
  steps: readonly WalkthroughStep[],
  { isMobile }: { isMobile: boolean },
): WalkthroughStep[] {
  return steps.filter((step) => !step.mobileOnly || isMobile);
}
