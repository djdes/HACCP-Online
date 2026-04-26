/**
 * Yandex.Disk REST API helper. Документация:
 *   https://yandex.ru/dev/disk/rest/
 *
 * Используется в /api/cron/yandex-backup для еженедельной выгрузки
 * JSON-дампа всех журналов в облако ресторатора. Стратегия проста:
 *   1. ensureFolder(token, "/WeSetup") — PUT /resources?path=…
 *   2. requestUploadUrl(token, path) — GET /resources/upload?path=…
 *   3. PUT этот URL с телом (raw JSON-Buffer).
 *
 * Все методы кидают исключение `YandexDiskError` с человекопонятным
 * сообщением — cron ловит и пишет в AuditLog, чтобы было что показать
 * в /settings/backup в случае «токен протух».
 */
const BASE = "https://cloud-api.yandex.net/v1/disk";

export class YandexDiskError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "YandexDiskError";
  }
}

type UploadLinkResponse = {
  href: string;
  method: string;
  templated: boolean;
};

type ErrorResponse = {
  message?: string;
  description?: string;
  error?: string;
};

async function fetchJson<T>(
  url: string,
  init: RequestInit & { token: string }
): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `OAuth ${token}`,
      Accept: "application/json",
      ...(rest.headers ?? {}),
    },
  });
  if (!res.ok) {
    let payload: ErrorResponse | null = null;
    try {
      payload = (await res.json()) as ErrorResponse;
    } catch {
      // ignore parse error
    }
    const reason =
      payload?.description ?? payload?.message ?? payload?.error ?? res.statusText;
    throw new YandexDiskError(
      `Yandex.Disk ${res.status}: ${reason}`,
      res.status
    );
  }
  // Empty body 200/201 — допустимо для PUT.
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/**
 * Создаёт папку на Я.Диске (рекурсивно — каждый сегмент пути отдельно).
 * Если папка уже есть — Я.Диск отдаёт 409, мы это глушим.
 */
export async function ensureFolder(token: string, path: string): Promise<void> {
  // Нормализуем: "/WeSetup/sub" → ["WeSetup", "sub"]
  const parts = path
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return;

  let acc = "";
  for (const part of parts) {
    acc += "/" + part;
    const url = `${BASE}/resources?path=${encodeURIComponent(acc)}`;
    try {
      await fetchJson(url, { method: "PUT", token });
    } catch (err) {
      if (err instanceof YandexDiskError && err.statusCode === 409) {
        // Папка уже существует — это нормально.
        continue;
      }
      throw err;
    }
  }
}

/**
 * Запрашивает upload-URL для PUT-загрузки файла.
 * `overwrite=true` — если файл с таким именем есть, перезаписать.
 */
export async function requestUploadUrl(
  token: string,
  path: string,
  overwrite = true
): Promise<string> {
  const url = `${BASE}/resources/upload?path=${encodeURIComponent(
    path
  )}&overwrite=${overwrite ? "true" : "false"}`;
  const data = await fetchJson<UploadLinkResponse>(url, {
    method: "GET",
    token,
  });
  if (!data.href) {
    throw new YandexDiskError("Yandex.Disk не вернул upload URL");
  }
  return data.href;
}

/**
 * Полный flow: ensureFolder + requestUploadUrl + PUT-загрузка тела.
 * Возвращает полный путь, под которым файл лежит на Я.Диске.
 */
export async function uploadJson(
  token: string,
  folder: string,
  filename: string,
  body: unknown
): Promise<{ path: string; sizeBytes: number }> {
  const folderClean =
    folder.startsWith("/") ? folder : "/" + folder;
  await ensureFolder(token, folderClean);

  const fullPath = `${folderClean.replace(/\/$/, "")}/${filename}`;
  const uploadUrl = await requestUploadUrl(token, fullPath, true);

  const json = JSON.stringify(body, null, 2);
  const buffer = Buffer.from(json, "utf-8");

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: buffer,
  });
  if (!putRes.ok) {
    throw new YandexDiskError(
      `Yandex.Disk upload PUT ${putRes.status}: ${putRes.statusText}`,
      putRes.status
    );
  }

  return { path: fullPath, sizeBytes: buffer.length };
}

/**
 * Проверка валидности токена через /disk (получаем info о пользователе).
 * Дешёвый запрос — нужен в UI «Подключить Я.Диск», чтобы сразу сказать
 * «токен невалиден» вместо ожидания первого cron-запуска.
 */
export async function pingDisk(
  token: string
): Promise<{ ok: true; userLogin?: string } | { ok: false; reason: string }> {
  try {
    const data = await fetchJson<{ user?: { login?: string } }>(`${BASE}/`, {
      method: "GET",
      token,
    });
    return { ok: true, userLogin: data.user?.login };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof YandexDiskError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Неизвестная ошибка",
    };
  }
}
