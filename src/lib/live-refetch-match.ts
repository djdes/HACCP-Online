import type { LiveEvent, LiveEventType } from "@/lib/live-events";

/**
 * Касается ли живое событие этого экрана. Чистая функция — хук
 * `use-live-refetch.ts` только оборачивает её в тротлинг.
 *
 * `reconnect` касается всех: за время разрыва могло измениться что
 * угодно. Событие `journal` без кодов (не удалось понять, какой журнал)
 * тоже считаем «про всех» — лучше лишний раз перечитать, чем показать
 * старое.
 */
export function liveEventMatches(
  event: LiveEvent,
  options: { types: LiveEventType[]; codes?: string[] }
): boolean {
  if (event.type === "reconnect") return true;
  if (!options.types.includes(event.type)) return false;
  if (event.type === "journal" && options.codes && options.codes.length > 0) {
    const raw = event.data?.codes;
    const codes = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
    if (codes.length === 0) return true;
    return codes.some((code) => options.codes!.includes(code));
  }
  return true;
}
