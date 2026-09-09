import fs from "node:fs";
import path from "node:path";

import type { jsPDF } from "jspdf";

/**
 * Кириллический шрифт для jsPDF: та же DejaVu Sans, что у журналов
 * (`document-pdf.ts`). Штатные шрифты jsPDF кириллицы не знают —
 * документ печатался бы кракозябрами. Base64 читаем один раз на
 * процесс: PDF уходит в каждое письмо после оплаты.
 */
const BUNDLED_FONT_PATH = path.join(process.cwd(), "src", "lib", "pdf-fonts", "DejaVuSans.ttf");

const FONT_CANDIDATES = [
  BUNDLED_FONT_PATH,
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "C:\\Windows\\Fonts\\arial.ttf",
];

export const UNICODE_FONT = "ClosingUnicode";

let cachedBase64: string | null | undefined;

function loadBase64(): string | null {
  if (cachedBase64 !== undefined) return cachedBase64;
  const found = FONT_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  cachedBase64 = found ? fs.readFileSync(found).toString("base64") : null;
  return cachedBase64;
}

/**
 * Регистрирует шрифт в документе и возвращает его имя (или helvetica,
 * если шрифта нет). Только «normal»: jsPDF не синтезирует жирный, а
 * каждая регистрация вшивает файл целиком — второй стиль удваивал PDF
 * (1,4 МБ вместо 0,7), не меняя ни одного глифа.
 */
export function registerUnicodeFont(doc: jsPDF): string {
  const base64 = loadBase64();
  if (!base64) return "helvetica";
  doc.addFileToVFS("closing-unicode.ttf", base64);
  doc.addFont("closing-unicode.ttf", UNICODE_FONT, "normal");
  return UNICODE_FONT;
}
