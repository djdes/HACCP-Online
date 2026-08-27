import { AutoCarousel } from "@/components/landing/auto-carousel";
import {
  AUDIENCE_STORIES,
  AUTOMATION_LABEL,
  type AudienceStory,
} from "@/content/audience-stories";

/**
 * «Подходит для» — карусель типов заведений.
 *
 * Раньше секция была рядом слов-чипов: она отвечала на вопрос «кому
 * продают», но не на вопрос «что у меня изменится». Каждая карточка
 * теперь показывает пару «было / стало» — это единственное, ради чего
 * посетитель вообще читает такой список.
 */
export function AudienceCarousel() {
  return (
    <AutoCarousel
      ariaLabel="Типы заведений"
      arrows="overlay"
      gapClassName="gap-4 sm:gap-6"
      // Три карточки в кадре, активная — средняя. Соседние обрезаны
      // краем экрана: видно, что ряд продолжается в обе стороны.
      slideClassName="flex-[0_0_90%] sm:flex-[0_0_52%] lg:flex-[0_0_34%]"
      items={AUDIENCE_STORIES.map((s) => (
        <AudienceCard key={s.id} story={s} />
      ))}
    />
  );
}

function AudienceCard({ story }: { story: AudienceStory }) {
  const Icon = story.icon;

  return (
    <article className="flex h-full flex-col rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_20px_50px_-30px_rgba(11,16,36,0.2),0_0_0_1px_rgba(240,240,250,0.7)] sm:p-7">
      {/* Шапка: круглая иконка слева, название справа. Раньше здесь
          была узкая колонка-плашка во всю высоту карточки — она
          съедала место и ничего не добавляла. Кружок читается как
          аватар заведения и занимает одну строку. */}
      <div className="flex items-center gap-3.5">
        {story.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.photo}
            alt=""
            loading="lazy"
            className="size-12 shrink-0 rounded-full object-cover ring-1 ring-[#5566f6]/15"
          />
        ) : (
          // Заглушка вместо фотографии: снимков заведений пока нет, а
          // случайные стоковые в коммерческий лендинг без проверенной
          // лицензии класть нельзя.
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-[#5566f6] ring-1 ring-[#5566f6]/15">
            <Icon className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[19px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
            {story.title}
          </span>
          <span
            className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${
              story.automation === "auto"
                ? "bg-[#ecfdf5] text-[#116b2a]"
                : "bg-[#f5f6ff] text-[#3848c7]"
            }`}
          >
            {AUTOMATION_LABEL[story.automation]}
          </span>
        </div>
      </div>

      <div className="mt-3 text-[15px] font-medium leading-snug text-[#3848c7]">
        {story.result}
      </div>

      <dl className="mt-5 space-y-3.5 border-t border-[#f2f3f9] pt-5">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
            Было
          </dt>
          <dd className="mt-1 text-[15px] leading-[1.55] text-[#6f7282]">
            {story.before}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3848c7]">
            Стало
          </dt>
          <dd className="mt-1 text-[15px] leading-[1.55] text-[#3c4053]">
            {story.after}
          </dd>
        </div>
      </dl>
    </article>
  );
}
