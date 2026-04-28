/**
 * Skeleton-плейсхолдер для /mini/home, пока fetch /api/mini/home в полёте.
 *
 * Структура зеркалит реальную страницу:
 *  - eyebrow + display-имя в hero,
 *  - progress-ring + двух статов справа,
 *  - 3 карточки журналов (типичный сценарий «утренний дайджест»).
 *
 * Используется только когда сессия `authenticated` и payload ещё не
 * пришёл — anonymous-визитёры всё так же видят landing-CTA, а не
 * скелетон. Мерцание сделано через CSS-анимацию `pulse`.
 */
export function MiniHomeSkeleton() {
  return (
    <div
      className="flex flex-1 flex-col gap-5 pb-28"
      role="status"
      aria-label="Загружаем кабинет"
      data-testid="mini-home-skeleton"
    >
      {/* Hero block — eyebrow, display-имя, progress, две статистики */}
      <header className="relative">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <SkeletonBar width="55%" height={12} />
            <SkeletonBar width="65%" height={36} />
            <SkeletonBar width="40%" height={12} />
          </div>
          <SkeletonCircle size={44} />
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-4">
          <div className="space-y-3">
            <SkeletonBar width="80%" height={28} />
            <SkeletonBar width="60%" height={20} />
          </div>
          <SkeletonCircle size={88} />
        </div>
      </header>

      {/* «Сегодня» — карточки журналов на сегодня */}
      <section className="space-y-2.5">
        <SkeletonBar width="35%" height={12} />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </section>
    </div>
  );
}

function SkeletonBar({
  width,
  height,
}: {
  width: number | string;
  height: number;
}) {
  return (
    <div
      className="mini-skeleton-bar"
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: `${height}px`,
        borderRadius: Math.max(6, Math.min(height / 2, 14)),
      }}
    />
  );
}

function SkeletonCircle({ size }: { size: number }) {
  return (
    <div
      className="mini-skeleton-bar"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        flex: "none",
      }}
    />
  );
}

function SkeletonCard() {
  return (
    <div
      className="mini-skeleton-bar"
      style={{
        width: "100%",
        height: "84px",
        borderRadius: "20px",
      }}
    />
  );
}
