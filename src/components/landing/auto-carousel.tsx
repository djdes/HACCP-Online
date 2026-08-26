"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Автолистающаяся карусель лендинга.
 *
 * Общая для «Подходит для» и «Что говорят заведения» — двух секций с
 * разными карточками, но одинаковым поведением: листает сама, замирает
 * под курсором и после первого касания стрелок или свайпа больше не
 * дёргает страницу под руками у читателя.
 *
 * Боковые слайды приглушены (`scale-95 opacity-60`): так видно, что
 * ряд продолжается, и глаз всё равно держится за центральный.
 *
 * `prefers-reduced-motion` выключает автоплей полностью — листать
 * можно, но само ничего не поедет.
 */
export function AutoCarousel({
  items,
  ariaLabel,
  slideClassName = "flex-[0_0_86%] sm:flex-[0_0_52%] lg:flex-[0_0_34%]",
  autoplayMs = 5000,
}: {
  items: React.ReactNode[];
  ariaLabel: string;
  /** Ширина слайда. По умолчанию — 1 с подглядыванием на телефоне, 3 на десктопе. */
  slideClassName?: string;
  autoplayMs?: number;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", containScroll: false },
    [
      Autoplay({
        delay: autoplayMs,
        stopOnInteraction: true,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
      }),
    ],
  );

  const [selected, setSelected] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);

    // Уважение к системной настройке: плагин уже подключён, поэтому
    // просто останавливаем его, а не пересобираем карусель.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const autoplay = emblaApi.plugins().autoplay;
      autoplay?.stop();
    }

    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (i: number) => emblaApi?.scrollTo(i),
    [emblaApi],
  );

  return (
    <div className="relative" role="region" aria-roledescription="карусель" aria-label={ariaLabel}>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 sm:gap-5">
          {items.map((item, i) => (
            <div
              key={i}
              className={`${slideClassName} min-w-0 transition-[transform,opacity] duration-300 ease-out ${
                i === selected
                  ? "scale-100 opacity-100"
                  : "scale-95 opacity-60"
              }`}
              aria-roledescription="слайд"
              aria-label={`${i + 1} из ${items.length}`}
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-4">
        <CarouselArrow direction="prev" onClick={scrollPrev} />

        {/* Точки-пилюли: активная растягивается, поэтому позиция в
            ряду читается боковым зрением, без пересчёта кружков. */}
        <div className="flex items-center gap-1.5">
          {snaps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Показать ${i + 1}`}
              aria-current={i === selected}
              className={`h-2 rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5566f6]/40 ${
                i === selected
                  ? "w-6 bg-[#5566f6]"
                  : "w-2 bg-[#dcdfed] hover:bg-[#9b9fb3]"
              }`}
            />
          ))}
        </div>

        <CarouselArrow direction="next" onClick={scrollNext} />
      </div>
    </div>
  );
}

function CarouselArrow({
  direction,
  onClick,
}: {
  direction: "prev" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Предыдущий" : "Следующий"}
      className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#dcdfed] bg-white text-[#3c4053] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] hover:text-[#3848c7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
    >
      <Icon className="size-4" />
    </button>
  );
}
