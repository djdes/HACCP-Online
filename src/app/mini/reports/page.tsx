"use client";

"use client";

import { useEffect, useState } from "react";

function getTelegramWebApp() {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }).Telegram
    ?.WebApp;
  return tg || null;
}

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
  const [baseUrl, setBaseUrl] = useState("");

  useEffect(() => {
    setBaseUrl(`${window.location.protocol}//${window.location.host}`);
  }, []);

  function openInMiniApp(href: string) {
    const tg = getTelegramWebApp();
    const url = `${baseUrl}${href}`;
    if (tg?.openLink) {
      tg.openLink(url);
    } else {
      window.location.href = url;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-[22px] font-semibold text-slate-900">
          Отчёты и разделы
        </h1>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Откройте полную версию для работы с отчётами
        </p>
      </header>

      <section className="space-y-2">
        {REPORT_LINKS.map((link) => (
          <button
            key={link.href}
            onClick={() => openInMiniApp(link.href)}
            className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left active:scale-[0.98]"
          >
            <span className="text-[15px] font-medium text-slate-900">
              {link.label}
            </span>
            <span className="text-[13px] text-slate-400">→</span>
          </button>
        ))}
      </section>
    </div>
  );
}
