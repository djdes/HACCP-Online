import { AutoCarousel } from "@/components/landing/auto-carousel";
import {
  AUDIENCE_STORIES,
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
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="grid grid-cols-[112px_1fr] items-stretch gap-4 border-b border-[#f2f3f9] p-4 sm:grid-cols-[136px_1fr] sm:p-5">
        {story.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={story.photo}
            alt=""
            className="aspect-[4/3] w-full rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          // Заглушка вместо фотографии: снимков заведений в проекте
          // пока нет, а случайные стоковые в коммерческий лендинг без
          // проверенной лицензии класть нельзя.
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#eef1ff] to-[#f5f6ff] text-[#5566f6]">
            <Icon className="size-8" />
          </div>
        )}
        <div className="flex min-w-0 flex-col justify-center">
          <div className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
            {story.title}
          </div>
          <div className="mt-1.5 text-[13px] leading-snug text-[#3848c7]">
            {story.result}
          </div>
        </div>
      </div>

      <dl className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
            Было
          </dt>
          <dd className="mt-1 text-[13px] leading-[1.55] text-[#6f7282]">
            {story.before}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#3848c7]">
            Стало
          </dt>
          <dd className="mt-1 text-[13px] leading-[1.55] text-[#3c4053]">
            {story.after}
          </dd>
        </div>
      </dl>
    </article>
  );
}
