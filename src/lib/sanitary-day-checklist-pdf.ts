import type { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
  getItemNumber,
  normalizeSdcConfig,
  normalizeSdcEntryData,
} from "@/lib/sanitary-day-checklist-document";

type BasicUser = {
  id: string;
  name: string;
  role: string;
};

type EntryItem = {
  date: Date;
  data: unknown;
};

function formatRuDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}.${m}.${y}`;
}

export function drawSanitaryDayChecklistPdf(
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
  const config = normalizeSdcConfig(params.config);

  // Merge marks from all entries (usually only one entry per document at dateFrom)
  const mergedMarks: Record<string, string> = {};
  for (const entry of params.entries) {
    const { marks } = normalizeSdcEntryData(entry.data);
    for (const [k, v] of Object.entries(marks)) {
      if (v) mergedMarks[k] = v;
    }
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  // ─── Header table (organization | СИСТЕМА ХАССП / title | СТР. 1 ИЗ 1) ───
  doc.setFont("JournalUnicode", "normal");
  autoTable(doc, {
    startY: 14,
    theme: "grid",
    styles: {
      font: "JournalUnicode",
      fontSize: 9,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 2.2,
      valign: "middle",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 58 },
      1: { cellWidth: pageWidth - margin * 2 - 58 - 28 },
      2: { cellWidth: 28 },
    },
    body: [
      [
        {
          content: params.organizationName || "",
          rowSpan: 2,
          styles: { fontStyle: "bold", fontSize: 10 },
        },
        { content: "СИСТЕМА ХАССП" },
        { content: "СТР. 1 ИЗ 1", rowSpan: 2 },
      ],
      [
        {
          content: "ЧЕК-ЛИСТ (ПАМЯТКА) ПРОВЕДЕНИЯ САНИТАРНОГО ДНЯ",
          styles: { fontStyle: "italic" },
        },
      ],
    ],
    margin: { left: margin, right: margin },
  });

  // ─── Дата проведения ───
  const lastY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } })
    .lastAutoTable?.finalY ?? 40;

  doc.setFont("JournalUnicode", "bold");
  doc.setFontSize(10);
  doc.text("ДАТА ПРОВЕДЕНИЯ", margin, lastY + 7);
  doc.setFont("JournalUnicode", "normal");
  doc.text(formatRuDate(params.dateFrom), pageWidth - margin, lastY + 7, {
    align: "right",
  });

  // ─── Общие принципы block ───
  let cursorY = lastY + 11;
  if (config.generalPrinciples.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      theme: "grid",
      styles: {
        font: "JournalUnicode",
        fontSize: 9,
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        cellPadding: 2,
      },
      body: [
        [
          {
            content: "ОБЩИЕ ПРИНЦИПЫ",
            styles: { fontStyle: "bold", halign: "left" },
          },
        ],
        ...config.generalPrinciples.map(
          (p) => [{ content: `• ${p}` }] as RowInput
        ),
      ],
      margin: { left: margin, right: margin },
    });
    cursorY =
      (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
        ?.finalY ?? cursorY + 10;
  }

  // ─── Checklist table grouped by zone ───
  const body: RowInput[] = [];
  config.zones.forEach((zone, zoneIndex) => {
    body.push([
      {
        content: `${zoneIndex + 1}. ${zone.name.toUpperCase()}`,
        colSpan: 3,
        styles: {
          fontStyle: "bold",
          halign: "center",
          fillColor: [232, 232, 232],
        },
      },
    ]);
    const zoneItems = config.items.filter((it) => it.zoneId === zone.id);
    for (const item of zoneItems) {
      body.push([
        { content: getItemNumber(config, item), styles: { halign: "center" } },
        { content: item.text },
        {
          content: mergedMarks[item.id] || "",
          styles: { halign: "center" },
        },
      ]);
    }
  });

  autoTable(doc, {
    startY: cursorY + 4,
    theme: "grid",
    styles: {
      font: "JournalUnicode",
      fontSize: 9,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      cellPadding: 1.8,
      valign: "middle",
    },
    head: [
      [
        { content: "№ п/п", styles: { halign: "center" } },
        { content: "Действия", styles: { halign: "center" } },
        { content: "Отметка времени", styles: { halign: "center" } },
      ],
    ],
    body,
    headStyles: {
      fillColor: [242, 242, 242],
      textColor: [0, 0, 0],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 34 },
    },
    margin: { left: margin, right: margin },
  });

  // ─── Signatures ───
  const finalY =
    (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable
      ?.finalY ?? cursorY + 40;
  const pageHeight = doc.internal.pageSize.getHeight();
  const sigY = Math.min(finalY + 14, pageHeight - 20);

  doc.setFont("JournalUnicode", "bold");
  doc.setFontSize(10);
  doc.text("ВЫПОЛНИЛ:", margin, sigY);
  doc.setFont("JournalUnicode", "normal");
  doc.text(config.responsibleName || "_______________________", margin + 36, sigY);
  doc.line(margin + 36, sigY + 1, margin + 120, sigY + 1);

  doc.setFont("JournalUnicode", "bold");
  doc.text("ПРОВЕРИЛ:", margin, sigY + 8);
  doc.setFont("JournalUnicode", "normal");
  doc.text(config.checkerName || "_______________________", margin + 36, sigY + 8);
  doc.line(margin + 36, sigY + 9, margin + 120, sigY + 9);
}
