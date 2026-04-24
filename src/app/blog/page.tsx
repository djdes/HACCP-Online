import Link from "next/link";
import { ArrowRight, Clock, NotebookText } from "lucide-react";
import { db } from "@/lib/db";
import { PublicHeader, PublicFooter } from "@/components/public/public-chrome";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Блог WeSetup — электронные журналы ХАССП и СанПиН",
  description:
    "Статьи об электронных журналах, СанПиН, ХАССП и подготовке к проверкам Роспотребнадзора.",
};

function formatDate(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default async function BlogListPage() {
  const articles = await db.article.findMany({
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
          </div>
        </div>
      </section>

      {/* LIST */}
      <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-16">
        {articles.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-16 text-center text-[15px] text-[#6f7282]">
            Пока нет опубликованных статей. Загляните позже.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
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
      </section>

      <PublicFooter />
    </div>
  );
}
