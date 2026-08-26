import { Star } from "lucide-react";
import { AutoCarousel } from "@/components/landing/auto-carousel";
import {
  APPROVED_TESTIMONIALS,
  type Testimonial,
} from "@/content/testimonials";

/**
 * «Что говорят заведения».
 *
 * Секция не рисуется, пока нет ни одного подтверждённого отзыва —
 * см. `src/content/testimonials.ts`. Придуманные цитаты от
 * несуществующих людей на боевом лендинге неотличимы от настоящих,
 * а решение о покупке человек принимает в том числе по ним.
 */
export function TestimonialsCarousel() {
  if (APPROVED_TESTIMONIALS.length === 0) return null;

  return (
    <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6">
      <div className="mb-10 max-w-[640px]">
        <div className="mb-3 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5566f6]">
          <Star className="size-4" />
          Отзывы
        </div>
        <h2 className="text-[clamp(1.625rem,2.2vw+1rem,2.25rem)] font-semibold leading-tight tracking-[-0.02em]">
          Что говорят заведения
        </h2>
      </div>

      <AutoCarousel
        ariaLabel="Отзывы заведений"
        slideClassName="flex-[0_0_88%] md:flex-[0_0_58%] lg:flex-[0_0_46%]"
        items={APPROVED_TESTIMONIALS.map((t) => (
          <TestimonialCard key={t.id} testimonial={t} />
        ))}
      />
    </section>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const initials = testimonial.author
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <figure className="flex h-full flex-col rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-8">
      {testimonial.rating ? (
        <div
          className="flex gap-0.5 text-[#5566f6]"
          aria-label={`Оценка ${testimonial.rating} из 5`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={
                i < testimonial.rating!
                  ? "size-4 fill-current"
                  : "size-4 text-[#dcdfed]"
              }
            />
          ))}
        </div>
      ) : null}

      <blockquote className="mt-4 flex-1 text-[18px] leading-[1.55] text-[#0b1024] sm:text-[19px]">
        «{testimonial.quote}»
      </blockquote>

      <figcaption className="mt-6 flex items-center gap-3 border-t border-[#f2f3f9] pt-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-[13px] font-semibold text-[#3848c7]">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#0b1024]">
            {testimonial.author}
          </div>
          <div className="text-[13px] text-[#6f7282]">
            {testimonial.role} · {testimonial.place}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
