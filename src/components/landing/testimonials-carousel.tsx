import { Star } from "lucide-react";
import { AutoCarousel } from "@/components/landing/auto-carousel";
import type { PublicReview } from "@/lib/balance/review-view";

/**
 * «Что говорят заведения».
 *
 * Одна крупная карточка по центру, соседние сильно приглушены и
 * обрезаны краем экрана, стрелки — круглыми кнопками поверх них.
 * Отзыв читают целиком, а не сравнивают три штуки одновременно,
 * поэтому центральной отдана вся ширина, какую можно.
 *
 * Раньше здесь лежали иллюстративные реплики из `content/testimonials.ts`
 * с оговоркой «это не слова конкретных клиентов». Теперь секция
 * показывает настоящие отзывы: клиент пишет его в кабинете, ROOT
 * одобряет, за это начисляются баллы. Нет одобренных отзывов — секции
 * нет вовсе, выдуманные реплики не нужны.
 */
export function TestimonialsCarousel({ reviews }: { reviews: PublicReview[] }) {
  if (reviews.length === 0) return null;

  return (
    <section className="pb-20 pt-4">
      {/* Заголовок по центру: секция во всю ширину, и левое
          выравнивание оторвало бы его от карусели под ним. */}
      <div className="mx-auto mb-10 max-w-[820px] px-4 text-center sm:px-6">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9b9fb3]">
          Что говорят заведения
        </div>
        <h2 className="mt-3 text-[clamp(1.75rem,3vw+1rem,3rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-[#0b1024]">
          Бумагу закрыли —{" "}
          <span className="text-[#5566f6]">к проверке готовы</span>
        </h2>
      </div>

      <AutoCarousel
        ariaLabel="Отзывы заведений"
        arrows="overlay"
        gapClassName="gap-3 sm:gap-8"
        slideClassName="flex-[0_0_90%] sm:flex-[0_0_62%] lg:flex-[0_0_46%]"
        autoplayMs={7000}
        items={reviews.map((review) => (
          <TestimonialCard key={review.id} review={review} />
        ))}
      />
    </section>
  );
}

function TestimonialCard({ review }: { review: PublicReview }) {
  const initials = review.author
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <figure className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_20px_50px_-30px_rgba(11,16,36,0.25),0_0_0_1px_rgba(240,240,250,0.7)] sm:p-10">
      {/* Кавычка-подложка: крупный декоративный знак за текстом —
          он даёт карточке узнаваемый силуэт и отделяет цитату от
          обычного абзаца. aria-hidden, читалке его знать незачем. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-6 top-12 select-none font-serif text-[140px] leading-none text-[#5566f6]/[0.06] sm:left-9 sm:top-14"
      >
        «
      </span>

      {review.rating ? (
        <div
          className="relative flex gap-1 text-[#5566f6]"
          aria-label={`Оценка ${review.rating} из 5`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={
                i < (review.rating ?? 0)
                  ? "size-[18px] fill-current"
                  : "size-[18px] text-[#dcdfed]"
              }
            />
          ))}
        </div>
      ) : null}

      {/* Вложение показываем до цитаты: фото кухни или короткое видео
          убеждает сильнее текста, ради него и платим больше. */}
      {review.mediaUrl && review.mediaKind === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={review.mediaUrl}
          alt=""
          loading="lazy"
          className="relative mt-5 max-h-[220px] w-full rounded-2xl object-cover"
        />
      ) : null}
      {review.mediaUrl && review.mediaKind === "video" ? (
        <video
          controls
          preload="metadata"
          src={review.mediaUrl}
          className="relative mt-5 max-h-[240px] w-full rounded-2xl bg-black"
        />
      ) : null}

      <blockquote className="relative mt-5 flex-1 text-[18px] leading-[1.5] tracking-[-0.01em] text-[#0b1024] sm:mt-6 sm:text-[23px]">
        {review.quote}
      </blockquote>

      <figcaption className="relative mt-6 flex items-center gap-3 sm:mt-8 sm:gap-3.5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-[14px] font-semibold text-[#3848c7] ring-1 ring-[#5566f6]/15">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-[#0b1024]">
            {review.author}
          </div>
          <div className="text-[13px] text-[#6f7282]">{review.place}</div>
        </div>
      </figcaption>
    </figure>
  );
}
