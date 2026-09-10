import Link from "next/link";
import { Activity, SearchCheck } from "lucide-react";

import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { isTopvisorConfigured } from "@/lib/topvisor";

import { PositionsClient } from "./positions-client";

export const dynamic = "force-dynamic";

/**
 * Позиции из Topvisor. Соседняя страница /root/seo — «SEO-здоровье»
 * (обход sitemap), это другой раздел, поэтому вкладки сверху.
 *
 * Смысл экрана не в том, чтобы повторить панель Topvisor, а в связке,
 * которой там нет: страница, которой поисковик ответил на запрос,
 * сопоставляется со статьями блога Wesetup.
 */
export default async function RootSeoPositionsPage() {
  await requireRoot();

  // Слаги статей нужны, чтобы отличить «ранжируется статья блога» от
  // «ранжируется случайная страница»: Topvisor про блог ничего не знает.
  const articles = await db.article.findMany({
    select: { slug: true, title: true, publishedAt: true },
  });
  const articleBySlug = Object.fromEntries(
    articles.map((a) => [
      a.slug,
      { title: a.title, published: a.publishedAt != null },
    ])
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Позиции
        </h1>
        <p className="mt-1 max-w-[760px] text-[14px] leading-relaxed text-[#6f7282]">
          Матрица «фраза × дата» из Topvisor. Под каждой фразой — страница,
          которой поисковик ответил на запрос: видно, попал ли он в нужную
          посадочную и есть ли под запрос статья в блоге.
        </p>
      </div>

      <nav className="flex items-center gap-1.5">
        <Link
          href="/root/seo"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 py-2 text-[13.5px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          <SearchCheck className="size-4 text-[#5566f6]" />
          Здоровье
        </Link>
        <span className="inline-flex items-center gap-2 rounded-2xl bg-[#eef1ff] px-4 py-2 text-[13.5px] font-medium text-[#3848c7]">
          <Activity className="size-4" />
          Позиции
        </span>
      </nav>

      <PositionsClient
        configured={isTopvisorConfigured()}
        articleBySlug={articleBySlug}
      />
    </div>
  );
}
