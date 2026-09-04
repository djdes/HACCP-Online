import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Геометрия образцов в public/journal-samples — карточки ждут её же. */
export const PREVIEW_WIDTH = 1228;
export const PREVIEW_HEIGHT = 862;

export type RenderedPreview = {
  png: Buffer;
  width: number;
  height: number;
};

type CanvasModule = typeof import("@napi-rs/canvas");

/**
 * require относительно корня приложения, а не `import.meta.url`: в
 * production-сборке Next (webpack, CJS) `import.meta.url` превращается в
 * числовой id модуля, и `createRequire` падает с «path must be a string».
 * `process.cwd()` — каталог приложения и у PM2, и у `next dev`, и у тестов.
 */
function appRequire(): NodeJS.Require {
  return createRequire(path.join(process.cwd(), "package.json"));
}

let canvasModule: CanvasModule | null = null;
function loadCanvas(): CanvasModule {
  if (!canvasModule) {
    // require, а не import: pdfjs сам грузит @napi-rs/canvas через
    // require, и второй экземпляр модуля нам ни к чему.
    const req = appRequire();
    canvasModule = req("@napi-rs/canvas") as CanvasModule;
  }
  return canvasModule;
}

function workerFileUrl(): string {
  const req = appRequire();
  const pkg = req.resolve("pdfjs-dist/package.json");
  const file = path.join(path.dirname(pkg), "legacy", "build", "pdf.worker.mjs");
  return pathToFileURL(file).href;
}

function standardFontsDir(): string {
  const req = appRequire();
  const pkg = req.resolve("pdfjs-dist/package.json");
  const dir = path.join(path.dirname(pkg), "standard_fonts");
  // pdfjs склеивает url + имя файла как строки, поэтому нужен trailing slash.
  return dir.split(path.sep).join("/") + "/";
}

/**
 * Первая страница PDF → PNG в пропорции образцов (1228×862), кадр сверху.
 *
 * Без браузера: pdfjs (legacy-сборка для Node) рисует в canvas от
 * `@napi-rs/canvas` — prebuilt-бинарник без системных зависимостей.
 * Шрифты берутся из самого PDF (jsPDF их встраивает), поэтому кириллица
 * выходит такой же, как при печати.
 */
export async function renderPdfFirstPageToPng(
  pdf: Uint8Array | ArrayBuffer,
  opts: { width?: number; height?: number } = {}
): Promise<RenderedPreview> {
  const width = opts.width ?? PREVIEW_WIDTH;
  const height = opts.height ?? PREVIEW_HEIGHT;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // «Fake worker» в Node подгружает pdf.worker.mjs динамическим import'ом
  // по относительному пути — внутри Next-бандла его нет. Даём абсолютный
  // file:// на файл из node_modules (пакет к тому же в serverExternalPackages).
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerFileUrl();
  }
  const data = pdf instanceof Uint8Array ? pdf : new Uint8Array(pdf);
  const task = pdfjs.getDocument({
    data,
    // Один процесс, без worker'а: рендер идёт в cron'е, параллелить нечего.
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
    // Стандартные 14 шрифтов PDF (Helvetica и т. п.) не встраиваются в
    // файл — pdfjs подставляет свои из пакета. Без пути будет warning и
    // латиница fallback-шрифтом.
    standardFontDataUrl: standardFontsDir(),
  } as Parameters<typeof pdfjs.getDocument>[0]);

  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = width / base.width;
    const viewport = page.getViewport({ scale });

    const { createCanvas } = loadCanvas();
    const pageCanvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height)
    );
    const ctx = pageCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    await page.render({
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    } as Parameters<typeof page.render>[0]).promise;

    // Кадрируем сверху: шапка бланка и первые строки — то, что узнаётся.
    const out = createCanvas(width, height);
    const outCtx = out.getContext("2d");
    outCtx.fillStyle = "#ffffff";
    outCtx.fillRect(0, 0, width, height);
    outCtx.drawImage(pageCanvas, 0, 0);

    return { png: out.toBuffer("image/png"), width, height };
  } finally {
    // Закрывается loading task, а не документ: у PDFDocumentProxy в
    // v6 нет `destroy()`, а task освобождает и документ, и worker-порт.
    await task.destroy();
  }
}
