/**
 * «Вернуть как было» после выключения автозаполнения.
 *
 * Автозаполнение пишет только в ПУСТЫЕ клетки, но следа за собой не
 * оставляло: выключив тумблер, человек оставался с журналом, в котором
 * стоят отметки, которые он не ставил, и убрать их можно было только
 * руками по одной.
 *
 * Поэтому каждый автоматический прогон (ночной крон и догон при
 * включении) снимает снимок ДО и записывает в `JournalDocument.config`
 * ключ `autoFillUndo`: какие строки появились и какие клетки изменились
 * (с прежним значением). Выключение тумблера с галочкой «убрать
 * заполненное» проигрывает это в обратную сторону.
 *
 * Ручное «Закрыть день» в лог НЕ попадает: человек сделал это сам и
 * ждёт, что запись останется.
 *
 * Размер лога ограничен: журнал на месяц с ростером в 30 человек даёт
 * ~900 строк, поэтому берём с запасом и дальше просто перестаём
 * накапливать (что не попало в лог — остаётся в журнале).
 */
import type { Prisma, PrismaClient } from "@prisma/client";

/** Клиент Prisma в объёме, который нужен логу (тот же приём, что в движке). */
type UndoDb = Pick<PrismaClient, "journalDocumentEntry" | "journalDocument">;

export const AUTO_FILL_UNDO_KEY = "autoFillUndo";

const MAX_CREATED = 4000;
const MAX_CHANGED = 3000;

export type AutoFillUndoLog = {
  /** Когда дописывали лог последний раз. */
  at: string;
  /** Строки, созданные автозаполнением, — при откате удаляем. */
  createdEntryIds: string[];
  /** Клетки, которые автозаполнение изменило, — при откате возвращаем `data`. */
  changedEntries: { id: string; data: unknown }[];
  /** Для журнала уборки (заполняется не строками, а матрицей в config). */
  prevMatrix?: unknown;
};

