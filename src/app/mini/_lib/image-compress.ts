/**
 * Client-side compression фото перед upload в /api/mini/attachments.
 *
 * Зачем: повар на iPhone снимает 3-4MB JPEG. На cellular в подвале
 * кухни upload занимает 5-10 секунд, на лагающем 3G — иногда падает
 * по timeout. После сжатия 1600px-side @0.85 quality файл становится
 * ~400-700KB (5-6× меньше) — sub-second upload, надёжнее, и сервер
 * получает image такой же визуальной чёткости (1600px достаточно
 * для проверяющего РПН).
 *
 * Не сжимаем:
 *  - WebP (уже эффективно сжаты);
 *  - PNG-скриншоты (сжатие может ухудшить читаемость текста);
 *  - файлы < 1MB (уже маленькие, JPEG-recompression только увредит
 *    качество без выигрыша).
 *
 * Стратегия: image → canvas → toBlob('image/jpeg', 0.85). На старых
 * браузерах без `OffscreenCanvas` или `toBlob` — fallback на исходный
 * файл (callers видят null → используют raw).
 */

const MAX_SIDE = 1600;
const QUALITY = 0.85;
const MIN_SIZE_BYTES = 1024 * 1024; // 1MB — ниже не сжимаем
const COMPRESS_MIME = "image/jpeg";

/** Возвращает сжатый File или null если compression не имеет смысла. */
export async function compressImageIfWorthwhile(
  file: File
): Promise<File | null> {
  if (typeof window === "undefined") return null;
  if (!file.type.startsWith("image/")) return null;
  // Не трогаем PNG (текст-скриншоты) и WebP (уже сжатый).
  if (file.type === "image/png" || file.type === "image/webp") return null;
  if (file.size < MIN_SIZE_BYTES) return null;

  // ObjectURL вместо data-URL — экономия ~37% памяти (data-URL
  // base64 раздувает blob на 1.37×). На 4MB JPEG это разница между
  // success и OOM-крашем WebView на iPhone в подвале кухни. Pass-4 M1.
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const { width: srcW, height: srcH } = img;
    if (srcW === 0 || srcH === 0) return null;

    const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));
    const dstW = Math.round(srcW * scale);
    const dstH = Math.round(srcH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob(resolve, COMPRESS_MIME, QUALITY);
    });
    if (!blob) return null;

    // Не возвращаем сжатую версию если она оказалась больше
    // оригинала (бывает на edge-case для уже плотно сжатых JPEG).
    if (blob.size >= file.size) return null;

    // Меняем расширение на .jpg чтобы соответствовать новому MIME.
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.jpg`, {
      type: COMPRESS_MIME,
      lastModified: Date.now(),
    });
  } catch {
    return null;
  } finally {
    // Освобождаем ObjectURL — иначе он живёт до unload и держит blob.
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}
