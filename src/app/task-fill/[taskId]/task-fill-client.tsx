"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TaskFormField,
  TaskFormSchema,
} from "@/lib/tasksflow-adapters/task-form";

type Props = {
  taskId: number;
  token: string;
  returnUrl: string | null;
  journalLabel: string;
  documentTitle: string;
  employeeName: string | null;
  employeePositionTitle: string | null;
  form: TaskFormSchema | null;
  alreadyCompleted: boolean;
  /**
   * If true, the org admin enabled "Только админы могут править
   * выполненные записи" and the current rowKey owner is not a
   * management role. Hide the «Изменить данные» button.
   */
  editLocked: boolean;
  /** personal — обычный flow; shared — event-log с 3 кнопками. */
  taskScope: "personal" | "shared";
  allowNoEvents: boolean;
  noEventsReasons: string[];
  allowFreeTextReason: boolean;
  /** Кол-во записей в этот журнал за сегодня (бейдж для shared). */
  todaysEntryCount: number;
  /** Active closure если журнал уже закрыт за сегодня. */
  closeEvent: {
    kind: string;
    reason: string | null;
    closedAt: string;
  } | null;
};

/**
 * Standalone «fill journal from TasksFlow» UI. No WeSetup session
 * needed — auth via HMAC token in POST body. Styled with the WeSetup
 * design system tokens (hex colours from
 * `.claude/skills/design-system`): dark-hero top, indigo primary,
 * rounded 2xl/3xl, soft-surface backgrounds.
 */
