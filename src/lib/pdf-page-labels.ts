import type { jsPDF } from "jspdf";

/**
 * Единая нумерация страниц печатных бланков — «СТР. X ИЗ N».
 *
 * Раньше каждая `draw<Journal>Pdf` рисовала подпись СРАЗУ, когда общее
 * число страниц ещё не известно, поэтому в шапке стоял хардкод
 * («СТР. 1 ИЗ 1» на трёхстраничном журнале) либо ячейка оставалась пустой.
 *
 * Теперь отрисовщик только РЕГИСТРИРУЕТ прямоугольник ячейки, а текст
 * ставится одним проходом `stampJournalPageNumbers` после вёрстки, когда
 * `doc.getNumberOfPages()` уже честный. Страницы без шапки получают
 * подпись в правом нижнем углу.
 *
 * Состояние модульное — как `activeControlPeriodicity` в `document-pdf.ts`:
 * значение сбрасывается в начале генерации, а вся отрисовка jsPDF
 * синхронна, поэтому параллельные запросы не пересекаются.
 */
export type PageLabelSlot = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  maxWidth: number;
  fontSize: number;
  fontStyle: "normal" | "bold";
};

let pageLabelSlots: PageLabelSlot[] = [];

export function resetPageLabelSlots() {
  pageLabelSlots = [];
}

function currentPageNumber(doc: jsPDF): number {
  const withInfo = doc as jsPDF & {
    getCurrentPageInfo?: () => { pageNumber: number };
  };
  return withInfo.getCurrentPageInfo?.().pageNumber ?? doc.getNumberOfPages();
}

export function registerPageLabelSlot(
  doc: jsPDF,
  slot: Omit<PageLabelSlot, "page">
) {
  pageLabelSlots.push({ ...slot, page: currentPageNumber(doc) });
}

function drawCenteredLabel(
  doc: jsPDF,
  text: string,
  slot: PageLabelSlot
) {
  const lines = doc.splitTextToSize(text, slot.maxWidth) as string[];
  const lineHeight = 4.6;
  const startY = slot.y + slot.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    doc.text(line, slot.x + slot.width / 2, startY + index * lineHeight, {
      align: "center",
    });
  });
}

export function stampJournalPageNumbers(doc: jsPDF, fontName = "JournalUnicode") {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const byPage = new Map<number, PageLabelSlot>();
  for (const slot of pageLabelSlots) {
    if (!byPage.has(slot.page)) byPage.set(slot.page, slot);
  }

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    const label = `СТР. ${pageNumber} ИЗ ${totalPages}`;
    const slot = byPage.get(pageNumber);
    doc.setFont(fontName, slot?.fontStyle ?? "bold");
    doc.setFontSize(slot?.fontSize ?? 10);
    if (slot) {
      drawCenteredLabel(doc, label, slot);
    } else {
      doc.text(label, pageWidth - 14, pageHeight - 8, { align: "right" });
    }
  }

  doc.setFont(fontName, "normal");
  doc.setFontSize(10);
}
