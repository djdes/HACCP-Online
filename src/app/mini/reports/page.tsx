"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

const REPORT_LINKS = [
  { label: "Журналы (PDF)", href: "/reports?format=pdf" },
  { label: "Журналы (Excel)", href: "/reports?format=excel" },
  { label: "Производственный план", href: "/plans" },
  { label: "CAPA", href: "/capa" },
  { label: "Потери", href: "/losses" },
  { label: "Изменения", href: "/changes" },
  { label: "Компетенции", href: "/competencies" },
  { label: "Партии", href: "/batches" },
];

export default function MiniReportsPage() {
  const { data: session } = useSession();
  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : "";

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <header className="pt-2">
        <h1 className="text-[22px] font-semibold text-slate-900">
          Отчёты и разделы
        </h1>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Откройте полную версию сайта для работы с отчётами
        </p>
      </header>

      <section className="space-y-2">
        {REPORT_LINKS.map((link) => (
          <a
            key={link.href}
            href={`${baseUrl}${link.href}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 active:scale-[0.98]"
          >
            <span className="text-[15px] font-medium text-slate-900">
              {link.label}
            </span>
            <span className="text-[13px] text-slate-400">→</span>
          </a>
        ))}
      </section>

      <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-md justify-around border-t border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        <Link href="/mini" className="text-[11px] font-medium text-slate-500">
          Главная
        </Link>
        <Link href="/mini/staff" className="text-[11px] font-medium text-slate-500">
          Сотрудники
        </Link>
        <Link href="/mini/equipment" className="text-[11px] font-medium text-slate-500">
          Оборудование
        </Link>
        <Link href="/mini/reports" className="text-[11px] font-medium text-slate-900">
          Отчёты
        </Link>
        <Link href="/mini/me" className="text-[11px] font-medium text-slate-500">
          Профиль
        </Link>
      </nav>
    </div>
  );
}
