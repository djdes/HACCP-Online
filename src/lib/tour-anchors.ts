/**
 * Реестр значений `data-tour` для спотлайт-тура «Как заполнить?».
 *
 * Компоненты помечают элементы `data-tour={TOUR.createDocument}`, а шаги
 * гайда (`journal-ui-walkthroughs.ts`) ссылаются на те же константы:
 * опечатка в анкоре ловится на typecheck, а не пустым выделением на
 * экране. Значения общие для всех журналов: у нового журнала остаются
 * 1–3 своих анкора, остальные уже стоят в разделяемых компонентах
 * (кнопка «Создать документ», карточка документа, шапка документа,
 * полоса автозаполнения, переключатель «Карточки / Таблица»).
 */
export const TOUR = {
  createDocument: "create-document",
  documentCard: "document-card",
  addStaff: "add-staff",
  staffCard: "staff-card",
  statusCell: "status-cell",
  temperatureCell: "temperature-cell",
  autofill: "autofill",
  journalSettings: "journal-settings",
  moreActions: "more-actions",
  addRoom: "add-room",
  addRow: "add-row",
  measureInput: "measure-input",
  viewToggle: "view-toggle",
} as const;

export type TourAnchor = (typeof TOUR)[keyof typeof TOUR];

export const TOUR_ANCHOR_VALUES: readonly TourAnchor[] = Object.values(TOUR);

/** CSS-селектор для поиска элемента шага. */
export function tourSelector(anchor: TourAnchor): string {
  return `[data-tour="${anchor}"]`;
}
