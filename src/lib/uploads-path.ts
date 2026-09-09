import { join, normalize, resolve, sep } from "node:path";

/**
 * Где лежат файлы, загруженные людьми.
 *
 * Одно место и для записи, и для отдачи — иначе они разъезжаются, и
 * файл, который «успешно загружен», не открывается. Ровно это и
 * произошло: писали в `public/uploads`, а отдать оттуда Next не мог.
 *
 * **Почему отдаём маршрутом, а не из `public/`.** Next.js составляет
 * список файлов `public/` на СБОРКЕ. Всё, что появилось позже, сервер
 * не отдаёт вовсе — проверено на проде 2026-09-09: файл, положенный в
 * `public` в рантайме, отвечал 404 даже напрямую, мимо nginx, тогда как
 * файл из сборки отвечал 200. То есть ни одно загруженное фото не
 * открывалось после загрузки, а фото в журналах дезинфекции, забраковки
 * и аварий — это доказательство на проверке.
 *
 * Каталог по умолчанию тот же, куда пишут загрузчики, поэтому менять их
 * не нужно: на проде `public/uploads` — симлинк на хранилище вне дерева,
 * которое деплой сносит.
 */
export function uploadsDir(): string {
  const fromEnv = process.env.UPLOADS_DIR?.trim();
  if (fromEnv) return fromEnv;
  return join(process.cwd(), "public", "uploads");
}

/**
 * Превращает сегменты URL в путь на диске и отказывает всему, что
 * пытается выйти за пределы каталога загрузок.
 *
 * Маршрут отдаёт файлы по пути из запроса, то есть это классическое
 * место для обхода каталога: `../../.env` увёл бы наружу секреты.
 * Поэтому проверка не «нет ли в строке двух точек», а сравнение уже
 * разрешённого абсолютного пути с корнем — обойти его нельзя ни
 * процентным кодированием, ни обратными слешами, ни симлинком в имени.
 */
export function resolveUploadPath(
  segments: string[],
  baseDir: string = uploadsDir(),
): string | null {
  if (segments.length === 0) return null;

  // Пустые сегменты, точки и разделители внутри сегмента — признак
  // склейки пути, а не имени файла.
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") return null;
    if (segment.includes("/") || segment.includes("\\")) return null;
    if (segment.includes("\0")) return null;
  }

  const base = resolve(baseDir);
  const target = resolve(join(base, ...segments));
  const withSep = base.endsWith(sep) ? base : base + sep;

  // `resolve` уже схлопнул «..», поэтому достаточно проверить, что
  // получившийся путь лежит внутри корня.
  if (target !== base && !target.startsWith(withSep)) return null;
  if (normalize(target) !== target) return null;

  return target;
}

/** Тип содержимого по расширению — для заголовка ответа. */
export function uploadContentType(name: string): string {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "pdf":
      return "application/pdf";
    default:
      // Неизвестное отдаём потоком байт и НЕ угадываем: угаданный
      // text/html из чужого файла — это XSS на нашем домене.
      return "application/octet-stream";
  }
}
