"use client";

import { Archive, Download } from "lucide-react";
import { useState } from "react";

const INPUT = "h-11 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Карточка «Выгрузить все журналы»: период → ZIP с PDF и XLSX. */
export function ExportJournalsCard() {
  const today = new Date();
  const [from, setFrom] = useState(iso(new Date(today.getTime() - 30 * 86_400_000)));
  const [to, setTo] = useState(iso(today));
  const href = `/api/settings/export-journals?from=${from}&to=${to}`;
  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7" id="export">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-[#0b1024]">
        <Archive className="size-4 text-[#5566f6]" />
        Выгрузить все журналы одним архивом
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6f7282]">
        ZIP за период: по каждому документу — печатная форма PDF и записи в XLSX, полевые журналы — XLSX. Для бухгалтера, проверки или собственного архива. До 200 документов за раз; большой период разбейте на части.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#6f7282]">
          С
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className={INPUT} data-testid="export-from" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-[#6f7282]">
          По
          <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={INPUT} data-testid="export-to" />
        </label>
        <a href={href} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]" data-testid="export-download">
          <Download className="size-4" />
          Скачать ZIP
        </a>
      </div>
      <p className="mt-3 text-[12px] text-[#9b9fb3]">Сборка занимает от нескольких секунд до минуты — зависит от числа документов.</p>
    </section>
  );
}
