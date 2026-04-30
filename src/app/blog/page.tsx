import Link from "next/link";
import { ArrowRight, Clock, NotebookText, Search } from "lucide-react";
import { db } from "@/lib/db";
import { PublicHeader, PublicFooter } from "@/components/public/public-chrome";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Блог — электронные журналы ХАССП и СанПиН",
  description:
    "Статьи об электронных журналах, СанПиН, ХАССП и подготовке к проверкам Роспотребнадзора.",
  // Canonical всегда без query-string — иначе /blog?q=test и /blog?tag=haccp
  // индексируются Google как отдельные страницы (duplicate content penalty).
  alternates: { canonical: "https://wesetup.ru/blog" },
};

const PAGE_SIZE = 9;

function formatDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function BlogListPage({
  searchParams,
}: {
  searchParams?: Promise<{
    page?: string;
    tag?: string;
    q?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const tagFilter = params.tag?.trim() || null;
  const query = params.q?.trim().toLowerCase() || null;
  const page = Math.max(1, Number(params.page) || 1);

  // Загружаем все опубликованные статьи (на 25 их немного — кэшируем
  // в памяти; для filter'а по tag/search'у нужны все). Если когда-то
  // будет 200+, — перейдём на DB-фильтр.
  const allArticles = await db.article.findMany({
    where: { publishedAt: { not: null } },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      tags: true,
      readMinutes: true,
      publishedAt: true,
    },
  });

  // Считаем популярность тегов для cloud'а — отображаем самые частые сверху.
  const tagCounts = new Map<string, number>();
  for (const a of allArticles) {
    for (const t of a.tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const popularTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  let filtered = allArticles;
  if (tagFilter) {
    filtered = filtered.filter((a) =>
      a.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase()),
    );
  }
  if (query) {
    filtered = filtered.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.excerpt.toLowerCase().includes(query) ||
        a.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * PAGE_SIZE;
  const articles = filtered.slice(start, start + PAGE_SIZE);

  function pageHref(p: number) {
    const sp = new URLSearchParams();
    if (tagFilter) sp.set("tag", tagFilter);
    if (query) sp.set("q", query);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/blog?${qs}` : "/blog";
  }

  function tagHref(t: string | null) {
    const sp = new URLSearchParams();
    if (t) sp.set("tag", t);
    if (query) sp.set("q", query);
    const qs = sp.toString();
    return qs ? `/blog?${qs}` : "/blog";
  }

  return (
    <div className="min-h-screen bg-white text-[#0b1024]">
      <PublicHeader activeSection="blog" />

      {/* HERO */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-[#0b1024] px-5 py-10 text-white sm:px-6 sm:py-14 md:px-12 md:py-20">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
            <div className="absolute -bottom-32 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
          </div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              <NotebookText className="size-3.5" /> Блог
            </div>
            <h1 className="mt-4 max-w-[780px] text-[40px] font-semibold leading-[1.08] tracking-[-0.02em] md:text-[56px]">
              Как вести журналы, проходить проверки и не сгореть на смене
            </h1>
            <p className="mt-5 max-w-[720px] text-[16px] leading-[1.6] text-white/80 md:text-[18px]">
              Разборы норм, чек-листы и истории клиентов. Пишем коротко —
              читать можно в перерыве между заготовками.
            </p>

            {/* SEARCH */}
            <form
              action="/blog"
              method="get"
              className="mt-7 inline-flex w-full max-w-[520px] items-center gap-2 rounded-2xl border border-white/15 bg-white/10 p-1.5 backdrop-blur"
            >
              {tagFilter ? (
                <input type="hidden" name="tag" value={tagFilter} />
              ) : null}
              <Search className="ml-2 size-4 text-white/60" />
              <input
                type="search"
                name="q"
                defaultValue={query ?? ""}
                placeholder="Поиск по статьям…"
                className="h-10 flex-1 bg-transparent text-[14px] text-white placeholder:text-white/50 focus:outline-none"
              />
              <button
                type="submit"
                className="h-10 rounded-xl bg-white px-4 text-[13px] font-medium text-[#0b1024] hover:bg-white/90"
              >
                Найти
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* TAG FILTER */}
      {popularTags.length > 0 && (
        <section className="mx-auto mt-8 max-w-[1200px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={tagHref(null)}
              className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                tagFilter === null
                  ? "border-[#5566f6] bg-[#5566f6] text-white"
                  : "border-[#dcdfed] bg-white text-[#3c4053] hover:border-[#5566f6]/40"
              }`}
            >
              Все статьи
            </Link>
            {popularTags.map(([tag, count]) => (
              <Link
                key={tag}
                href={tagHref(tag)}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  tagFilter === tag
                    ? "border-[#5566f6] bg-[#5566f6] text-white"
                    : "border-[#dcdfed] bg-white text-[#3c4053] hover:border-[#5566f6]/40"
                }`}
              >
                {tag}{" "}
                <span
                  className={
                    tagFilter === tag
                      ? "text-white/70"
                      : "text-[#9b9fb3]"
                  }
                >
                  {count}
                </span>
              </Link>
            ))}
          </div>
          {(tagFilter || query) && (
            <div className="mt-3 text-[13px] text-[#6f7282]">
              Найдено: {total} {total === 1 ? "статья" : "статей"}
              {tagFilter ? ` · тег «${tagFilter}»` : ""}
              {query ? ` · поиск «${query}»` : ""}
              {" · "}
              <Link href="/blog" className="text-[#3848c7] hover:underline">
                сбросить фильтры
              </Link>
            </div>
          )}
        </section>
      )}

      {/* LIST */}
      <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
        {articles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-16 text-center text-[15px] text-[#6f7282]">
            По заданным фильтрам статей не нашлось.{" "}
            <Link href="/blog" className="text-[#3848c7] hover:underline">
              Сбросить
            </Link>
            .
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="group flex flex-col rounded-3xl border border-[#ececf4] bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-[#5566f6]/40 hover:shadow-[0_20px_50px_-30px_rgba(85,102,246,0.35)]"
              >
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6f7282]">
                  {a.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-[#f5f6ff] px-2.5 py-1 text-[#3848c7]"
                    >
                      {t}
                    </span>
                  ))}
                  <span className="ml-auto inline-flex items-center gap-1">
                    <Clock className="size-3.5" /> {a.readMinutes} мин
                  </span>
                </div>
                <h2 className="mt-4 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024] group-hover:text-[#3848c7]">
                  {a.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-[15px] leading-[1.6] text-[#3c4053]">
                  {a.excerpt}
                </p>
                <div className="mt-6 flex items-center justify-between text-[13px] text-[#6f7282]">
                  <span>{formatDate(a.publishedAt)}</span>
                  <span className="inline-flex items-center gap-1 font-medium text-[#3848c7]">
                    Читать
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {pages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2">
            {safePage > 1 ? (
              <Link
                href={pageHref(safePage - 1)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
              >
                ← Предыдущая
              </Link>
            ) : null}
            {Array.from({ length: pages }).map((_, i) => {
              const p = i + 1;
              const isActive = p === safePage;
              return (
                <Link
                  key={p}
                  href={pageHref(p)}
                  className={`inline-flex size-9 items-center justify-center rounded-xl text-[13px] transition-colors ${
                    isActive
                      ? "bg-[#5566f6] text-white"
                      : "border border-[#dcdfed] bg-white text-[#3c4053] hover:border-[#5566f6]/40"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {safePage < pages ? (
              <Link
                href={pageHref(safePage + 1)}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
              >
                Следующая →
              </Link>
            ) : null}
          </nav>
        )}
      </section>

      <PublicFooter />
    </div>
  );
}