export function TaskFillClient({
  taskId,
  token,
  returnUrl,
  journalLabel,
  documentTitle,
  employeeName,
  employeePositionTitle,
  form,
  alreadyCompleted,
  editLocked,
  taskScope,
  allowNoEvents,
  noEventsReasons,
  allowFreeTextReason,
  todaysEntryCount,
  closeEvent,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    if (form) {
      for (const field of form.fields) {
        const dv = (field as { defaultValue?: unknown }).defaultValue;
        if (field.type === "boolean") {
          init[field.key] = typeof dv === "boolean" ? dv : false;
        } else if (field.type === "number") {
          // Подхватываем prefill из адаптера (если задача уже выполнялась
          // и мы открываем её для редактирования — defaults берутся из
          // существующей journal-row).
          init[field.key] =
            typeof dv === "number"
              ? dv
              : typeof dv === "string" && dv.trim() !== ""
                ? Number(dv)
                : "";
        } else {
          init[field.key] =
            typeof dv === "string" || typeof dv === "number"
              ? String(dv)
              : "";
        }
      }
    }
    return init;
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // done = «только что сохранили». Для ранее выполненной задачи мы
  // НЕ показываем сразу SuccessCard — сначала спрашиваем у юзера, хочет
  // ли он отредактировать данные. После реального submit в editMode →
  // тоже done=true и тот же success-card.
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Из «Выполненных» задача сама не возвращается. Кружок выполненной
  // → confirm «Точно изменить данные?» → editIntent=true → форма с
  // prefilled значениями, юзер правит и подтверждает (новый submit
  // обновит row через applyRemoteCompletion adapter — task остаётся
  // выполненной с новыми значениями).
  const [editIntent, setEditIntent] = useState(false);
  const editMode = alreadyCompleted && editIntent;

  // Shared-task state — счётчик записей и closure (могут меняться
  // прямо в этой сессии после нажатий кнопок).
  const [entryCount, setEntryCount] = useState(todaysEntryCount);
  const [closure, setClosure] = useState(closeEvent);
  // addAnother — после успешного submit для shared показываем «Записано!
  // +1. Добавить ещё запись? / Завершить смену».
  const [addAnotherMode, setAddAnotherMode] = useState(false);
  // noEventsOpen — модалка с выбором причины «Не требуется сегодня».
  const [noEventsOpen, setNoEventsOpen] = useState(false);
  const isShared = taskScope === "shared";

  const readyToSubmit = useMemo(() => {
    if (!form) return true; // no-form tasks (generic) can always submit
    for (const f of form.fields) {
      if (!("required" in f) || !f.required) continue;
      const v = values[f.key];
      if (v === null || v === undefined || v === "") return false;
    }
    return true;
  }, [form, values]);

  function setField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function doSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/task-fill/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, values }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Ошибка сохранения");
      }
      setConfirmOpen(false);
      if (isShared) {
        // Shared: задача остаётся открытой, бампаем счётчик и
        // показываем «+1, добавить ещё или завершить смену».
        setEntryCount((c) => c + 1);
        setAddAnotherMode(true);
        // Сбрасываем форму для следующей записи (preserve какие-нибудь
        // sticky поля? пока полный reset — у каждого события свои данные).
        setValues((prev) => {
          const next: Record<string, unknown> = {};
          if (form) {
            for (const f of form.fields) {
              if (f.type === "boolean") next[f.key] = false;
              else next[f.key] = "";
            }
          }
          return next;
        });
      } else {
        setDone(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-redirect back to TasksFlow a couple of seconds after
  // success, if the caller provided a ?return=<url>. The worker
  // doesn't have to tap anything — the TasksFlow dashboard
  // refreshes on its own thanks to the completeTask call our
  // /api/task-fill endpoint made.
  useEffect(() => {
    if (!done || !returnUrl) return;
    const t = setTimeout(() => {
      window.location.href = returnUrl;
    }, 1800);
    return () => clearTimeout(t);
  }, [done, returnUrl]);

  // ===== Shared-task actions =====
  async function closeNoEvents(reason: string) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/task-fill/${taskId}/close-no-events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, kind: "no-events", reason }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Ошибка");
      }
      setClosure({
        kind: "no-events",
        reason,
        closedAt: new Date().toISOString(),
      });
      setNoEventsOpen(false);
      setAddAnotherMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function closeShift() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/task-fill/${taskId}/close-no-events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, kind: "closed-with-events" }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Ошибка");
      }
      setClosure({
        kind: "closed-with-events",
        reason: null,
        closedAt: new Date().toISOString(),
      });
      setAddAnotherMode(false);
      setDone(true); // обычная success-карточка с auto-redirect
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  async function reopenJournal() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/task-fill/${taskId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Ошибка");
      }
      setClosure(null);
      setAddAnotherMode(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fafbff]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0b1024] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-xl px-5 py-10">
          <div className="flex items-start gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <ClipboardCheck className="size-5" />
            </div>
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                {journalLabel}
              </div>
              <h1 className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.02em]">
                {documentTitle}
              </h1>
              {employeeName ? (
                <p className="mt-2 text-[14px] text-white/75">
                  {employeeName}
                  {employeePositionTitle
                    ? ` · ${employeePositionTitle}`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="mx-auto max-w-xl px-5 py-8">
        {done ? (
          <SuccessCard
            returnUrl={returnUrl}
            autoRedirecting={Boolean(returnUrl)}
          />
        ) : isShared && closure ? (
          <SharedClosedCard
            closure={closure}
            onReopen={reopenJournal}
            submitting={submitting}
            returnUrl={returnUrl}
            entryCount={entryCount}
          />
        ) : isShared && addAnotherMode ? (
          <SharedAddAnotherCard
            entryCount={entryCount}
            onAddAnother={() => setAddAnotherMode(false)}
            onCloseShift={closeShift}
            submitting={submitting}
            returnUrl={returnUrl}
          />
        ) : alreadyCompleted && !editIntent && !isShared ? (
          <AlreadyDoneCard
            onEdit={editLocked ? null : () => setEditIntent(true)}
            returnUrl={returnUrl}
            locked={editLocked}
          />
        ) : (
          <div className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
            {isShared ? (
              <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-[#dcdfed] bg-[#fafbff] p-4 text-[13px] leading-snug text-[#3c4053]">
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                    Общая задача смены
                  </div>
                  <div className="mt-1 text-[14px] text-[#0b1024]">
                    Записей сегодня: <strong>{entryCount}</strong>
                  </div>
                  <p className="mt-1 text-[12px] text-[#6f7282]">
                    Можно добавлять записи несколько раз — задача
                    остаётся открытой до конца смены.
                  </p>
                </div>
                {allowNoEvents ? (
                  <button
                    type="button"
                    onClick={() => setNoEventsOpen(true)}
                    className="shrink-0 rounded-xl border border-[#dcdfed] bg-white px-3 py-2 text-[12px] font-medium text-[#3a3f55] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
                  >
                    Не требуется сегодня
                  </button>
                ) : null}
              </div>
            ) : null}
            {editMode ? (
              <div className="mb-5 rounded-2xl border border-[#dcdfed] bg-[#fafbff] p-4 text-[13px] leading-snug text-[#3c4053]">
                Вы редактируете уже сохранённую запись журнала. После
                подтверждения старые значения будут перезаписаны.
              </div>
            ) : null}
            {form?.intro ? (
              <p className="mb-5 rounded-2xl bg-[#f5f6ff] p-4 text-[14px] leading-relaxed text-[#3c4053]">
                {form.intro}
              </p>
            ) : null}

            {form && form.fields.length > 0 ? (
              <div className="space-y-4">
                {form.fields.map((field) => (
                  <FieldInput
                    key={field.key}
                    field={field}
                    value={values[field.key]}
                    onChange={(v) => setField(field.key, v)}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-4 text-[14px] text-[#6f7282]">
                Форма не требует заполнения — просто подтвердите выполнение.
              </p>
            )}

            {error ? (
              <div className="mt-4 rounded-2xl border border-[#ffd2cd] bg-[#fff4f2] p-4 text-[13px] text-[#a13a32]">
                {error}
              </div>
            ) : null}

            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!readyToSubmit || submitting}
              className="mt-6 h-12 w-full rounded-2xl bg-[#5566f6] px-5 text-[15px] font-medium text-white hover:bg-[#4a5bf0] shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)]"
            >
              {form?.submitLabel ?? "Выполнено"}
            </Button>
            {returnUrl ? (
              <a
                href={returnUrl}
                className="mt-3 block text-center text-[13px] text-[#6f7282] hover:text-[#0b1024]"
              >
                Отмена — вернуться
              </a>
            ) : null}
          </div>
        )}

        {/* Confirmation sheet */}
        {confirmOpen && !done ? (
          <ConfirmSheet
            form={form}
            values={values}
            submitting={submitting}
            onCancel={() => setConfirmOpen(false)}
            onConfirm={doSubmit}
          />
        ) : null}

        {/* «Не требуется сегодня» modal */}
        {noEventsOpen ? (
          <NoEventsSheet
            reasons={noEventsReasons}
            allowFreeText={allowFreeTextReason}
            submitting={submitting}
            onCancel={() => setNoEventsOpen(false)}
            onConfirm={closeNoEvents}
          />
        ) : null}
      </section>
    </main>
  );
}

/**
 * Карточка «+1 записано». Показывается после успешного submit на
 * shared-task. Юзер выбирает: добавить ещё запись, или закрыть смену.
 */
function SharedAddAnotherCard({
  entryCount,
  onAddAnother,
  onCloseShift,
  submitting,
  returnUrl,
}: {
  entryCount: number;
  onAddAnother: () => void;
  onCloseShift: () => void;
  submitting: boolean;
  returnUrl: string | null;
}) {
  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#116b2a]">
        <CheckCircle2 className="size-7" />
      </div>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        Запись сохранена
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6f7282]">
        Сегодня записей: <strong>{entryCount}</strong>. Можно добавить
        ещё или закрыть смену по этому журналу.
      </p>
      <div className="mt-6 flex flex-col gap-2.5">
        <Button
          type="button"
          onClick={onAddAnother}
          disabled={submitting}
          className="h-12 w-full rounded-2xl bg-[#5566f6] px-5 text-[15px] font-medium text-white hover:bg-[#4a5bf0]"
        >
          <Plus className="mr-2 size-4" />
          Добавить ещё запись
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCloseShift}
          disabled={submitting}
          className="h-12 w-full rounded-2xl border-[#dcdfed] bg-white text-[15px] font-medium text-[#0b1024] hover:bg-[#fafbff]"
        >
          {submitting ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : null}
          Завершить смену по этому журналу
        </Button>
      </div>
      {returnUrl ? (
        <a
          href={returnUrl}
          className="mt-4 inline-block text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          Вернуться в TasksFlow
        </a>
      ) : null}
    </div>
  );
}

/**
 * Карточка для уже закрытого журнала за сегодня (kind = no-events /
 * closed-with-events). Кнопка «Открыть заново» доступна — если событие
 * случилось после закрытия.
 */
function SharedClosedCard({
  closure,
  onReopen,
  submitting,
  returnUrl,
  entryCount,
}: {
  closure: { kind: string; reason: string | null; closedAt: string };
  onReopen: () => void;
  submitting: boolean;
  returnUrl: string | null;
  entryCount: number;
}) {
  const labelByKind: Record<string, string> = {
    "no-events": "Закрыто как «без событий»",
    "closed-with-events": "Смена завершена",
    "auto-closed-empty": "Закрыто автоматически",
  };
  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#116b2a]">
        <CheckCircle2 className="size-7" />
      </div>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        {labelByKind[closure.kind] ?? "Журнал закрыт"}
      </h2>
      {closure.reason ? (
        <p className="mt-2 text-[14px] leading-relaxed text-[#6f7282]">
          Причина: <strong>{closure.reason}</strong>
        </p>
      ) : null}
      <p className="mt-1 text-[13px] text-[#9b9fb3]">
        {entryCount > 0 ? `Записей за смену: ${entryCount} · ` : ""}
        Закрыто {new Date(closure.closedAt).toLocaleString("ru-RU", {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </p>
      <Button
        type="button"
        onClick={onReopen}
        disabled={submitting}
        className="mt-6 h-12 w-full rounded-2xl bg-[#5566f6] px-5 text-[15px] font-medium text-white hover:bg-[#4a5bf0]"
      >
        {submitting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <RotateCcw className="mr-2 size-4" />
        )}
        Открыть заново (случилось событие)
      </Button>
      {returnUrl ? (
        <a
          href={returnUrl}
          className="mt-3 inline-block text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          Вернуться в TasksFlow
        </a>
      ) : null}
    </div>
  );
}

/**
 * Modal «Не требуется сегодня» с выбором причины. Свой текст
 * доступен только если allowFreeText=true.
 */
function NoEventsSheet({
  reasons,
  allowFreeText,
  submitting,
  onCancel,
  onConfirm,
}: {
  reasons: string[];
  allowFreeText: boolean;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [picked, setPicked] = useState<string | "__free__" | null>(
    reasons[0] ?? (allowFreeText ? "__free__" : null)
  );
  const [free, setFree] = useState("");
  const ready =
    picked !== null &&
    (picked !== "__free__" || free.trim().length > 0);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border-x border-t border-[#ececf4] bg-white p-6 shadow-[0_-20px_60px_-20px_rgba(11,16,36,0.3)] sm:rounded-3xl sm:border">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[18px] font-semibold text-[#0b1024]">
            Не требуется сегодня
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-[#6f7282] hover:bg-[#fafbff]"
            disabled={submitting}
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-[13px] text-[#6f7282]">
          Укажите причину. Журнал будет закрыт за сегодня — менеджер
          увидит «без событий».
        </p>
        <div className="mt-4 space-y-2">
          {reasons.map((r) => (
            <label
              key={r}
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 text-[14px] transition-colors ${
                picked === r
                  ? "border-[#5566f6] bg-[#f5f6ff]"
                  : "border-[#dcdfed] bg-white hover:bg-[#fafbff]"
              }`}
            >
              <input
                type="radio"
                checked={picked === r}
                onChange={() => setPicked(r)}
                className="size-4"
              />
              <span className="text-[#0b1024]">{r}</span>
            </label>
          ))}
          {allowFreeText ? (
            <label
              className={`flex cursor-pointer flex-col gap-2 rounded-2xl border px-3 py-2.5 text-[14px] transition-colors ${
                picked === "__free__"
                  ? "border-[#5566f6] bg-[#f5f6ff]"
                  : "border-[#dcdfed] bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  checked={picked === "__free__"}
                  onChange={() => setPicked("__free__")}
                  className="size-4"
                />
                <span className="text-[#0b1024]">Своя причина</span>
              </div>
              {picked === "__free__" ? (
                <Input
                  value={free}
                  onChange={(e) => setFree(e.target.value)}
                  placeholder="Например: проверка СЭС"
                  maxLength={120}
                  className="h-10 rounded-xl"
                  autoFocus
                />
              ) : null}
            </label>
          ) : null}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[14px]"
          >
            Отмена
          </Button>
          <Button
            type="button"
            onClick={() =>
              onConfirm(picked === "__free__" ? free.trim() : picked!)
            }
            disabled={!ready || submitting}
            className="h-11 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0]"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Подтвердить"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirm-card для уже выполненной задачи. Юзер видит «Задача
 * выполнена» и большую кнопку «Изменить данные» (редактирование
 * существующей записи журнала). Из выполненных можно ТОЛЬКО
 * редактировать — отмена выполнения недоступна (это правильное
 * compliance-поведение: история заполнений журнала не должна
 * стираться обратным toggle'ом).
 */
function AlreadyDoneCard({
  onEdit,
  returnUrl,
  locked,
}: {
  onEdit: (() => void) | null;
  returnUrl: string | null;
  locked: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#116b2a]">
        <CheckCircle2 className="size-7" />
      </div>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        Задача выполнена
      </h2>
      {locked ? (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6f7282]">
            Запись уже сохранена в журнале. По правилам компании изменять
            выполненные записи могут только администраторы — попросите
            руководителя поправить данные за вас.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6f7282]">
            Запись уже сохранена в журнале. Можно открыть её и изменить
            данные — старые значения будут перезаписаны.
          </p>
          <Button
            type="button"
            onClick={onEdit ?? undefined}
            className="mt-6 h-12 w-full rounded-2xl bg-[#5566f6] px-5 text-[15px] font-medium text-white hover:bg-[#4a5bf0] shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)]"
          >
            Изменить данные
          </Button>
        </>
      )}
      {returnUrl ? (
        <a
          href={returnUrl}
          className={`${locked ? "mt-6" : "mt-3"} inline-block text-[13px] text-[#6f7282] hover:text-[#0b1024]`}
        >
          Вернуться в TasksFlow
        </a>
      ) : null}
    </div>
  );
}

function SuccessCard({
  returnUrl,
  autoRedirecting,
}: {
  returnUrl: string | null;
  autoRedirecting: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#116b2a]">
        <CheckCircle2 className="size-7" />
      </div>
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        Журнал заполнен
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#6f7282]">
        Запись сохранена в WeSetup. Задача в TasksFlow отмечена выполненной.
      </p>
      {returnUrl ? (
        <>
          <a
            href={returnUrl}
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-medium text-white hover:bg-[#4a5bf0]"
          >
            Вернуться в TasksFlow
          </a>
          {autoRedirecting ? (
            <p className="mt-3 text-[12px] text-[#9b9fb3]">
              Переадресация через пару секунд…
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ConfirmSheet({
  form,
  values,
  submitting,
  onCancel,
  onConfirm,
}: {
  form: TaskFormSchema | null;
  values: Record<string, unknown>;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const summary = useMemo(() => {
    if (!form) return null;
    return form.fields.map((field) => ({
      label: field.label,
      value: formatValue(field, values[field.key]),
    }));
  }, [form, values]);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-[2px] sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border-x border-t border-[#ececf4] bg-white p-6 shadow-[0_-20px_60px_-20px_rgba(11,16,36,0.3)] sm:rounded-3xl sm:border">
        <h3 className="text-[18px] font-semibold text-[#0b1024]">
          Проверьте данные
        </h3>
        <p className="mt-1 text-[13px] text-[#6f7282]">
          После подтверждения запись попадёт в журнал WeSetup.
        </p>
        {summary ? (
          <div className="mt-4 space-y-1 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[13px]">
            {summary.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3">
                <span className="text-[#6f7282]">{item.label}:</span>
                <span className="text-right font-medium text-[#0b1024]">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
            className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[14px]"
          >
            Назад
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="h-11 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0]"
          >
            {submitting ? "Сохраняю…" : "Подтвердить"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: TaskFormField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case "text":
      return (
        <div>
          <Label label={field.label} required={field.required} />
          {field.multiline ? (
            <Textarea
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              rows={3}
              className="rounded-2xl border-[#dcdfed] px-4 py-3 text-[15px]"
            />
          ) : (
            <Input
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              className="h-12 rounded-2xl border-[#dcdfed] px-4 text-[15px]"
            />
          )}
        </div>
      );
    case "number":
      return (
        <div>
          <Label
            label={field.label}
            suffix={field.unit ? `(${field.unit})` : undefined}
            required={field.required}
          />
          <Input
            type="number"
            inputMode="decimal"
            value={value === null || value === undefined ? "" : String(value)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return onChange(null);
              // RU-клавиатуры пишут запятую — Number("20,1") = NaN.
              // Заменяем перед парсом.
              const normalized = raw.replace(",", ".");
              const parsed = Number(normalized);
              onChange(Number.isFinite(parsed) ? parsed : raw);
            }}
            min={field.min}
            max={field.max}
            step={field.step}
            className="h-12 rounded-2xl border-[#dcdfed] px-4 text-[15px] font-semibold tabular-nums"
          />
        </div>
      );
    case "boolean":
      return (
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-white p-4 transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(Boolean(v))}
            className="size-5"
          />
          <span className="text-[15px] text-[#0b1024]">{field.label}</span>
        </label>
      );
    case "select":
      return (
        <div>
          <Label label={field.label} required={field.required} />
          <Select
            value={(value as string) ?? ""}
            onValueChange={(v) => onChange(v)}
          >
            <SelectTrigger className="h-12 rounded-2xl border-[#dcdfed] px-4 text-[15px]">
              <SelectValue placeholder="Выберите значение" />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.code ? (
                    <span className="mr-2 inline-flex min-w-[36px] justify-center rounded-md bg-[#eef1ff] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#3848c7]">
                      {opt.code}
                    </span>
                  ) : null}
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "date":
      return (
        <div>
          <Label label={field.label} required={field.required} />
          <Input
            type="date"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 rounded-2xl border-[#dcdfed] px-4 text-[15px]"
          />
        </div>
      );
  }
}

function Label({
  label,
  suffix,
  required,
}: {
  label: string;
  suffix?: string;
  required?: boolean;
}) {
  return (
    <label className="mb-2 block text-[13px] font-medium text-[#3c4053]">
      {label}
      {suffix ? (
        <span className="ml-1 text-[#9b9fb3] font-normal">{suffix}</span>
      ) : null}
      {required ? <span className="ml-0.5 text-[#d2453d]">*</span> : null}
    </label>
  );
}

function formatValue(field: TaskFormField, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.type) {
    case "boolean":
      return value ? "Да" : "Нет";
    case "select": {
      const opt = field.options.find((o) => o.value === value);
      return opt ? `${opt.code ? opt.code + " — " : ""}${opt.label}` : String(value);
    }
    case "number":
      return field.unit ? `${value} ${field.unit}` : String(value);
    default:
      return String(value);
  }
}
