import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { BlogAdminClient } from "./blog-admin-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootBlogPage() {
  await requireRoot();
  const articles = await db.article.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[24px] font-semibold tracking-tight">Блог</h1>
        <p className="mt-1 text-[14px] text-[#6f7282]">
          Статьи публичного блога (wesetup.ru/blog). Тело статьи — массив
          типов ArticleBlock (см. <code className="rounded bg-[#f5f6ff] px-1.5 py-0.5 text-[12px]">src/lib/article-blocks.ts</code>).
        </p>
      </div>
      <BlogAdminClient
        articles={articles.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: a.title,
          excerpt: a.excerpt,
          body: a.body,
          coverIcon: a.coverIcon,
          tags: a.tags,
          readMinutes: a.readMinutes,
          publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        }))}
      />
    </div>
  );
}
