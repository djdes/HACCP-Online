/**
 * Клиентский маппер: помещение справочника → RoomEditorInitial.
 * Без импорта db — используется в клиентах журналов (климат, график
 * ген. уборок), которые получают `buildings` с сервера.
 */
import type { DirectoryRoom } from "@/lib/room-directory";
import type { RoomEditorInitial } from "@/components/cleaning/room-editor-dialog";
import { normalizeClimateRoomNorms } from "@/lib/climate-document";

type ScopeInput = Array<string | { label: string; requirePhoto?: boolean }>;

function scopeInput(raw: unknown): ScopeInput {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (s): s is string | { label: string; requirePhoto?: boolean } =>
      typeof s === "string" ||
      (!!s && typeof s === "object" && typeof (s as { label?: unknown }).label === "string"),
  );
}

export function directoryRoomToEditorInitial(room: DirectoryRoom): RoomEditorInitial {
  return {
    id: room.id,
    name: room.name,
    kind: room.kind,
    detergent: room.detergent ?? "",
    currentScope: scopeInput(room.currentScope),
    generalScope: scopeInput(room.generalScope),
    currentDays: room.currentDays,
    generalDays: room.generalDays,
    currentScheduleType: room.currentScheduleType,
    generalScheduleType: room.generalScheduleType,
    currentMonthDays: room.currentMonthDays,
    generalMonthDays: room.generalMonthDays,
    requirePhoto: room.requirePhoto,
    cleanerUserIds: room.cleanerUserIds,
    verifierUserIds: room.verifierUserIds,
    climateNorms: normalizeClimateRoomNorms(room.climateNorms),
  };
}
