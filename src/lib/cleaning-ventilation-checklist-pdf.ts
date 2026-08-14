import fs from "fs";
import type { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const FONT_CANDIDATES = [
  "C:\\Windows\\Fonts\\arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
];

/**
 * Default jsPDF helvetica can't render Cyrillic glyphs, so register an OS TTF
 * (mirrors document-pdf.ts). Without this, all body text in this PDF was
 * coming out as garbled characters.
 */
function ensureUnicodeFont(doc: jsPDF): string {
  const fontList = doc.getFontList?.() ?? {};
  if (Object.prototype.hasOwnProperty.call(fontList, "JournalUnicode")) {
    return "JournalUnicode";
  }
  const fontPath = FONT_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!fontPath) return "helvetica";
  const base64 = fs.readFileSync(fontPath).toString("base64");
  doc.addFileToVFS("journal-unicode.ttf", base64);
  doc.addFont("journal-unicode.ttf", "JournalUnicode", "normal");
  doc.addFont("journal-unicode.ttf", "JournalUnicode", "bold");
  doc.addFont("journal-unicode.ttf", "JournalUnicode", "italic");
  return "JournalUnicode";
}
import { readControlPeriodicity } from "@/lib/control-periodicity";
import { registerPageLabelSlot } from "@/lib/pdf-page-labels";
import { getUserDisplayTitle } from "@/lib/user-roles";
import {
  CLEANING_VENTILATION_CHECKLIST_TEMPLATE_CODE,
  buildChecklistDateKeys,
  getCleaningVentilationDescriptionLines,
  getCleaningVentilationPeriodicityLines,
  normalizeCleaningVentilationConfig,
  normalizeCleaningVentilationEntryData,
  type CleaningVentilationChecklistConfig,
} from "@/lib/cleaning-ventilation-checklist-document";

type BasicUser = {
  id: string;
  name: string;
  role: string;
  /** Экранная должность (jobPosition → positionTitle → роль). */
  positionTitle?: string | null;
};

type EntryItem = {
  date: Date;
  data: unknown;
};

