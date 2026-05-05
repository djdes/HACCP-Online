"use client";

import { useState } from "react";
import { CheckCircle2, ClipboardCheck, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "sonner";

/**
 * Verifier flow для TasksFlow supervisor-task.
 *
 * Когда проверяющий открывает задачу в TasksFlow → попадает сюда (а не
 * на форму заполнения). Видит read-only-сводку по тому, что заполнил
 * сотрудник, и принимает решение:
 *   • «Принять журнал» → все entries → verificationStatus = approved.
 *   • «Вернуть на доработку» с причиной → entries → rejected + reason.
 *     Сотрудник получит push в TasksFlow с возможностью исправить.
 *
 * Если сотрудник ещё не закончил заполнение — показывается banner
 * «Подождите, журнал не закрыт». Verifier может зайти позже.
 */

type EntryView = {
  id: string;
  date: string; // ISO date-only
  employeeName: string;
  employeePosition: string | null;
  verificationStatus: string | null;
  /** Краткая запись содержания (key-value pairs). */
  fields: Array<{ label: string; value: string }>;
};

export type TaskVerifyClientProps = {
  taskId: number;
  token: string;
  journalLabel: string;
  documentTitle: string;
  documentClosed: boolean;
  /** Текущий статус документа: "submitted" | "approved" | "rejected" | null. */
  documentVerificationStatus: string | null;
  /** Если документ был отклонён ранее — старая причина (для контекста). */
  previousRejectReason: string | null;
  entries: EntryView[];
  /** Имя verifier'а из TF — для шапки страницы. */
  verifierName: string;
  returnUrl: string | null;
  /**
   * Сколько filler-задач связано с этим документом, и сколько уже
   * выполнено. Нужно показать verifier'у явный прогресс — без этого
   * непонятно, ждать ли заполнителя или уже можно проверять.
   */
  totalFillers: number;
  completedFillers: number;
};

export function TaskVerifyClient(props: TaskVerifyClientProps) {
  const [submitting, setSubmitting] = useState(false);
  const [decided, setDecided] = useState<null | "approved" | "rejected">(null);
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const empty = props.entries.length === 0;
  // Готов ли документ к проверке: все filler-задачи завершены.
  const allFillersDone =
    props.totalFillers > 0 &&
    props.completedFillers >= props.totalFillers;
  const someFillersPending =
    props.totalFillers > 0 && props.completedFillers < props.totalFillers;

  async function submitDecision(
    decision: "approved" | "rejected",
    reason: string
  ) {
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/task-fill/${props.taskId}/verify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: props.token, decision, reason }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(
          data?.error || "Не удалось отправить решение. Попробуйте ещё раз."
        );
        return;
      }
      setDecided(decision);
      toast.success(
        decision === "approved"
          ? "Журнал принят целиком ✓"
          : "Возвращено на доработку — сотрудник получит уведомление"
      );
      setConfirmApprove(false);
      setConfirmReject(false);
      // Закрываем webview если в TF (есть returnUrl)
      if (props.returnUrl && typeof window !== "undefined") {
        setTimeout(() => {
          window.location.href = props.returnUrl!;
        }, 1500);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Если уже решено — показываем итог и блокируем actions
  const isReadOnly = decided !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <div className="rounded-3xl border border-[#ececf4] bg-[#0b1024] p-5 text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)] sm:p-7">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <ClipboardCheck className="size-6" />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">
              Проверка журнала
            </div>
            <h1 className="mt-1 text-[clamp(1.25rem,2vw+0.75rem,1.75rem)] font-semibold leading-tight tracking-[-0.02em]">
              {props.documentTitle}
            </h1>
            <p className="mt-1 text-[14px] text-white/70">
              {props.journalLabel} · проверяет: {props.verifierName}
            </p>
          </div>
        </div>
      </div>

      {decided ? (
        <div
          className={`rounded-3xl border p-5 ${
            decided === "approved"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <div className="text-[15px] font-semibold">
            {decided === "approved"
              ? "Журнал принят. Возвращаемся в TasksFlow…"
              : "Возвращено на доработку. Сотрудник увидит причину."}
          </div>
        </div>
      ) : null}

      {/* Прогресс fillers'ов — главный сигнал «можно проверять или ждать» */}
      {props.totalFillers > 0 ? (
        <div
          className={`rounded-3xl border p-4 sm:p-5 ${
            allFillersDone
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-amber-200 bg-amber-50/60"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-2xl text-[15px] font-semibold ${
                allFillersDone
                  ? "bg-emerald-500 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {props.completedFillers}/{props.totalFillers}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-[15px] font-semibold ${
                  allFillersDone ? "text-emerald-900" : "text-amber-900"
                }`}
              >
                {allFillersDone
                  ? "Все сотрудники заполнили — можно проверять"
                  : `Ждём пока сотрудники закончат заполнение`}
              </div>
              <p
                className={`mt-0.5 text-[13px] ${
                  allFillersDone ? "text-emerald-800/80" : "text-amber-900/80"
                }`}
              >
                {allFillersDone
                  ? `Готово к решению: принять журнал целиком или вернуть конкретному сотруднику с причиной.`
                  : `Задач выполнено: ${props.completedFillers} из ${props.totalFillers}. Ниже — то, что уже заполнили. Можно дождаться остальных или проверить сейчас.`}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-8 text-center text-[#6f7282]">
          <div className="text-[15px] font-medium text-[#0b1024]">
            Журнал ещё не заполнен
          </div>
          <p className="mt-1 text-[13px]">
            Сотрудник пока не внёс ни одной записи. Зайдите позже —
            ссылка в TasksFlow будет работать всю смену.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
            <div className="border-b border-[#ececf4] px-5 py-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">
              Записи · {props.entries.length}
            </div>
            <ul className="divide-y divide-[#ececf4]">
              {props.entries.map((entry, idx) => (
                <li key={entry.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                    <div className="font-medium text-[#0b1024]">
                      {idx + 1}. {entry.employeeName}
                    </div>
                    <div className="text-[12px] text-[#9b9fb3]">
                      {entry.date}
                      {entry.employeePosition
                        ? ` · ${entry.employeePosition}`
                        : ""}
                    </div>
                  </div>
                  {entry.fields.length > 0 ? (
                    <dl className="mt-2 grid grid-cols-1 gap-1 text-[13px] sm:grid-cols-2">
                      {entry.fields.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-baseline justify-between gap-2 rounded-xl bg-[#fafbff] px-3 py-1.5"
                        >
                          <dt className="text-[12px] uppercase tracking-[0.12em] text-[#9b9fb3]">
                            {f.label}
                          </dt>
                          <dd className="text-right text-[13px] text-[#0b1024]">
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-1.5 text-[12px] italic text-[#9b9fb3]">
                      Нет данных в записи
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="sticky bottom-2 z-10 flex flex-col gap-2 rounded-3xl border border-[#ececf4] bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] leading-snug text-[#6f7282]">
              {someFillersPending
                ? "Сотрудники ещё дозаполняют. Можно подождать или посмотреть что уже есть и решить."
                : "Прими целиком если всё в порядке. Если нашли ошибку — верни сотруднику с причиной, он исправит."}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={submitting || isReadOnly}
                onClick={() => setConfirmReject(true)}
                className="h-11 rounded-2xl border-[#fed4ce] bg-[#fff4f2] px-4 text-[14px] font-medium text-[#a13a32] hover:border-[#a13a32]/30 hover:bg-[#ffe5e1]"
              >
                <MessageSquareWarning className="size-4" />
                Вернуть на доработку
              </Button>
              <Button
                type="button"
                disabled={submitting || isReadOnly}
                onClick={() => setConfirmApprove(true)}
                className="h-11 rounded-2xl bg-emerald-600 px-5 text-[14px] font-medium text-white hover:bg-emerald-700"
              >
                <CheckCircle2 className="size-4" />
                Принять журнал
              </Button>
            </div>
          </div>
        </>
      )}

      {props.documentVerificationStatus === "rejected" &&
      props.previousRejectReason ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
          <div className="font-semibold">
            Предыдущее возврат на доработку
          </div>
          <div className="mt-0.5">{props.previousRejectReason}</div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmApprove}
        onClose={() => setConfirmApprove(false)}
        variant="info"
        title="Принять журнал?"
        description={
          <span>
            Все <strong>{props.entries.length}</strong> записей будут
            помечены как одобренные. Сотрудник увидит «Записи приняты»
            в своей TasksFlow-задаче.
          </span>
        }
        confirmLabel={submitting ? "Сохраняем…" : "Принять"}
        onConfirm={() => submitDecision("approved", "")}
      />

      <ConfirmDialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        variant="warn"
        title="Вернуть на доработку?"
        description={
          <div className="space-y-2">
            <p>Опишите что не так — сотрудник увидит причину и исправит.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Например: t° холодильника №2 указана неверно — проверь термометр"
              className="min-h-[80px] w-full rounded-2xl border border-[#dcdfed] bg-white px-4 py-2 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />
          </div>
        }
        confirmLabel={submitting ? "Отправляем…" : "Вернуть на доработку"}
        onConfirm={() => {
          if (!rejectReason.trim()) {
            toast.error("Опишите причину — без неё сотрудник не поймёт что исправить");
            return;
          }
          return submitDecision("rejected", rejectReason.trim());
        }}
      />
    </div>
  );
}
