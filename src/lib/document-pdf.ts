import fs from "fs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { db } from "@/lib/db";
import {
  buildDateKeys,
  buildHygieneExampleEmployees,
  formatMonthLabel,
  getDayNumber,
  getHealthDocumentTitle,
  getHygieneDocumentTitle,
  getStatusMeta,
  getWeekdayShort,
  HYGIENE_REGISTER_LEGEND,
  HYGIENE_REGISTER_NOTES,
  HEALTH_REGISTER_NOTES,
  HEALTH_REGISTER_REMINDER,
  normalizeHealthEntryData,
  normalizeHygieneEntryData,
  toDateKey,
} from "@/lib/hygiene-document";

const FONT_CANDIDATES = [
  "C:\\Windows\\Fonts\\arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/msttcorefonts/Arial.ttf",
];

function loadUnicodeFont(doc: jsPDF) {
  const fontPath = FONT_CANDIDATES.find((candidate) => fs.existsSync(candidate));

  if (!fontPath) {
    return "helvetica";
  }

  const base64 = fs.readFileSync(fontPath).toString("base64");
  doc.addFileToVFS("journal-unicode.ttf", base64);
  doc.addFont("journal-unicode.ttf", "JournalUnicode", "normal");
  return "JournalUnicode";
}

function makeCellKey(employeeId: string, dateKey: string) {
  return `${employeeId}:${dateKey}`;
}

function renderWrappedLines(
  doc: jsPDF,
  lines: string[],
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight = 5
) {
  let y = startY;
  lines.forEach((line) => {
    const chunks = doc.splitTextToSize(line, maxWidth) as string[];
    chunks.forEach((chunk) => {
      doc.text(chunk, startX, y);
      y += lineHeight;
    });
  });
  return y;
}

