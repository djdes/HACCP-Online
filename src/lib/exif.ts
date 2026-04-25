/**
 * Минимальный EXIF-парсер для DateTimeOriginal.
 *
 * Стандарт EXIF хранит дату как ASCII «YYYY:MM:DD HH:MM:SS» внутри
 * APP1 маркера JPEG (как правило, в первых 64 KB файла). Полноценный
 * парсер тут избыточен — нам достаточно вытащить первую такую строку
 * через регулярное выражение поверх байтов в latin1.
 *
 * Возвращает `null`, если EXIF отсутствует или дата не парсится. Если
 * найденная дата валидна — возвращает `Date`, считая время как UTC
 * (большинство мобильных камер пишут локальное время без TZ; небольшая
 * погрешность приемлема для anti-fraud окна в 5 минут).
 */
export function extractPhotoTakenAt(buffer: Buffer): Date | null {
  if (!buffer || buffer.length < 4) return null;

  // SOI (FFD8) — JPEG. Если не JPEG, пытаемся всё равно: PNG/HEIC иногда
  // имеют собственные XMP-блоки с тем же ASCII-форматом даты, тоже ок.
  const head = Math.min(buffer.length, 65536);
  let text: string;
  try {
    text = buffer.slice(0, head).toString("latin1");
  } catch {
    return null;
  }

  // Берём первую найденную дату вида «YYYY:MM:DD HH:MM:SS». Ограничения:
  //   - Год 19xx/20xx, чтобы случайно не зацепить, например, «00:00:00»
  //     из других секций.
  //   - Месяц 01–12, день 01–31, часы 00–23, минуты/секунды 00–59
  //     валидируем при `Date` ниже.
  const match = text.match(
    /\b((?:19|20)\d{2}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})\b/
  );
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}.000Z`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/**
 * Проверяет, что фото снято не более `windowMs` миллисекунд назад
 * (по умолчанию 5 минут). Допускает небольшое отклонение в будущее
 * (`futureToleranceMs`, по умолчанию 1 мин) — телефонные часы могут
 * чуть забегать. Если EXIF не найден или дата вне окна — `false`.
 */
export function isPhotoFresh(
  photoTakenAt: Date | null,
  now: Date = new Date(),
  windowMs = 5 * 60 * 1000,
  futureToleranceMs = 60 * 1000
): boolean {
  if (!photoTakenAt) return false;
  const ageMs = now.getTime() - photoTakenAt.getTime();
  if (ageMs < -futureToleranceMs) return false;
  if (ageMs > windowMs) return false;
  return true;
}
