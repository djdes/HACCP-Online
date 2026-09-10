import Link from "next/link";
import { Activity, SearchCheck } from "lucide-react";

import { requireRoot } from "@/lib/auth-helpers";

import { SeoHealthClient } from "./seo-client";

export const dynamic = "force-dynamic";

/** SEO-здоровье: обход всех адресов sitemap, проблемы по страницам. */
export default async function RootSeoPage() {
  await requireRoot();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">SEO-здоровье</h1>
        <p className="mt-1 max-w-[760px] text-[14px] leading-relaxed text-[#6f7282]">
          Обходит все адреса из sitemap на самом сервере: пустые и длинные title и description, отсутствие canonical и og:image, число h1, дубли заголовков, битые внутренние ссылки, медленные страницы. Отчёт держится час.
        </p>
      </div>
      <nav className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-2 rounded-2xl bg-[#eef1ff] px-4 py-2 text-[13.5px] font-medium text-[#3848c7]">
          <SearchCheck className="size-4" />
          Здоровье
        </span>
        <Link
          href="/root/seo/positions"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 py-2 text-[13.5px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
        >
          <Activity className="size-4 text-[#5566f6]" />
          Позиции
        </Link>
      </nav>

      <SeoHealthClient />
    </div>
  );
}
