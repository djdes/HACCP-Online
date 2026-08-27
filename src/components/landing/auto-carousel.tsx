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
 * Боковые слайды приглушены и чуть уменьшены: так видно, что
 * ряд продолжается, и глаз всё равно держится за центральный.
 *
 * `prefers-reduced-motion` выключает автоплей полностью — листать
 * можно, но само ничего не поедет.
 */
export function AutoCarousel({
  items,
  ariaLabel,
  slideClassName = "flex-[0_0_82%] sm:flex-[0_0_44%] lg:flex-[0_0_30%] xl:flex-[0_0_24%]",
  autoplayMs = 5000,
  arrows = "below",
  gapClassName = "gap-4 sm:gap-5",
  dimSides = true,
  align = "center",
}: {
  items: React.ReactNode[];
  ariaLabel: string;
  /** Ширина слайда. По умолчанию — 1 с подглядыванием на телефоне, 3 на десктопе. */
  slideClassName?: string;
  autoplayMs?: number;
  /**
   * Где стрелки. "overlay" — круглые кнопки поверх боковых слайдов,
   * по вертикали посередине: так они не отъедают высоту и читаются
   * как «листать», а не как отдельный блок управления.
   */
  arrows?: "below" | "overlay";
  gapClassName?: string;
  /** Приглушать ли боковые слайды. */
  dimSides?: boolean;
  /**
   * Какой слайд считается активным. "center" — тот, что посередине
   * (одна крупная карточка, как в отзывах). "start" — первый видимый
   * слева, остальные идут за ним рядом обычным рядом.
   */
  align?: "center" | "start";
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align, containScroll: false },
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
      {/* Вертикальный запас под тени карточек: без него overflow окна
          срезает их ровной линией, и при свайпе за карточкой едет
          серая полоса. */}
      <div className="overflow-hidden py-6 sm:py-8" ref={emblaRef}>
        <div className={`flex items-stretch ${gapClassName}`}>
          {items.map((item, i) => (
            <div
              key={i}
              className={`${slideClassName} min-w-0`}
              aria-roledescription="слайд"
              aria-label={`${i + 1} из ${items.length}`}
            >
              {/* Увеличение активного слайда живёт на ВНУТРЕННЕМ элементе.
                  На самом слайде его быть не может: в режиме loop Embla
                  двигает слайды собственным transform, и класс scale-*
                  на том же узле его затирал — карточки наезжали друг на
                  друга посреди ряда. */}
              <div
                /* Уменьшение и приглушение — только с sm. На телефоне
                   соседний слайд ужимался прямо во время свайпа и
                   «раздувался» при посадке: контент дёргался и читался
                   как съезжающий. Там слайды одинаковые, листается
                   пальцем, позицию показывают точки. */
                className={`h-full transition-[transform,opacity] duration-300 ease-out ${
                  i === selected
                    ? "scale-100 opacity-100"
                    : dimSides
                      ? "scale-100 opacity-100 sm:scale-[0.93] sm:opacity-40"
                      : "scale-100 opacity-100 sm:scale-[0.97] sm:opacity-90"
                }`}
              >
                {item}
              </div>
            </div>
          ))}
        </div>
      </div>

      {arrows === "overlay" ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 hidden items-center sm:left-6 sm:flex">
            <span className="pointer-events-auto">
              <CarouselArrow direction="prev" onClick={scrollPrev} big />
            </span>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden items-center sm:right-6 sm:flex">
            <span className="pointer-events-auto">
              <CarouselArrow direction="next" onClick={scrollNext} big />
            </span>
          </div>
        </>
      ) : null}

      <div className="mt-6 flex items-center justify-center gap-4">
        {arrows === "below" ? (
          <CarouselArrow direction="prev" onClick={scrollPrev} />
        ) : null}

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

        {arrows === "below" ? (
          <CarouselArrow direction="next" onClick={scrollNext} />
        ) : null}
      </div>
    </div>
  );
}

function CarouselArrow({
  direction,
  onClick,
  big,
}: {
  direction: "prev" | "next";
  onClick: () => void;
  /** Крупная кнопка для режима overlay — её кладут поверх карточек. */
  big?: boolean;
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "prev" ? "Предыдущий" : "Следующий"}
      className={`flex shrink-0 items-center justify-center rounded-full border border-[#ececf4] bg-white text-[#3c4053] transition-all hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] hover:text-[#3848c7] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 ${
        big
          ? "size-12 shadow-[0_10px_30px_-10px_rgba(11,16,36,0.25)] hover:scale-105"
          : "size-10"
      }`}
    >
      <Icon className={big ? "size-5" : "size-4"} />
    </button>
  );
}