export type AutoFillSnapshot = {
  /** id → JSON прежнего `data`; по нему считаем «создано» и «изменено». */
  entries: Map<string, string>;
  prevMatrix?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readAutoFillUndo(config: unknown): AutoFillUndoLog | null {
  if (!isRecord(config)) return null;
  const raw = config[AUTO_FILL_UNDO_KEY];
  if (!isRecord(raw)) return null;
  const createdEntryIds = Array.isArray(raw.createdEntryIds)
    ? raw.createdEntryIds.filter((id): id is string => typeof id === "string")
    : [];
  const changedEntries = Array.isArray(raw.changedEntries)
    ? raw.changedEntries
        .filter(isRecord)
        .filter((row): row is { id: string; data: unknown } => typeof row.id === "string")
        .map((row) => ({ id: row.id, data: row.data }))
    : [];
  if (createdEntryIds.length === 0 && changedEntries.length === 0 && raw.prevMatrix === undefined) {
    return null;
  }
  return {
    at: typeof raw.at === "string" ? raw.at : "",
    createdEntryIds,
    changedEntries,
    prevMatrix: raw.prevMatrix,
  };
}

/** Снимок ДО прогона: строки документа за нужные дни и матрица уборки. */
export async function snapshotBeforeAutoFill(
  db: UndoDb,
  params: { documentId: string; dateKeys: string[]; config: unknown }
): Promise<AutoFillSnapshot> {
  const dates = params.dateKeys.map((key) => new Date(`${key}T00:00:00.000Z`));
  const rows = await db.journalDocumentEntry.findMany({
    where: { documentId: params.documentId, date: { in: dates } },
    select: { id: true, data: true },
  });
  const entries = new Map<string, string>();
  for (const row of rows) entries.set(row.id, JSON.stringify(row.data ?? null));
  const config = isRecord(params.config) ? params.config : null;
  return {
    entries,
    prevMatrix: config ? config.matrix : undefined,
  };
}

/**
 * Дописать лог после прогона. Возвращает число записанных пунктов —
 * ноль означает, что автозаполнению нечего было делать.
 */
export async function recordAutoFillUndo(
  db: UndoDb,
  params: {
    documentId: string;
    dateKeys: string[];
    before: AutoFillSnapshot;
    /** Конфиг документа ПОСЛЕ прогона — из него берём накопленный лог. */
    configAfter: unknown;
  }
): Promise<number> {
  const dates = params.dateKeys.map((key) => new Date(`${key}T00:00:00.000Z`));
  const rows = await db.journalDocumentEntry.findMany({
    where: { documentId: params.documentId, date: { in: dates } },
    select: { id: true, data: true },
  });

  const createdEntryIds: string[] = [];
  const changedEntries: { id: string; data: unknown }[] = [];
  for (const row of rows) {
    const before = params.before.entries.get(row.id);
    if (before === undefined) {
      createdEntryIds.push(row.id);
      continue;
    }
    if (before !== JSON.stringify(row.data ?? null)) {
      changedEntries.push({ id: row.id, data: JSON.parse(before) as unknown });
    }
  }

  const config = isRecord(params.configAfter) ? { ...params.configAfter } : {};
  const previous = readAutoFillUndo(config);
  const matrixChanged =
    params.before.prevMatrix !== undefined &&
    JSON.stringify(params.before.prevMatrix) !== JSON.stringify(config.matrix);

  if (createdEntryIds.length === 0 && changedEntries.length === 0 && !matrixChanged) {
    return 0;
  }

  // Прежний лог сохраняем: откат должен вернуть журнал к состоянию до
  // ПЕРВОГО автоматического прогона, а не только до последней ночи.
  const mergedCreated = [
    ...new Set([...(previous?.createdEntryIds ?? []), ...createdEntryIds]),
  ].slice(0, MAX_CREATED);
  const seen = new Set((previous?.changedEntries ?? []).map((row) => row.id));
  const mergedChanged = [
    ...(previous?.changedEntries ?? []),
    ...changedEntries.filter((row) => !seen.has(row.id)),
  ].slice(0, MAX_CHANGED);

  const log: AutoFillUndoLog = {
    at: new Date().toISOString(),
    createdEntryIds: mergedCreated,
    changedEntries: mergedChanged,
    // Матрицу помним ту, что была ДО первого прогона.
    ...(previous?.prevMatrix !== undefined
      ? { prevMatrix: previous.prevMatrix }
      : matrixChanged
        ? { prevMatrix: params.before.prevMatrix }
        : {}),
  };

  await db.journalDocument.update({
    where: { id: params.documentId },
    data: {
      config: { ...config, [AUTO_FILL_UNDO_KEY]: log } as unknown as Prisma.InputJsonValue,
    },
  });
  return mergedCreated.length + mergedChanged.length;
}

/** Откатить всё, что записало автозаполнение, и стереть лог. */
export async function revertAutoFill(
  db: UndoDb,
  params: { documentId: string; config: unknown }
): Promise<{ removed: number; restored: number }> {
  const log = readAutoFillUndo(params.config);
  if (!log) return { removed: 0, restored: 0 };

  let removed = 0;
  if (log.createdEntryIds.length > 0) {
    const result = await db.journalDocumentEntry.deleteMany({
      where: { id: { in: log.createdEntryIds }, documentId: params.documentId },
    });
    removed = result.count;
  }

  let restored = 0;
  for (const row of log.changedEntries) {
    await db.journalDocumentEntry
      .update({
        where: { id: row.id },
        data: { data: (row.data ?? {}) as Prisma.InputJsonValue },
      })
      .then(() => {
        restored += 1;
      })
      .catch(() => {
        // Строку уже удалили руками — тогда и возвращать нечего.
      });
  }

  const config = isRecord(params.config) ? { ...params.config } : {};
  delete config[AUTO_FILL_UNDO_KEY];
  if (log.prevMatrix !== undefined) config.matrix = log.prevMatrix;

  await db.journalDocument.update({
    where: { id: params.documentId },
    data: { config: config as unknown as Prisma.InputJsonValue },
  });

  return { removed, restored };
}
