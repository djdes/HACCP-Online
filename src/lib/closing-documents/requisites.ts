import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { db } from "@/lib/db";

import { EMPTY_REQUISITES, type PlatformRequisites } from "./types";

/**
 * Реквизиты нашей организации и картинки подписи/печати.
 *
 * Данные — в `PlatformSetting` (JSON под одним ключом), картинки — в
 * приватном каталоге `LEGAL_DIR`. Не в `public/` (Next не отдаёт файлы,
 * появившиеся после сборки, и любой файл там публичен) и не в
 * `uploadsDir()` — тот отдаётся маршрутом без авторизации, а факсимиле
 * и печать по прямой ссылке скачиваться не должны. Локально —
 * `.data/legal` (в .gitignore); на проде — `LEGAL_DIR=/var/www/.../data/legal`,
 * рядом с хранилищем загрузок, которое деплой не трогает.
 */
const SETTING_KEY = "legal.requisites";

export const LEGAL_IMAGE_KINDS = ["facsimile", "stamp"] as const;
export type LegalImageKind = (typeof LEGAL_IMAGE_KINDS)[number];
export const LEGAL_IMAGE_MAX_BYTES = 1024 * 1024;

export function legalDir(): string {
  const fromEnv = process.env.LEGAL_DIR?.trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), ".data", "legal");
}

const str = (value: unknown): string => (typeof value === "string" ? value : "");
const strOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** Сырой JSON из базы → полная структура; недостающие поля — пустые. */
export function normalizeRequisites(raw: unknown): PlatformRequisites {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const bank = (r.bank && typeof r.bank === "object" ? r.bank : {}) as Record<string, unknown>;
  const head = (r.head && typeof r.head === "object" ? r.head : {}) as Record<string, unknown>;
  return {
    ...EMPTY_REQUISITES,
    nameFull: str(r.nameFull),
    nameShort: str(r.nameShort),
    inn: str(r.inn),
    kpp: str(r.kpp),
    ogrn: str(r.ogrn),
    address: str(r.address),
    bank: {
      name: str(bank.name),
      bik: str(bank.bik),
      account: str(bank.account),
      corrAccount: str(bank.corrAccount),
    },
    head: { post: str(head.post), name: str(head.name) },
    vatMode: "none",
    email: str(r.email),
    phone: str(r.phone),
    facsimileFile: strOrNull(r.facsimileFile),
    stampFile: strOrNull(r.stampFile),
    updatedAt: strOrNull(r.updatedAt),
  };
}

export async function readPlatformRequisites(): Promise<PlatformRequisites> {
  const row = await db.platformSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return { ...EMPTY_REQUISITES };
  try {
    return normalizeRequisites(JSON.parse(row.value));
  } catch {
    return { ...EMPTY_REQUISITES };
  }
}

export async function writePlatformRequisites(
  next: Omit<PlatformRequisites, "updatedAt">
): Promise<PlatformRequisites> {
  const value: PlatformRequisites = {
    ...normalizeRequisites(next),
    updatedAt: new Date().toISOString(),
  };
  await db.platformSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(value) },
    update: { value: JSON.stringify(value) },
  });
  return value;
}

/** PNG начинается с восьми фиксированных байт — этого хватает, чтобы не принять .exe с расширением .png. */
export function isPng(bytes: Buffer): boolean {
  return (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function fileFor(kind: LegalImageKind): string {
  return `${kind}.png`;
}

export async function saveLegalImage(kind: LegalImageKind, bytes: Buffer): Promise<PlatformRequisites> {
  const dir = legalDir();
  await mkdir(dir, { recursive: true });
  const name = fileFor(kind);
  await writeFile(path.join(dir, name), bytes);
  const current = await readPlatformRequisites();
  return writePlatformRequisites({
    ...current,
    [kind === "facsimile" ? "facsimileFile" : "stampFile"]: name,
  });
}

export async function readLegalImage(
  kind: LegalImageKind,
  requisites?: PlatformRequisites
): Promise<Buffer | null> {
  const r = requisites ?? (await readPlatformRequisites());
  const name = kind === "facsimile" ? r.facsimileFile : r.stampFile;
  // Имя из базы, но каталог наш: basename отсекает любые попытки уйти
  // из каталога, если базу когда-нибудь поправят руками.
  if (!name || path.basename(name) !== name) return null;
  try {
    return await readFile(path.join(legalDir(), name));
  } catch {
    return null;
  }
}
