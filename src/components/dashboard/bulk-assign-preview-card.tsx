"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Recipient = {
  userId: string;
  name: string;
  position: string | null;
  rowKey: string;
  status: "ready" | "blocked";
  blockedReason?: string;
};

type JournalReport = {
  code: string;
  label: string;
  documentId: string | null;
  documentTitle: string | null;
  documentAutoCreated?: boolean;
  created: number;
  alreadyLinked: number;
  skipped: number;
  errors: number;
  skipReason?: string;
  recipients?: Recipient[];
};

type PreviewResponse = {
  dryRun: boolean;
  created: number;
  alreadyLinked: number;
  skipped: number;
  errors: number;
  documentsCreated: number;
  byJournal: JournalReport[];
  message?: string;
};

/**
 * «Превью отправки задач в TasksFlow» — dashboard widget. Менеджер
 * видит ровно что произойдёт при нажатии «Отправить задачи»,
 * без реальной отправки. Можно открыть проблемные журналы / получателей,
 * исправить настройки и потом отправить уверенно.
 *
 * Под капотом — POST `/api/integrations/tasksflow/bulk-assign-today`
 * с body `{ dryRun: true }`. Endpoint выполняет всю обычную логику
 * (adapters, fan-out, position-filter, scope), но НЕ создаёт TF-задач
 * и не пишет DB. Возвращает per-journal report с recipients.
 */
