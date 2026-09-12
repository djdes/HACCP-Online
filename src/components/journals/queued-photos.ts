"use client";

/**
 * Снимки, сделанные без связи и ещё не загруженные на сервер.
 *
 * Держим в памяти страницы, а не в IndexedDB: пока форма открыта, снимок
 * живёт вместе с ней, а в базу он попадает в момент отправки — вместе со
 * всей записью, одним куском. Класть его в базу раньше значило бы
 * заводить вторую уборку — для снимков, чью форму человек передумал
 * отправлять.
 *
 * В значении поля вместо адреса стоит метка `queued-photo:<id>`. Она
 * уезжает в тело запроса и заменяется настоящим адресом при отправке из
 * очереди (`app/mini/_lib/journal-queue.ts`).
 */

import { QUEUED_PHOTO_PREFIX } from "@/app/mini/_lib/queued-photo-mark";

type Held = { blob: Blob; previewUrl: string };

const held = new Map<string, Held>();

export function isQueuedPhotoMark(value: string): boolean {
  return value.startsWith(QUEUED_PHOTO_PREFIX);
}

/** Кладёт снимок и возвращает метку для значения поля. */
export function holdQueuedPhoto(blob: Blob): string {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const mark = `${QUEUED_PHOTO_PREFIX}${id}`;
  held.set(mark, { blob, previewUrl: URL.createObjectURL(blob) });
  return mark;
}

/** Адрес для превью прямо на устройстве — сервер снимка ещё не видел. */
export function queuedPhotoPreview(mark: string): string | null {
  return held.get(mark)?.previewUrl ?? null;
}

/** Собирает снимки, на которые ссылается тело запроса. */
export function collectQueuedPhotos(payload: unknown): Record<string, Blob> {
  const serialized = JSON.stringify(payload ?? {});
  const out: Record<string, Blob> = {};
  for (const [mark, value] of held) {
    if (serialized.includes(mark)) out[mark] = value.blob;
  }
  return out;
}

/**
 * Сервер снимок увидел и отказался его принимать (например, слишком
 * большой файл). Отличать это от «связи нет» важно: связь вернётся, а
 * слишком большой файл останется слишком большим — и запись, поставленная
 * из-за него в очередь, повторялась бы вечно.
 */
export class PhotoRejectedError extends Error {
  constructor(readonly status: number) {
    super(`photo upload rejected: ${status}`);
    this.name = "PhotoRejectedError";
  }
}

/** Есть ли в теле запроса ссылки на ещё не загруженные снимки. */
export function hasQueuedPhotos(payload: unknown): boolean {
  return JSON.stringify(payload ?? {}).includes(QUEUED_PHOTO_PREFIX);
}

/**
 * Загружает снимки и подставляет в тело запроса настоящие адреса.
 * Бросает, если хоть один не загрузился: запись со ссылкой на файл,
 * которого нет, хуже, чем ещё одна попытка позже.
 *
 * Общая и для прямой отправки, и для отправки из очереди — иначе метка
 * `queued-photo:…` могла бы уехать в журнал строкой. Так и было бы,
 * если бы снимок не загрузился из-за обрыва, а связь вернулась до
 * нажатия «Сохранить».
 */
export class MissingQueuedPhotoError extends Error {
  constructor() {
    super("queued photo blob is gone");
    this.name = "MissingQueuedPhotoError";
  }
}

/**
 * Защёлка: в теле запроса не осталось меток.
 *
 * Метка без снимка — самый неприятный исход из возможных: запись
 * уйдёт и будет выглядеть заполненной, а в поле фото будет строка
 * «queued-photo:…» вместо доказательства. На проверке это хуже пустого
 * поля: пустое видно сразу, а битую ссылку заметят через полгода.
 *
 * Дойти сюда можно: `collectQueuedPhotos` собирает снимки из памяти
 * страницы, и если страница перезагрузилась или снимок уже отпущен,
 * он вернёт пустоту — а метка в теле останется.
 */
export function assertNoQueuedPhotoMarks(payload: unknown): void {
  if (hasQueuedPhotos(payload)) throw new MissingQueuedPhotoError();
}

export async function uploadAndSubstitutePhotos<T>(
  payload: T,
  photos: Record<string, Blob>,
): Promise<T> {
  const marks = Object.keys(photos);
  if (marks.length === 0) {
    // Нечего загружать — но если метки всё же есть, значит снимки
    // потеряны, и отправлять такую запись нельзя.
    assertNoQueuedPhotoMarks(payload);
    return payload;
  }

  let serialized = JSON.stringify(payload);
  for (const mark of marks) {
    const form = new FormData();
    form.append("file", photos[mark], "photo.jpg");
    const response = await fetch("/api/mini/attachments", {
      method: "POST",
      body: form,
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string };
    if (!response.ok || !data.url) {
      throw new PhotoRejectedError(response.status);
    }
    // Замена по всему телу: так не нужно знать, как называется поле
    // фото в каждом из тридцати пяти журналов.
    serialized = serialized.split(mark).join(data.url);
  }
  const substituted = JSON.parse(serialized) as T;
  // Часть меток могла не найтись в памяти — тогда они остались
  // в теле и уехали бы в журнал строкой.
  assertNoQueuedPhotoMarks(substituted);
  return substituted;
}

export function releaseQueuedPhoto(mark: string): void {
  const value = held.get(mark);
  if (!value) return;
  URL.revokeObjectURL(value.previewUrl);
  held.delete(mark);
}
