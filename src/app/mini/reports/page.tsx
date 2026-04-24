"use client";

import Link from "next/link";
import { ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { buildMiniOpenBridgePath } from "@/lib/journal-obligation-links";

const REPORT_LINKS = [
  { label: "Журналы в PDF", href: "/reports?format=pdf", icon: FileText },
  { label: "Журналы в Excel", href: "/reports?format=excel", icon: FileSpreadsheet },
  { label: "Производственный план", href: "/plans", icon: FileText },
  { label: "CAPA", href: "/capa", icon: FileText },
  { label: "Потери", href: "/losses", icon: FileText },
  { label: "Изменения", href: "/changes", icon: FileText },
  { label: "Компетенции", href: "/competencies", icon: FileText },
  { label: "Партии", href: "/batches", icon: FileText },
];

export default function MiniReportsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <header className="rounded-3xl border border-[#ececf4] bg-white px-5 py-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
          Отчёты
        </p>
        <h1 className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Экспорт и разделы
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-[#6f7282]">
          Mini App держит ежедневную работу внутри Telegram. Большие отчёты
          открываются через понятный переход в полный кабинет.
        </p>
      </header>

      <section className="space-y-2">
        {REPORT_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={buildMiniOpenBridgePath(link.href, link.label)}
              className="flex w-full items-center gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3 text-left shadow-[0_0_0_1px_rgba(240,240,250,0.45)] active:scale-[0.98]"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-[#0b1024]">
                  {link.label}
                </span>
                <span className="mt-0.5 block text-[12px] text-[#6f7282]">
                  Полная версия
                </span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[#9b9fb3]" />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
