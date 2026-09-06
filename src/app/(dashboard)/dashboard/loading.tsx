import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

/**
 * Skeleton дашборда. Повторяет структуру `/dashboard`: секция
 * «Обязательные журналы» (сетка карточек-превью с иконкой и строкой
 * названия), плитки быстрых действий, таблица последних записей.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загружаем дашборд…</span>

      <div className="overflow-hidden rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <Skeleton className="size-10 shrink-0 rounded-2xl" />
          <Skeleton className="h-4 w-52 rounded-lg" />
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-[#ececf4] p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-2xl border border-[#ececf4]"
            >
              <Skeleton className="aspect-[1228/862] w-full rounded-none" />
              <div className="flex items-center gap-2.5 p-3">
                <Skeleton className="size-7 shrink-0 rounded-lg" />
                <Skeleton className="h-3.5 w-full rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-4"
          >
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-2/3 rounded-lg" />
              <Skeleton className="h-3 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      <SkeletonTable rows={8} columns={6} />
    </div>
  );
}
