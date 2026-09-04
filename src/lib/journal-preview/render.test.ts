import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH, renderPdfFirstPageToPng } from "./render";

function readUInt32BE(buf: Buffer, offset: number) {
  return buf.readUInt32BE(offset);
}

describe("renderPdfFirstPageToPng", () => {
  it("renders the first page into a PNG of the sample geometry", async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(18);
    doc.text("Journal preview probe", 20, 20);
    doc.rect(15, 30, 200, 40);
    const pdf = doc.output("arraybuffer");

    const result = await renderPdfFirstPageToPng(pdf);

    // PNG signature
    assert.deepEqual(
      Array.from(result.png.subarray(0, 8)),
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    );
    // IHDR width/height at bytes 16..24
    assert.equal(readUInt32BE(result.png, 16), PREVIEW_WIDTH);
    assert.equal(readUInt32BE(result.png, 20), PREVIEW_HEIGHT);
    assert.equal(result.width, PREVIEW_WIDTH);
    assert.equal(result.height, PREVIEW_HEIGHT);
    assert.ok(result.png.length > 1000, "png should not be empty");
  });
});