export function BulkAssignPreviewCard() {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openJournals, setOpenJournals] = useState<Set<string>>(new Set());

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/integrations/tasksflow/bulk-assign-today",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dryRun: true }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Не удалось получить превью");
      }
      const json = (await res.json()) as PreviewResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount.
  useEffect(() => {
    void fetchPreview();
  }, []);

  const summary = useMemo(() => {
    if (!data) return null;
    let readyCount = 0;
    let blockedCount = 0;
    let journalsReady = 0;
    let journalsBlocked = 0;
    const blockedUsers = new Set<string>();
    for (const j of data.byJournal) {
      const recipients = j.recipients ?? [];
      const ready = recipients.filter((r) => r.status === "ready").length;
      const blocked = recipients.filter((r) => r.status === "blocked").length;
      readyCount += ready;
      blockedCount += blocked;
      for (const r of recipients) {
        if (r.status === "blocked") blockedUsers.add(r.userId);
      }
      if (j.skipReason || (recipients.length === 0 && ready === 0)) {
        journalsBlocked += 1;
      } else if (ready > 0) {
        journalsReady += 1;
      }
    }
    return {
      readyCount,
      blockedCount,
      journalsReady,
      journalsBlocked,
      uniqueBlockedUsers: blockedUsers.size,
      totalJournals: data.byJournal.length,
    };
  }, [data]);

  function toggleJournal(code: string) {
    setOpenJournals((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function actuallySend() {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch(
        "/api/integrations/tasksflow/bulk-assign-today",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Ошибка отправки");
      }
      const json = await res.json();
      toast.success(
        `Создано задач: ${json.created ?? 0}, ошибок: ${json.errors ?? 0}.`,
      );
      // refresh preview after send
      await fetchPreview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ececf4] p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
              Превью отправки задач
            </h3>
            <p className="mt-1 text-[12.5px] leading-snug text-[#6f7282]">
              Что и кому уйдёт при нажатии «Отправить» — без реальной
              отправки. Сразу видно проблемные журналы и сотрудников
              которым задача не дойдёт.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void fetchPreview()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#3c4053] hover:border-[#5566f6]/40 hover:bg-[#fafbff] disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Обновить
          </button>
          <button
            type="button"
            onClick={() => void actuallySend()}
            disabled={
              sending || loading || !summary || summary.readyCount === 0
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#5566f6] px-3 text-[13px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(85,102,246,0.5)] hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            Отправить готовые ({summary?.readyCount ?? 0})
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 border-b border-[#ececf4] bg-rose-50 p-4 text-[13px] text-rose-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center p-10 text-[13px] text-[#9b9fb3]">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Считаем план отправки…
        </div>
      ) : data && summary ? (
        <>
          {/* Summary cards */}
          <div className="grid gap-2 border-b border-[#ececf4] p-4 sm:grid-cols-4">
            <SummaryCard
              label="Готово отправить"
              value={summary.readyCount}
              tone="ok"
              hint={`${summary.journalsReady} из ${summary.totalJournals} журналов`}
            />
            <SummaryCard
              label="Заблокировано"
              value={summary.blockedCount}
              tone={summary.blockedCount > 0 ? "warn" : "neutral"}
              hint={
                summary.uniqueBlockedUsers > 0
                  ? `${summary.uniqueBlockedUsers} сотрудник(ов)`
                  : "никто не заблокирован"
              }
            />
            <SummaryCard
              label="Журналов с проблемами"
              value={summary.journalsBlocked}
              tone={summary.journalsBlocked > 0 ? "danger" : "neutral"}
              hint="нужна настройка"
            />
            <SummaryCard
              label="Уже отправлено"
              value={data.byJournal.reduce(
                (s, j) => s + (j.alreadyLinked ?? 0),
                0,
              )}
              tone="neutral"
              hint="не дублируем"
            />
          </div>

          {/* Per-journal list */}
          <div className="divide-y divide-[#ececf4]">
            {data.byJournal.length === 0 ? (
              <div className="flex items-center gap-2 p-6 text-[13px] text-[#9b9fb3]">
                <CheckCircle2 className="size-4" /> Все журналы за сегодня
                уже заполнены. Отправлять нечего.
              </div>
            ) : null}
            {data.byJournal.map((j) => {
              const recipients = j.recipients ?? [];
              const ready = recipients.filter((r) => r.status === "ready");
              const blocked = recipients.filter((r) => r.status === "blocked");
              const isOpen = openJournals.has(j.code);
              const hasProblem = j.skipReason || blocked.length > 0;
              const isFullySkipped =
                j.skipReason || (ready.length === 0 && recipients.length > 0);
              return (
                <div key={j.code}>
                  <button
                    type="button"
                    onClick={() => toggleJournal(j.code)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafbff]"
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${
                        isFullySkipped
                          ? "bg-rose-50 text-rose-700"
                          : hasProblem
                            ? "bg-amber-50 text-amber-700"
                            : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isFullySkipped ? (
                        <X className="size-4" />
                      ) : hasProblem ? (
                        <AlertTriangle className="size-4" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[14px] font-medium leading-tight text-[#0b1024]">
                          {j.label}
                        </span>
                        {ready.length > 0 ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                            +{ready.length}
                          </span>
                        ) : null}
                        {blocked.length > 0 ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            ⚠ {blocked.length}
                          </span>
                        ) : null}
                        {j.skipReason ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                            пропущен
                          </span>
                        ) : null}
                      </div>
                      {j.skipReason ? (
                        <div className="mt-1 text-[12px] text-rose-700">
                          {j.skipReason}
                        </div>
                      ) : ready.length === 0 && blocked.length === 0 ? (
                        <div className="mt-1 text-[12px] text-[#9b9fb3]">
                          {(j.alreadyLinked ?? 0) > 0
                            ? `Уже отправлено ${j.alreadyLinked} ранее.`
                            : "Получателей нет."}
                        </div>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`mt-1 size-4 shrink-0 text-[#9b9fb3] transition-transform ${
                        isOpen ? "rotate-180 text-[#5566f6]" : ""
                      }`}
                    />
                  </button>

                  {isOpen ? (
                    <div className="space-y-1 bg-[#fafbff]/60 px-4 pb-4">
                      {ready.length > 0 ? (
                        <div>
                          <div className="mt-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                            Получат задачу — {ready.length}
                          </div>
                          <ul className="space-y-1">
                            {ready.map((r) => (
                              <RecipientRow key={r.rowKey} r={r} tone="ok" />
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {blocked.length > 0 ? (
                        <div>
                          <div className="mt-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                            Не получат — {blocked.length}
                          </div>
                          <ul className="space-y-1">
                            {blocked.map((r) => (
                              <RecipientRow
                                key={r.rowKey}
                                r={r}
                                tone="warn"
                              />
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {ready.length === 0 && blocked.length === 0 ? (
                        <div className="py-2 text-[12px] text-[#9b9fb3]">
                          Никаких рассылок не планируется для этого журнала.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "danger" | "neutral";
  hint?: string;
}) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700"
        : tone === "danger"
          ? "bg-rose-50 text-rose-700"
          : "bg-[#fafbff] text-[#3c4053]";
  return (
    <div className={`rounded-2xl px-3 py-2.5 ${toneCls}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-[22px] font-semibold leading-none tabular-nums">
          {value}
        </span>
        {hint ? (
          <span className="text-[11px] opacity-80">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}

function RecipientRow({
  r,
  tone,
}: {
  r: Recipient;
  tone: "ok" | "warn";
}) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-white px-3 py-1.5 text-[12.5px]">
      <span
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
          tone === "ok"
            ? "bg-emerald-50 text-emerald-700"
            : "bg-amber-50 text-amber-700"
        }`}
      >
        <UserIcon className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[#0b1024]">{r.name}</div>
        <div className="text-[11px] text-[#9b9fb3]">
          {r.position ?? "Без должности"}
          {r.blockedReason ? ` · ${r.blockedReason}` : ""}
        </div>
      </div>
    </li>
  );
}