export async function generateJournalDocumentPdf(params: {
  documentId: string;
  organizationId: string;
}): Promise<{ buffer: Buffer; fileName: string }> {
  const { documentId, organizationId } = params;

  const document = await db.journalDocument.findUnique({
    where: { id: documentId },
    include: {
      template: true,
      organization: { select: { name: true } },
      entries: { orderBy: [{ employeeId: "asc" }, { date: "asc" }] },
    },
  });

  if (!document || document.organizationId !== organizationId) {
    throw new Error("Документ не найден");
  }

  const users = await db.user.findMany({
    where: {
      organizationId,
      isActive: true,
    },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const fontName = loadUnicodeFont(doc);
  doc.setFont(fontName, "normal");

  const templateCode = document.template.code;
  const dateKeys = buildDateKeys(document.dateFrom, document.dateTo);
  const organizationName = document.organization?.name || 'ООО "Тест"';
  const monthLabel = formatMonthLabel(document.dateFrom, document.dateTo);
  const includedEmployeeIds = [...new Set(document.entries.map((entry) => entry.employeeId))];
  const includedUsers = users.filter((user) => includedEmployeeIds.includes(user.id));
  const rowCount = templateCode === "health_check" ? 5 : 7;
  const printableEmployees = buildHygieneExampleEmployees(includedUsers, Math.max(rowCount, includedUsers.length));
  const pageWidth = doc.internal.pageSize.getWidth();

  const headerTitle =
    templateCode === "health_check" ? getHealthDocumentTitle() : getHygieneDocumentTitle();

  const entryMap: Record<string, Record<string, unknown>> = {};
  document.entries.forEach((entry) => {
    entryMap[makeCellKey(entry.employeeId, toDateKey(entry.date))] =
      (entry.data as Record<string, unknown>) || {};
  });

  doc.setFontSize(24);
  doc.text(headerTitle, 14, 15);

  doc.setFontSize(10);
  doc.rect(24, 28, pageWidth - 48, 32);
  doc.line(70, 28, 70, 60);
  doc.line(pageWidth - 54, 28, pageWidth - 54, 60);
  doc.line(70, 39, pageWidth - 54, 39);
  doc.line(70, 49, pageWidth - 54, 49);
  doc.text(organizationName, 47, 44, { align: "center" });
  doc.text("СИСТЕМА ХАССП", (70 + (pageWidth - 54)) / 2, 35, { align: "center" });
  doc.text(headerTitle.toUpperCase(), (70 + (pageWidth - 54)) / 2, 45, { align: "center" });
  doc.text("СТР. 1 ИЗ 1", pageWidth - 39, 44, { align: "center" });
  doc.text(`Месяц ${monthLabel}`, pageWidth / 2, 67, { align: "center" });

  const startY = 72;

  if (templateCode === "health_check") {
    const head = [[
      "№ п/п",
      "Ф.И.О. работника",
      "Должность",
      ...dateKeys.map((dateKey) => `${getDayNumber(dateKey)} ${getWeekdayShort(dateKey)}`),
      "Принятые меры",
    ]];

    const body = printableEmployees.map((employee) => {
      return [
        employee.name ? String(employee.number) : "",
        employee.name || "",
        employee.position || "",
        ...dateKeys.map((dateKey) => {
          const data = normalizeHealthEntryData(entryMap[makeCellKey(employee.id, dateKey)]);
          return data.signed ? "+" : "";
        }),
        "",
      ];
    });

    autoTable(doc, {
      startY,
      head,
      body,
      theme: "grid",
      styles: {
        font: fontName,
        fontSize: 8,
        cellPadding: 1.8,
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: "normal",
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 32 },
        2: { cellWidth: 34 },
        [dateKeys.length + 3]: { cellWidth: 28 },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 120;
    doc.setFontSize(9);
    let textY = renderWrappedLines(doc, HEALTH_REGISTER_NOTES, 14, finalY + 10, pageWidth - 28, 5.5);
    textY += 4;
    doc.setFont(fontName, "normal");
    doc.text(HEALTH_REGISTER_REMINDER, 14, textY);
  } else {
    const head = [[
      "№ п/п",
      "Ф.И.О. работника",
      "Должность",
      ...dateKeys.map((dateKey) => String(getDayNumber(dateKey))),
    ]];

    const body: string[][] = [];
    printableEmployees.forEach((employee) => {
      body.push([
        employee.name ? String(employee.number) : "",
        employee.name || "",
        employee.position || "",
        ...dateKeys.map((dateKey) => {
          const data = normalizeHygieneEntryData(entryMap[makeCellKey(employee.id, dateKey)]);
          return getStatusMeta(data.status)?.code || "";
        }),
      ]);

      body.push([
        "",
        "Температура сотрудника более 37°C?",
        "",
        ...dateKeys.map((dateKey) => {
          const data = normalizeHygieneEntryData(entryMap[makeCellKey(employee.id, dateKey)]);
          if (data.temperatureAbove37 === true) return "да";
          if (data.temperatureAbove37 === false) return "нет";
          if (data.status === "day_off") return "-";
          return "";
        }),
      ]);
    });

    body.push([
      "",
      "Должность ответственного за контроль",
      document.responsibleTitle || "",
      ...dateKeys.map(() => ""),
    ]);

    autoTable(doc, {
      startY,
      head,
      body,
      theme: "grid",
      styles: {
        font: fontName,
        fontSize: 8,
        cellPadding: 1.8,
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: "normal",
      },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 34 },
        2: { cellWidth: 38 },
      },
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 120;
    doc.setFontSize(9);
    renderWrappedLines(
      doc,
      ["В журнал регистрируются результаты:", ...HYGIENE_REGISTER_NOTES.map((note) => `- ${note}`)],
      14,
      finalY + 8,
      pageWidth - 28,
      5
    );
    renderWrappedLines(
      doc,
      ["Условные обозначения:", ...HYGIENE_REGISTER_LEGEND],
      14,
      finalY + 39,
      pageWidth - 28,
      5
    );
  }

  const arrayBuffer = doc.output("arraybuffer");
  const buffer = Buffer.from(arrayBuffer);
  const fallbackTitle =
    templateCode === "health_check" ? "health-journal" : "hygiene-journal";

  return {
    buffer,
    fileName: `${fallbackTitle}-${toDateKey(document.dateFrom)}-${toDateKey(document.dateTo)}.pdf`,
  };
}