export function drawCleaningVentilationChecklistPdf(
  doc: jsPDF,
  params: {
    organizationName: string;
    title: string;
    dateFrom: Date;
    config: unknown;
    entries: EntryItem[];
    users: BasicUser[];
  }
) {
  const config = normalizeCleaningVentilationConfig(params.config, params.users);
  const controlPeriodicity = readControlPeriodicity(
    params.config,
    CLEANING_VENTILATION_CHECKLIST_TEMPLATE_CODE
  );
  const dateFromIso = params.dateFrom.toISOString().slice(0, 10);
  const existingDates = params.entries.map((entry) => entry.date.toISOString().slice(0, 10));
  const dateKeys = buildChecklistDateKeys(
    dateFromIso,
    config.skipWeekends,
    [...config.customDates, ...existingDates],
    config.hiddenDates
  );
  const entryMap = new Map(
    params.entries.map((entry) => [
      entry.date.toISOString().slice(0, 10),
      normalizeCleaningVentilationEntryData(entry.data),
    ])
  );

  const fontName = ensureUnicodeFont(doc);
  doc.setFont(fontName, "bold");
  doc.setFontSize(13);
  doc.text(params.title, 14, 14);
  doc.setFont(fontName, "normal");

  /**
   * Штамп ХАССП. Вынесен в функцию: он обязан стоять на КАЖДОЙ странице
   * бланка (раньше страницы 2..N уходили голыми, а «СТР. i ИЗ N»
   * печаталась отдельной строкой в подвале).
   */
  function drawVentHeader(topY: number) {
  autoTable(doc, {
    startY: topY,
    theme: "grid",
    styles: { font: fontName, fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.2, cellPadding: 1.8 },
    columnStyles: {
      0: { cellWidth: 40, halign: "center", valign: "middle" },
      1: { cellWidth: 85, halign: "center", valign: "middle" },
      2: { cellWidth: 40, halign: "center", valign: "middle" },
      3: { cellWidth: 30, halign: "center", valign: "middle" },
    },
    body: [
      [
        { content: params.organizationName, rowSpan: 2 },
        { content: "СИСТЕМА ХАССП" },
        { content: `Начат ${dateFromIso.split("-").reverse().join("-")}\nОкончен __________`, rowSpan: 1 },
        // Пусто: «СТР. i ИЗ N» штампуется после вёрстки по слоту.
        { content: "", rowSpan: 2 },
      ],
      [
        // colSpan=2: справа от названия журнала лишней пустой ячейки нет
        // (правый столбец шапки занят слотом «СТР. i ИЗ N» с rowSpan=2).
        {
          content: "ЧЕК-ЛИСТ УБОРКИ И ПРОВЕТРИВАНИЯ ПОМЕЩЕНИЙ",
          colSpan: 2,
          styles: { fontStyle: "italic" as const },
        },
      ],
      // Строка «Периодичность контроля» — тот же ряд, что на экране и на
      // эталоне. Пустое значение (владелец стёр текст) строку не печатает.
      ...(controlPeriodicity
        ? [
            [
              { content: "Периодичность контроля", styles: { fontStyle: "bold" as const } },
              { content: controlPeriodicity, colSpan: 3 },
            ],
          ]
        : []),
    ],
    didDrawCell: (data) => {
      if (data.section === "body" && data.row.index === 0 && data.column.index === 3) {
        registerPageLabelSlot(doc, {
          x: data.cell.x,
          y: data.cell.y,
          width: data.cell.width,
          height: data.cell.height,
          maxWidth: data.cell.width - 4,
          fontSize: 9,
          fontStyle: "normal",
        });
      }
    },
  });
  return (
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? topY
  );
  }

  const headerBottom = drawVentHeader(20);
  const headerHeight = headerBottom - 20;

  const descriptionText = getCleaningVentilationDescriptionLines()
    .filter((item) => item.label !== "Рабочие помещения при проветривании" || config.ventilationEnabled)
    .map((item) => `${item.label}: ${item.text}`)
    .join("\n\n");

  // На экране ответственные подписаны «Должность - ФИО», где ДОЛЖНОСТЬ
  // берётся из конфига документа (`responsible.title`), а НЕ из
  // jobPosition пользователя. Раньше PDF звал getUserDisplayTitle и
  // печатал «Менеджер - Ярослав» там, где экран показывает
  // «Управляющий - Ярослав».
  const responsiblesText =
    config.responsibles
      .map((item) => {
        const user = params.users.find((candidate) => candidate.id === item.userId);
        const title = item.title?.trim() || getUserDisplayTitle(user);
        return `${title} - ${user?.name || "Не выбран"}`;
      })
      .filter(Boolean)
      .join("\n") || "—";

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable!.finalY! + 6
      : 38,
    theme: "grid",
    styles: { font: fontName, fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.2, cellPadding: 2 },
    columnStyles: {
      0: { cellWidth: 24, halign: "center", valign: "middle" },
      1: { cellWidth: 86 },
      2: { cellWidth: 40, halign: "center", valign: "middle" },
      3: { cellWidth: 45, halign: "center", valign: "middle" },
    },
    body: [
      [
        // Как на экране: «Процедура» и её описание объединены по
        // вертикали на обе строки — раньше во второй строке зияли две пустые ячейки.
        { content: "Процедура", rowSpan: 2, styles: { fontStyle: "bold" } },
        { content: descriptionText, rowSpan: 2 },
        { content: "Периодичность", styles: { fontStyle: "bold" } },
        { content: getCleaningVentilationPeriodicityLines(config.ventilationEnabled).join("\n") },
      ],
      [
        { content: "Ответственные лица", styles: { fontStyle: "bold" } },
        { content: responsiblesText },
      ],
    ],
  });

  const rowBody: Array<Array<string>> = [];
  /** rowIndex → дата ГРУППЫ (для строк-продолжений на новой странице). */
  const groupDateByRowIndex: string[] = [];
  let lastRenderedPage = -1;
  const procedures = config.procedures.filter(
    (item) => item.enabled && (item.id !== "ventilation" || config.ventilationEnabled)
  );

  for (const dateKey of dateKeys) {
    const entry = entryMap.get(dateKey);
    procedures.forEach((procedure, index) => {
      const times = entry?.procedures[procedure.id] || procedure.times;
      const responsibleName =
        params.users.find(
          (user) => user.id === (entry?.responsibleUserId || procedure.responsibleUserId || config.mainResponsibleUserId)
        )?.name || "";

      groupDateByRowIndex[rowBody.length] = dateKey.split("-").reverse().join("-");
      rowBody.push([
        index === 0 ? dateKey.split("-").reverse().join("-") : "",
        procedure.label,
        times[0] || "",
        times[1] || "",
        times[2] || "",
        responsibleName,
      ]);
    });
  }

  autoTable(doc, {
    startY: (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY
      ? (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable!.finalY! + 8
      : 100,
    // Резерв под повтор штампа ХАССП на страницах 2..N.
    margin: { top: 20 + headerHeight + 6 },
    theme: "grid",
    styles: { font: fontName, fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.2, cellPadding: 1.8 },
    head: [[
      "Дата",
      "Процедура",
      "Время 1",
      "Время 2",
      "Время 3",
      "ФИО ответственного лица",
    ]],
    body: rowBody,
    // Группа строк одной даты не должна оставаться без даты: если разрыв
    // страницы пришёлся на середину группы, первая строка на новом листе
    // получает дату своей группы (раньше процедуры «продолжения» ехали
    // на следующий лист безымянными).
    willDrawCell: (data) => {
      if (data.section !== "body" || data.column.index !== 0) return;
      if (data.pageNumber === lastRenderedPage) return;
      lastRenderedPage = data.pageNumber;
      if (data.cell.text.join("").trim()) return;
      const groupDate = groupDateByRowIndex[data.row.index];
      if (groupDate) data.cell.text = [groupDate];
    },
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
    // Сумма = 195мм — ровно ширина штампа (40+85+40+30) и блока
    // «Процедура» (24+86+40+45): правый край всех блоков совпадает.
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 40 },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 45 },
    },
  });

  // Повторяем штамп на страницах 2..N (место под него зарезервировано
  // через margin.top таблицы наработки).
  const totalPages = doc.getNumberOfPages();
  for (let page = 2; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawVentHeader(20);
  }
  doc.setPage(totalPages);
}

export function getCleaningVentilationScreenRows(
  config: CleaningVentilationChecklistConfig,
  dateFrom: string,
  customDates: string[],
  entryMap: Map<string, ReturnType<typeof normalizeCleaningVentilationEntryData>>
) {
  const procedures = config.procedures.filter(
    (item) => item.enabled && (item.id !== "ventilation" || config.ventilationEnabled)
  );
  return buildChecklistDateKeys(
    dateFrom,
    config.skipWeekends,
    [...config.customDates, ...customDates],
    config.hiddenDates
  ).map((dateKey) => {
    const entry = entryMap.get(dateKey);
    return {
      dateKey,
      procedures: procedures.map((procedure) => ({
        id: procedure.id,
        label: procedure.label,
        times: entry?.procedures[procedure.id] || procedure.times,
        responsibleUserId:
          entry?.responsibleUserId || procedure.responsibleUserId || config.mainResponsibleUserId,
      })),
    };
  });
}
