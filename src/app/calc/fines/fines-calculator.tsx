"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";

import { FINE_ARTICLES, formatRub, sumFines } from "@/lib/seo/fines";

function range([min, max]: [number, number]): string {
  return min === max ? formatRub(min) : `${formatRub(min)} – ${formatRub(max)}`;
}

export function FinesCalculator() {
  const [ids, setIds] = useState<string[]>(["6.6"]);
  const totals = useMemo(() => sumFines(ids), [ids]);
  function toggle(id: string) {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <ul className="space-y-2.5">
        {FINE_ARTICLES.map((a) => {
          const on = ids.includes(a.id);
          return (
            <li key={a.id}>
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors ${on ? "border-[#5566f6]/50 bg-[#f5f6ff]" : "border-[#ececf4] bg-white hover:bg-[#fafbff]"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="mt-1 size-4 accent-[#5566f6]" />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                    {a.title}
                    <span className="rounded-full bg-[#eef1ff] px-2 py-0.5 text-[11px] font-medium text-[#3848c7]">{a.article}</span>
                  </span>
                  <span className="mt-1 block text-[13px] leading-[1.55] text-[#3c4053]">{a.hint}</span>
                  <span className="mt-1.5 block text-[12.5px] text-[#6f7282]">
                    ИП {range(a.ip)} · юрлицо {range(a.legal)}{a.suspension ? " · или приостановление до 90 суток" : ""}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <section className="rounded-3xl border border-[#ececf4] bg-[#0b1024] p-6 text-white lg:sticky lg:top-6 lg:self-start">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">Итого при одной проверке</div>
        <dl className="mt-4 space-y-3">
          {[
            ["ИП", totals.ip],
            ["Юрлицо", totals.legal],
            ["Должностное лицо", totals.official],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
              <dt className="text-[14px] text-white/75">{label as string}</dt>
              <dd className="text-[18px] font-semibold tabular-nums" data-testid={`total-${label === "ИП" ? "ip" : label === "Юрлицо" ? "legal" : "official"}`}>
                {range(value as [number, number])}
              </dd>
            </div>
          ))}
        </dl>
        {totals.suspension ? (
          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-[#fff4f2]/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-[#ffd2cd]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            По части статей вместо штрафа возможно приостановление деятельности до 90 суток — это потеря выручки за квартал.
          </p>
        ) : null}
        <p className="mt-4 text-[13px] leading-relaxed text-white/70">Электронные журналы закрывают основания по ст. 6.3, 6.6 и 14.43: записи есть, пропуски видны заранее, PDF для инспектора готов.</p>
        <Link href="/register" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]">
          Начать бесплатно
          <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
