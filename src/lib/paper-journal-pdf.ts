import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PaperJournal } from "@/lib/sphere-journal-rules";

/**
 * Бланк бумажного журнала для печати.
 *
 * Эти журналы (инструктажи по охране труда и пожарной безопасности)
 * инспектор принимает только на бумаге с живой подписью, поэтому наша
 * задача — не «вести» их, а выдать готовый лист с шапкой организации и
 * нужными колонками. Пустые строки печатаем всегда: заполнять их будут
 * ручкой.
 *
 * Шрифт — тот же DejaVu, что и у остальных PDF: helvetica в jsPDF не
 * знает кириллицы и печатает кракозябры (см. document-pdf.ts).
 */

const FONT_CANDIDATES = [
  path.join(process.cwd(), "src", "lib", "pdf-fonts", "DejaVuSans.ttf"),
  "C:\\Windows\\Fonts\\arial.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
];

function loadUnicodeFont(doc: jsPDF): string {
  const fontPath = FONT_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!fontPath) return "helvetica";
  const base64 = fs.readFileSync(fontPath).toString("base64");
  doc.addFileToVFS("paper-unicode.ttf", base64);
  doc.addFont("paper-unicode.ttf", "PaperUnicode", "normal");
  doc.addFont("paper-unicode.ttf", "PaperUnicode", "bold");
  return "PaperUnicode";
}

export type PaperJournalOrg = {
  name: string;
  inn?: string | null;
  address?: string | null;
};

export function renderPaperJournalPdf(params: {
  journal: PaperJournal;
  organization: PaperJournalOrg;
  /** Заполненные строки. Пусто — печатаем чистый бланк. */
  rows?: string[][];
  /** Сколько пустых строк добавить под рукописное заполнение. */
  blankRows?: number;
}): Buffer {
  const { journal, organization, rows = [], blankRows = 18 } = params;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const font = loadUnicodeFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont(font, "bold");
  doc.setFontSize(13);
  doc.text(organization.name, pageWidth / 2, 14, { align: "center" });

  const subtitleParts = [
    organization.inn ? `ИНН ${organization.inn}` : null,
    organization.address || null,
  ].filter(Boolean);
  if (subtitleParts.length > 0) {
    doc.setFont(font, "normal");
    doc.setFontSize(9);
    doc.text(subtitleParts.join(" · "), pageWidth / 2, 20, { align: "center" });
  }

  doc.setFont(font, "bold");
  doc.setFontSize(15);
  doc.text(journal.name, pageWidth / 2, 30, { align: "center" });

  // Красная пометка: человек не должен решить, что этот бланк заменяет
  // электронный журнал — он именно для бумаги.
  doc.setFont(font, "normal");
  doc.setFontSize(8);
  doc.setTextColor(161, 58, 50);
  doc.text(
    `Бланк для бумажного ведения. Электронная форма не принимается — ${journal.law.label}. Штраф ${journal.fineHint}.`,
    pageWidth / 2,
    36,
    { align: "center" },
  );
  doc.setTextColor(0, 0, 0);

  const head = [["№", ...journal.columns]];
  const filled = rows.map((row, index) => [
    String(index + 1),
    ...journal.columns.map((_, column) => row[column] ?? ""),
  ]);
  const blanks = Array.from({ length: blankRows }, (_, index) => [
    String(filled.length + index + 1),
    ...journal.columns.map(() => ""),
  ]);

  autoTable(doc, {
    head,
    body: [...filled, ...blanks],
    startY: 42,
    styles: {
      font,
      fontSize: 8,
      cellPadding: 2.4,
      lineColor: [11, 16, 36],
      lineWidth: 0.2,
      textColor: [11, 16, 36],
      minCellHeight: 9,
    },
    headStyles: {
      font,
      fontStyle: "bold",
      fillColor: [238, 241, 255],
      textColor: [11, 16, 36],
      fontSize: 8,
    },
    columnStyles: { 0: { cellWidth: 10, halign: "center" } },
    margin: { left: 10, right: 10 },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
