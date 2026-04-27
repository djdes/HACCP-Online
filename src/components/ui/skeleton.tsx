import { cn } from "@/lib/utils";

/**
 * D2 — `<Skeleton>` для loading-state'ов. Лёгкий placeholder'ный
 * блок с pulse-анимацией. Используется в Mini App и dashboard
 * на местах где данные грузятся (Suspense fallback).
 *
 * Пример:
 *   <Suspense fallback={<JournalListSkeleton />}>
 *     <JournalList />
 *   </Suspense>
 *
 *   function JournalListSkeleton() {
 *     return (
 *       <div className="space-y-2">
 *         {Array.from({ length: 5 }).map((_, i) => (
 *           <Skeleton key={i} className="h-16 w-full rounded-2xl" />
 *         ))}
 *       </div>
 *     );
 *   }
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[#ececf4] dark:bg-[#1e2030]",
        className
      )}
      {...props}
    />
  );
}
