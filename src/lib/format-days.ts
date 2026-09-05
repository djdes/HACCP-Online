import { pluralRu } from "@/lib/plural-ru";

/** «1 день», «3 дня», «14 дней». */
export function formatDaysRu(days: number): string {
  return `${days} ${pluralRu(days, "день", "дня", "дней")}`;
}
