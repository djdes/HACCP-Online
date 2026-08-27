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
      items={AUDIENCE_STORIES.map((s) => (
        <AudienceCard key={s.id} story={s} />
      ))}
    />
  );
}

function AudienceCard({ story }: { story: AudienceStory }) {
  const Icon = story.icon;
  return (
    <article className="grid h-full grid-cols-[88px_1fr] gap-3 overflow-hidden rounded-3xl border border-[#ececf4] bg-white p-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:grid-cols-[104px_1fr] sm:gap-4 sm:p-5">
      {/* Фото узкой колонкой слева и во всю высоту карточки: снимок
          здесь — опознавательный знак «это про меня», а место нужно
          тексту «было / стало». */}
      {story.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.photo}
          alt=""
          className="h-full w-full rounded-2xl object-cover"
          loading="lazy"
        />
      ) : (
        // Заглушка вместо фотографии: снимков заведений в проекте пока
        // нет, а случайные стоковые в коммерческий лендинг без
        // проверенной лицензии класть нельзя.
        <div className="flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#eef1ff] to-[#f5f6ff] text-[#5566f6]">
          <Icon className="size-7" />
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
            {story.title}
          </span>
          <span
            className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              story.automation === "auto"
                ? "bg-[#ecfdf5] text-[#116b2a]"
                : "bg-[#f5f6ff] text-[#3848c7]"
            }`}
          >
            {AUTOMATION_LABEL[story.automation]}
          </span>
        </div>
        <div className="mt-1 text-[13px] leading-snug text-[#3848c7]">
          {story.result}
        </div>

        <dl className="mt-3 space-y-2.5 border-t border-[#f2f3f9] pt-3">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
              Было
            </dt>
            <dd className="mt-0.5 text-[13px] leading-[1.5] text-[#6f7282]">
              {story.before}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#3848c7]">
              Стало
            </dt>
            <dd className="mt-0.5 text-[13px] leading-[1.5] text-[#3c4053]">
              {story.after}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
