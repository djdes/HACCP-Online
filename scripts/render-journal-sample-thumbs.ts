/**
 * Рисует превью первой страницы образца каждого журнала в PNG.
 *
 * Зачем файлы, а не рендер на лету: карточек на /journals-info больше
 * десятка, и встроить в каждую по полумегабайтному PDF — значит
 * положить страницу. Образцы детерминированы (период зафиксирован в
 * фикстурах), поэтому картинка не «протухает» сама.
 *
 * Когда перезапускать: после любой правки печатной формы. Нужен
 * запущенный сайт и локальный Chromium от Playwright.
 *
 *   npx tsx scripts/render-journal-sample-thumbs.ts http://localhost:3010
 */
import fs from "fs";
import path from "path";
import { chromium } from "playwright-core";
import { SAMPLE_JOURNAL_CODES } from "../src/lib/journal-sample-fixtures";
import { PAPER_JOURNALS } from "../src/lib/sphere-journal-rules";

const BASE = process.argv[2] ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "journal-samples");
const TMP = path.join(process.cwd(), ".sample-thumbs-tmp");

function chromiumPath(): string {
  const root = path.join(process.env.LOCALAPPDATA ?? "", "ms-playwright");
  const dir = fs
    .readdirSync(root)
    .filter((d) => d.startsWith("chromium-") && !d.includes("headless"))
    .sort()
    .pop();
  if (!dir) throw new Error("Chromium от Playwright не найден");
  return path.join(root, dir, "chrome-win64", "chrome.exe");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  const browser = await chromium.launch({
    executablePath: chromiumPath(),
    args: ["--use-gl=swiftshader", "--no-sandbox"],
  });

  /** Один PDF → один PNG. Геометрия одна на все бланки: A4 landscape. */
  async function shoot(url: string, name: string) {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`FAIL ${name}: HTTP ${res.status}`);
      return;
    }
    const pdf = path.join(TMP, `${name}.pdf`);
    fs.writeFileSync(pdf, Buffer.from(await res.arrayBuffer()));

    const page = await browser.newPage({
      viewport: { width: 1240, height: 950 },
      deviceScaleFactor: 1,
    });
    // Встроенный просмотрщик Chromium сам рисует страницу — этого
    // достаточно, отдельный растеризатор PDF тянуть не нужно.
    await page.goto("file:///" + pdf.split(path.sep).join("/") + "#toolbar=0&view=Fit");
    await page.waitForTimeout(3500);
    // При #toolbar=0&view=Fit страница занимает почти весь кадр —
    // срезаем только тонкую серую рамку просмотрщика.
    await page.screenshot({
      path: path.join(OUT, `${name}.png`),
      clip: { x: 6, y: 6, width: 1228, height: 862 },
    });
    await page.close();
    console.log(`OK   ${name}`);
  }

  for (const code of SAMPLE_JOURNAL_CODES) {
    await shoot(`${BASE}/api/journal-samples/${code}/pdf?inline=1`, code);
  }

  // Бумажные бланки. Префикс paper_ — потому что id бланков живут в
  // своём пространстве имён и в теории могут совпасть с кодом
  // электронного журнала.
  for (const journal of PAPER_JOURNALS) {
    await shoot(
      `${BASE}/api/journal-samples/paper/${journal.id}/pdf?inline=1`,
      `paper_${journal.id}`,
    );
  }

  await browser.close();
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\nготово → public/journal-samples/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
