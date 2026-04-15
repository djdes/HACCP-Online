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
import {
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

  autoTable(doc, {
    startY: 20,
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
        { content: "СТР. 1 ИЗ 1", rowSpan: 2 },
      ],
      [
        { content: "ЧЕК-ЛИСТ УБОРКИ И ПРОВЕТРИВАНИЯ ПОМЕЩЕНИЙ", styles: { fontStyle: "italic" } },
        { content: "" },
      ],
    ],
  });

  const descriptionText = getCleaningVentilationDescriptionLines()
    .filter((item) => item.label !== "Рабочие помещения при проветривании" || config.ventilationEnabled)
    .map((item) => `${item.label}: ${item.text}`)
    .join("\n\n");

  const responsiblesText =
    config.responsibles
      .map((item) => params.users.find((user) => user.id === item.userId)?.name || "")
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
        { content: "Процедура", styles: { fontStyle: "bold" } },
        { content: descriptionText },
        { content: "Периодичность", styles: { fontStyle: "bold" } },
        { content: getCleaningVentilationPeriodicityLines(config.ventilationEnabled).join("\n") },
      ],
      [
        { content: "" },
        { content: "" },
        { content: "Ответственные лица", styles: { fontStyle: "bold" } },
        { content: responsiblesText },
      ],
    ],
  });

  const rowBody: Array<Array<string>> = [];
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
    headStyles: { fillColor: [245, 245, 245], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 36 },
      2: { cellWidth: 28, halign: "center" },
      3: { cellWidth: 28, halign: "center" },
      4: { cellWidth: 28, halign: "center" },
      5: { cellWidth: 42 },
    },
  });
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
