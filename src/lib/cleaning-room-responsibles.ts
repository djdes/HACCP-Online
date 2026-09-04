/**
 * Уборщики и проверяющие помещения (2026-09-04).
 *
 * `Room.cleanerUserIds` / `Room.verifierUserIds` — единственное место,
 * где помещение закрепляется за сотрудниками (/settings/buildings и та
 * же карточка из журнала). Документ журнала уборки хранит только
 * per-document данные: какие комнаты участвуют (`selectedRoomIds`),
 * общий пул (`selectedCleanerUserIds`) и режим race.
 *
 * Слияние происходит здесь, в одной чистой функции, и результат —
 * «эффективный» конфиг — используется всеми читателями (TF-адаптер,
 * cell-override sync, PDF, клиент). Эффективный конфиг НИКОГДА не
 * сохраняется в БД: клиент держит raw config для PATCH и считает
 * эффективный только для отображения.
 *
 * Приоритет уборщиков комнаты:
 *   1. Room.cleanerUserIds (если непусто) — DB wins.
 *   2. legacy config.cleanerByRoomId (документы до 2026-09-04).
 *   3. пул: race → все, иначе round-robin (см. resolveRoomCleaners).
 *
 * Пул расширяется уборщиками комнат (raw пул первым, потом новые в
 * порядке selectedRoomIds), чтобы коды С1..СN оставались стабильными.
 */
import type { CleaningDocumentConfig } from "@/lib/cleaning-document";

export type RoomResponsibles = {
  id: string;
  cleanerUserIds: string[];
  verifierUserIds: string[];
};

export type RoomResponsibleRole = "cleaner" | "verifier";

type MergeableConfig = Pick<
  CleaningDocumentConfig,
  | "selectedRoomIds"
  | "selectedCleanerUserIds"
  | "cleanerByRoomId"
  | "verifierByRoomId"
>;

function cleanIds(
  raw: unknown,
  knownUserIds: Set<string> | undefined,
): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of raw) {
    if (typeof id !== "string" || id.length === 0) continue;
    if (knownUserIds && !knownUserIds.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Возвращает НОВЫЙ конфиг с подмешанными назначениями комнат.
 * Вход не мутируется. Вызывать ПОСЛЕ normalizeCleaningDocumentConfig —
 * нормализатор отбрасывает закрепления вне raw-пула, а здесь пул уже
 * расширен.
 *
 * @param knownUserIds — активные сотрудники организации; id вне набора
 *   отбрасываются (уволенные/архивные). Если не передан — не фильтруем.
 */
export function applyRoomResponsiblesToConfig<T extends MergeableConfig>(
  config: T,
  rooms: ReadonlyArray<RoomResponsibles>,
  knownUserIds?: Set<string>,
): T {
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const pool = [...(config.selectedCleanerUserIds ?? [])];
  const poolSet = new Set(pool);
  const cleanerByRoomId: Record<string, string[]> = {
    ...(config.cleanerByRoomId ?? {}),
  };
  const verifierByRoomId: Record<string, string[]> = {
    ...(config.verifierByRoomId ?? {}),
  };

  for (const roomId of config.selectedRoomIds ?? []) {
    const room = roomById.get(roomId);
    if (!room) continue;
    const cleaners = cleanIds(room.cleanerUserIds, knownUserIds);
    if (cleaners.length > 0) {
      cleanerByRoomId[roomId] = cleaners;
      for (const uid of cleaners) {
        if (poolSet.has(uid)) continue;
        poolSet.add(uid);
        pool.push(uid);
      }
    }
    const verifiers = cleanIds(room.verifierUserIds, knownUserIds);
    if (verifiers.length > 0) {
      verifierByRoomId[roomId] = verifiers;
    }
  }

  return {
    ...config,
    selectedCleanerUserIds: pool,
    cleanerByRoomId,
    verifierByRoomId,
  };
}

/** Сколько помещений закреплено за каждым сотрудником в роли. */
export function countRoomsPerUser(
  rooms: ReadonlyArray<RoomResponsibles>,
  role: RoomResponsibleRole,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const room of rooms) {
    const ids = role === "cleaner" ? room.cleanerUserIds : room.verifierUserIds;
    for (const uid of new Set(ids)) {
      out.set(uid, (out.get(uid) ?? 0) + 1);
    }
  }
  return out;
}

/**
 * Приводит unknown (Prisma String[] или что-то из props) к string[].
 * Удобно на границах: страница → клиент, скрипты.
 */
export function toUserIdList(raw: unknown): string[] {
  return cleanIds(raw, undefined);
}
