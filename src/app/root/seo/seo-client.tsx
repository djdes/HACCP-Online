"use client";

import { Play, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { SeoHealthReport } from "@/lib/seo/crawl";
import type { SeoIssue } from "@/lib/seo/health";

const KIND_LABEL: Record<SeoIssue["kind"], string> = {
  status: "Страница не 200",
  title: "Title",
  description: "Description",
  canonical: "Canonical",
  h1: "Заголовок h1",
  og: "og:image",
  "duplicate-title": "Дубли title",
  "broken-link": "Битые ссылки",
  slow: "Медленно",
};

export function SeoHealthClient() {
  const [report, setReport] = useState<SeoHealthReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<SeoIssue["kind"] | "all">("all");

  const load = useCallback(async () => {
    const response = await fetch("/api/root/seo-health");
    const data = (await response.json().catch(() => null)) as { report: SeoHealthReport | null } | null;
    setReport(data?.report ?? null);
    setLoaded(true);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function run() {
    setBusy(true);
    try {
      const response = await fetch("/api/root/seo-health", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { report?: SeoHealthReport; error?: string } | null;
      if (!response.ok || !data?.report) throw new Error(data?.error ?? "Обход не удался");
      setReport(data.report);
      toast.success(`Проверено страниц: ${data.report.pages.length}, проблем: ${data.report.issues.length}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const counts = useMemo(() => {
    const out = new Map<SeoIssue["kind"], number>();
    for (const i of report?.issues ?? []) out.set(i.kind, (out.get(i.kind) ?? 0) + 1);
    return out;
  }, [report]);
  const shown = (report?.issues ?? []).filter((i) => filter === "all" || i.kind === filter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void run()} disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60">
          {busy ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4" />}
          {busy ? "Обходим (до пары минут)…" : report ? "Проверить заново" : "Проверить"}
        </button>
        {report ? (
          <span className="text-[13px] text-[#6f7282]">
            Проверено {report.pages.length} страниц и {report.linksChecked} внутренних ссылок · {new Date(report.finishedAt).toLocaleString("ru-RU")}
          </span>
        ) : loaded ? (
          <span className="text-[13px] text-[#6f7282]">Отчёта ещё нет — нажмите «Проверить».</span>
        ) : null}
      </div>

      {report ? (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFilter("all")} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${filter === "all" ? "border-[#5566f6] bg-[#5566f6] text-white" : "border-[#dcdfed] bg-white text-[#0b1024]"}`}>
              Все · {report.issues.length}
            </button>
            {(Object.keys(KIND_LABEL) as SeoIssue["kind"][]).filter((k) => counts.get(k)).map((k) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-medium ${filter === k ? "border-[#5566f6] bg-[#5566f6] text-white" : "border-[#dcdfed] bg-white text-[#0b1024]"}`}>
                {KIND_LABEL[k]} · {counts.get(k)}
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-12 text-center text-[14px] text-[#116b2a]">Проблем не найдено.</div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
              <table className="w-full min-w-[720px] text-[13.5px]">
                <thead>
                  <tr className="bg-[#fafbff] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
                    <th className="px-4 py-3">Тип</th>
                    <th className="px-4 py-3">Страница</th>
                    <th className="px-4 py-3">Что не так</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((i, idx) => (
                    <tr key={`${i.kind}-${i.url}-${idx}`} className="border-t border-[#ececf4] align-top">
                      <td className="px-4 py-2.5 whitespace-nowrap text-[#3848c7]">{KIND_LABEL[i.kind]}</td>
                      <td className="px-4 py-2.5">
                        <a href={i.url} target="_blank" rel="noreferrer" className="text-[#0b1024] underline-offset-2 hover:underline">
                          {i.url.replace("https://wesetup.ru", "") || "/"}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 text-[#3c4053]">{i.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
