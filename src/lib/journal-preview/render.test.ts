import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, renderPdfFirstPageToPng } from "./render";

describe("renderPdfFirstPageToPng", () => {
  it("renders the first page into a WebP of the card geometry", async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(18);
    doc.text("Journal preview probe", 20, 20);
    doc.rect(15, 30, 200, 40);
    const pdf = doc.output("arraybuffer");

    const result = await renderPdfFirstPageToPng(pdf);

    // RIFF....WEBP — контейнер WebP. Роут `/api/journal-previews/[code]`
    // определяет Content-Type по этой же сигнатуре.
    assert.equal(result.png.subarray(0, 4).toString("latin1"), "RIFF");
    assert.equal(result.png.subarray(8, 12).toString("latin1"), "WEBP");
    assert.equal(result.contentType, "image/webp");
    assert.equal(result.width, PREVIEW_WIDTH);
    assert.equal(result.height, PREVIEW_HEIGHT);
    assert.ok(result.png.length > 1000, "preview should not be empty");
    // Ради этого всё и затевалось: карточка журнала должна весить
    // десятки килобайт, а не полторы сотни.
    assert.ok(
      result.png.length < 120_000,
      `preview too heavy: ${result.png.length} bytes`
    );
  });
});
