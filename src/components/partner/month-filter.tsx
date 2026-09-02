"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatMonth } from "@/components/partner/ui";

/** Чипы «Все месяцы / сентябрь 2026 / …» — фильтр через ?month=, чтобы ссылку можно было переслать. */
export function MonthFilter({ months, current }: { months: string[]; current: string | null }) {
  const pathname = usePathname();
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors duration-150",
      active ? "bg-[#5566f6] text-white" : "bg-[#f4f5fb] text-[#3c4053] hover:bg-[#eef1ff] hover:text-[#3848c7]",
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href={pathname} className={chip(current === null)} scroll={false}>
        Все месяцы
      </Link>
      {months.map((m) => (
        <Link key={m} href={`${pathname}?month=${m}`} className={chip(current === m)} scroll={false}>
          {formatMonth(m)}
        </Link>
      ))}
    </div>
  );
}
