"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

type Item = {
  id: string;
  scopeLabel: string;
  journalCode: string;
  executedBy: string;
  executedById: string;
  completedAt: string | null;
  verificationStatus: "pending" | "approved" | "rejected" | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  verifierComment: string | null;
  completionData: Record<string, unknown> | null;
  dateKey: string;
};

type Filter = "pending" | "approved" | "rejected" | "all";

export function VerificationsClient() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [commentByItem, setCommentByItem] = useState<Record<string, string>>({});

  async function load(f: Filter = filter) {
    setLoading(true);
    try {
      const res = await fetch(`/api/verifications?filter=${f}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { items: Item[] };
      setItems(j.items);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      const res = await fetch(`/api/verifications/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          comment: commentByItem[id]?.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(action === "approve" ? "Одобрено" : "Отправлено на переделку");
      setCommentByItem((m) => ({ ...m, [id]: "" }));
      await load(filter);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  const counts = items.reduce(
    (acc, i) => {
      const k = i.verificationStatus ?? "pending";
      acc[k as "pending" | "approved" | "rejected"] += 1;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0 }
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                Проверка задач
              </h1>
              <p className="mt-2 max-w-[560px] text-[15px] text-white/70">
                Одобряйте выполненные задачи или возвращайте на переделку с
                комментарием. Сотрудник получит уведомление в Telegram.
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <FilterTab v="pending" cur={filter} onClick={setFilter} count={counts.pending} label="Ожидают" />
            <FilterTab v="approved" cur={filter} onClick={setFilter} count={counts.approved} label="Одобрены" />
            <FilterTab v="rejected" cur={filter} onClick={setFilter} count={counts.rejected} label="Возвращены" />
            <FilterTab v="all" cur={filter} onClick={setFilter} count={items.length} label="Все" />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="flex h-[160px] items-center justify-center text-[#6f7282]">
          <Loader2 className="mr-2 size-4 animate-spin" /> Загружаю…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center text-[14px] text-[#6f7282]">
          {filter === "pending"
            ? "Все задачи проверены — ожидающих нет."
            : "Ничего не найдено."}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
                      item.verificationStatus === "approved"
                        ? "bg-[#d9f4e1] text-[#136b2a]"
                        : item.verificationStatus === "rejected"
                          ? "bg-[#ffe1dc] text-[#a13a32]"
                          : "bg-[#eef1ff] text-[#3848c7]"
                    }`}
                  >
                    {item.verificationStatus === "approved" ? (
                      <CheckCircle2 className="size-5" />
                    ) : item.verificationStatus === "rejected" ? (
                      <XCircle className="size-5" />
                    ) : (
                      <ClipboardCheck className="size-5" />
                    )}
                  </span>
                  <div>
                    <div className="text-[15px] font-semibold text-[#0b1024]">
                      {item.scopeLabel}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[#6f7282]">
                      <span>{item.executedBy}</span>
                      <span>·</span>
                      <Clock className="size-3" />
                      {item.completedAt
                        ? new Date(item.completedAt).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </div>
                  </div>
                </div>
                {item.verifiedBy ? (
                  <div className="text-[11px] text-[#9b9fb3]">
                    {item.verificationStatus === "approved" ? "✓" : "↩"} {item.verifiedBy}
                  </div>
                ) : null}
              </div>

              {item.completionData ? (
                <div className="mt-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-3 py-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
                    Введённые данные
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] text-[#0b1024] sm:grid-cols-2">
                    {Object.entries(item.completionData).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <span className="text-[#6f7282]">{k}</span>
                        <span className="text-right font-medium">
                          {typeof v === "boolean" ? (v ? "✓" : "✗") : String(v ?? "—")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {item.verifierComment ? (
                <div className="mt-3 rounded-2xl border border-[#ffe9b0] bg-[#fff8eb] px-3 py-2 text-[13px] text-[#a13a32]">
                  <AlertTriangle className="mr-1 inline size-3.5 align-text-bottom" />
                  {item.verifierComment}
                </div>
              ) : null}

              {(item.verificationStatus === null ||
                item.verificationStatus === "pending") &&
              filter === "pending" ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={commentByItem[item.id] || ""}
                    onChange={(e) =>
                      setCommentByItem((m) => ({
                        ...m,
                        [item.id]: e.target.value,
                      }))
                    }
                    placeholder="Комментарий (опционально)"
                    className="h-10 flex-1 min-w-[160px] rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => decide(item.id, "approve")}
                    disabled={busy === item.id}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#136b2a] px-4 text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    {busy === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    Одобрить
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(item.id, "reject")}
                    disabled={busy === item.id}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#d2453d] px-4 text-[13px] font-medium text-white disabled:opacity-50"
                  >
                    <XCircle className="size-3.5" />
                    Переделать
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  v,
  cur,
  onClick,
  count,
  label,
}: {
  v: Filter;
  cur: Filter;
  onClick: (v: Filter) => void;
  count: number;
  label: string;
}) {
  const active = v === cur;
  return (
    <button
      type="button"
      onClick={() => onClick(v)}
      className={`inline-flex h-9 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-medium transition-colors ${
        active
          ? "bg-white text-[#0b1024]"
          : "border border-white/15 bg-white/5 text-white/80 backdrop-blur hover:bg-white/10"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[11px] ${
          active ? "bg-[#eef1ff] text-[#3848c7]" : "bg-white/15 text-white/90"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
