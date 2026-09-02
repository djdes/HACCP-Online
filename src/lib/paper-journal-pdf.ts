import fs from "node:fs";
import path from "node:path";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { PaperJournal } from "@/lib/sphere-journal-rules";
import { stampPartnerPdfFooter, type PdfFooterBrand } from "@/lib/pdf-page-labels";

/**
 * Бланк бумажного журнала для печати.
 *
 * Инструктажи по охране труда закон разрешает вести только на бумаге
 * (ТК РФ ст. 22.1), пожарные журналы — можно и электронно с подписью.
 * И тем и другим нужен готовый лист с шапкой организации и нужными
 * колонками, поэтому бланк даём всем, но обещаем разное: пометку
 * «электронная форма не принимается» печатаем только там, где это
 * правда (`journal.paperOnly`). Пустые строки печатаем всегда —
 * заполнять их будут ручкой.
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
  /** White-label партнёра — подпись в подвале каждой страницы. */
  branding?: PdfFooterBrand | null;
}): Buffer {
  const { journal, organization, rows = [], blankRows = 18, branding = null } = params;

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
  doc.setTextColor(90, 90, 90);
  // Размер штрафа с бланка убран: это лист, который кладут в папку и
  // показывают инспектору, и наша приписка про санкции там — самодеятельность.
  // Бланк должен выглядеть как бланк. Норму права оставляем: она объясняет,
  // почему журнал именно бумажный, и в документе уместна.
  doc.text(
    journal.paperOnly
      ? `Бланк для бумажного ведения. Электронная форма не применяется — ${journal.law.label}.`
      : `Бланк для бумажного ведения — ${journal.law.label}.`,
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

  stampPartnerPdfFooter(doc, branding, font);

  return Buffer.from(doc.output("arraybuffer"));
}
