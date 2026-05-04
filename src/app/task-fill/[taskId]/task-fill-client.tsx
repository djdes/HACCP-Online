"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  HelpCircle,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskFillField } from "@/components/task-fill/task-fill-field";
import { TaskFillHelperModal } from "@/components/task-fill/task-fill-helper-modal";
import { TaskFillChecklist } from "@/components/task-fill/task-fill-checklist";
import type {
  TaskFormField,
  TaskFormSchema,
} from "@/lib/tasksflow-adapters/task-form";

type Props = {
  taskId: number;
  token: string;
  journalCode: string;
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
  journalCode,
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
  const [helperOpen, setHelperOpen] = useState(false);
  // Чек-лист: ready=true когда все required-пункты отмечены. Если
  // в данной орге чеклиста для этого журнала нет, компонент молчаливо
  // возвращает null и ready остаётся true (default — нет блокировки).
  const [checklistReady, setChecklistReady] = useState(true);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    // Автозаполнение по типу/ключу поля если адаптер не подставил
    // defaultValue. Юзер может стереть и ввести вручную — это не
    // блокирует submit, просто экономит тапы на типичных значениях.
    const nowHHMM = new Date().toTimeString().slice(0, 5);
    const todayISO = new Date().toISOString().slice(0, 10);
    if (form) {
      for (const field of form.fields) {
        const dv = (field as { defaultValue?: unknown }).defaultValue;
        if (field.type === "boolean") {
          init[field.key] = typeof dv === "boolean" ? dv : false;
        } else if (field.type === "number") {
          init[field.key] =
            typeof dv === "number"
              ? dv
              : typeof dv === "string" && dv.trim() !== ""
                ? Number(dv)
                : "";
        } else if (field.type === "date") {
          // Date-поле без defaultValue → сегодняшняя дата (ISO).
          // Подавляющее большинство записей — за сегодняшний день.
          init[field.key] = typeof dv === "string" && dv.trim() !== "" ? dv : todayISO;
        } else {
          // text-поле. Несколько эвристик автозаполнения:
          //   1. defaultValue из адаптера — приоритет (для редактирования).
          //   2. time-поле (maxLength=5 или метка «ЧЧ:ММ») → текущее HH:MM.
          //   3. ФИО / подпись / исполнитель → employeeName из props.
          //   4. иначе — пусто.
          const key = (field.key ?? "").toLowerCase();
          const lbl = (field.label ?? "").toLowerCase();
          const looksLikeTime =
            field.type === "text" &&
            ((field as { maxLength?: number }).maxLength === 5 ||
              field.label?.includes("ЧЧ:ММ"));
          const looksLikeName =
            /(^|[^а-я])(фио|подпис|исполнител|ответствен|повар|работник|имя\b)/i.test(
              `${key} ${lbl}`,
            );
          let autofill = "";
          if (looksLikeTime) autofill = nowHHMM;
          else if (looksLikeName && employeeName) autofill = employeeName;
          init[field.key] =
            typeof dv === "string" || typeof dv === "number"
              ? String(dv)
              : autofill;
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
  // Время открытия формы — для time-to-fill метрики на ROOT-дашборде.
  // Создаём один раз при mount (Date.now() в useState init).
  const [formOpenedAt] = useState(() => Date.now());

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

  // Не показываем journalLabel если documentTitle уже содержит его
  // целиком (auto-created документы делают title = label + дата).
  // Раньше получался дубль: «ЖУРНАЛ X» (uppercase) над «Журнал X · с
  // 02 мая…» — выглядело как ошибка вёрстки.
  const normalizedLabel = journalLabel.trim().toLowerCase();
  const normalizedTitle = documentTitle.trim().toLowerCase();
  const isLabelInTitle =
    normalizedLabel.length > 0 &&
    (normalizedTitle === normalizedLabel ||
      normalizedTitle.startsWith(normalizedLabel + " ") ||
      normalizedTitle.startsWith(normalizedLabel + " ·") ||
      normalizedTitle.startsWith(normalizedLabel + ","));

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

  // «Всё в норме (1 тап)»: для форм с number-полями min/max +
  // boolean-полями подставляет среднее min/max и true. Не сабмитит —
  // даёт юзеру тапнуть «Сохранить» если хочет проверить. Кнопка
  // показывается только если в форме есть хотя бы одно number-поле
  // с заданными min/max (иначе бессмысленно).
  const allOkApplicable = useMemo(() => {
    if (!form) return false;
    return form.fields.some(
      (f) =>
        f.type === "number" &&
        typeof (f as { min?: number }).min === "number" &&
        typeof (f as { max?: number }).max === "number"
    );
  }, [form]);

  function fillAllOk() {
    if (!form) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const f of form.fields) {
        if (f.type === "number") {
          const lo = (f as { min?: number }).min;
          const hi = (f as { max?: number }).max;
          if (typeof lo === "number" && typeof hi === "number") {
            next[f.key] = Math.round(((lo + hi) / 2) * 10) / 10;
          }
        } else if (f.type === "boolean") {
          next[f.key] = true;
        }
      }
      return next;
    });
  }

  async function doSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/task-fill/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, values, openedAt: formOpenedAt }),
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

  /**
   * «Заполнить как вчера» — дёргает API /yesterday-prefill, получает
   * data вчерашней entry для этого rowKey, мэпит keys которые
   * совпадают с form.fields[].key. Если ключи не совпадают
   * (template changed, или там nested data типа measurements) —
   * заполняем что смогли, остальное юзер дозаполнит.
   */
  const [yesterdayChecked, setYesterdayChecked] = useState(false);
  const [hasYesterdayData, setHasYesterdayData] = useState(false);
  const [yesterdayBusy, setYesterdayBusy] = useState(false);

  // На монтировании проверяем — есть ли вчерашняя entry, чтобы
  // показать/спрятать кнопку.
  useEffect(() => {
    if (!form || form.fields.length === 0) return;
    if (yesterdayChecked || alreadyCompleted || done) return;
    let cancelled = false;
    fetch(`/api/task-fill/${taskId}/yesterday-prefill?token=${encodeURIComponent(token)}`)
      .then((r) => r.json().catch(() => null))
      .then((data) => {
        if (cancelled) return;
        setYesterdayChecked(true);
        if (data && data.values && typeof data.values === "object") {
          const yd = data.values as Record<string, unknown>;
          // Проверяем что хотя бы одно поле формы есть в data
          const hasAny = form.fields.some((f) => f.key in yd);
          setHasYesterdayData(hasAny);
        }
      })
      .catch(() => setYesterdayChecked(true));
    return () => {
      cancelled = true;
    };
  }, [taskId, token, form, alreadyCompleted, done, yesterdayChecked]);

  async function fillFromYesterday() {
    setYesterdayBusy(true);
    try {
      const response = await fetch(
        `/api/task-fill/${taskId}/yesterday-prefill?token=${encodeURIComponent(token)}`
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.values) {
        toast.error("Вчерашних данных не нашлось");
        return;
      }
      const yd = data.values as Record<string, unknown>;
      let copied = 0;
      setValues((prev) => {
        const next = { ...prev };
        if (form) {
          for (const f of form.fields) {
            if (f.key in yd) {
              const v = yd[f.key];
              if (f.type === "boolean") {
                next[f.key] = typeof v === "boolean" ? v : Boolean(v);
              } else if (f.type === "number") {
                next[f.key] =
                  typeof v === "number"
                    ? v
                    : typeof v === "string" && v.trim() !== ""
                      ? Number(v)
                      : "";
              } else {
                next[f.key] =
                  typeof v === "string" || typeof v === "number"
                    ? String(v)
                    : "";
              }
              copied += 1;
            }
          }
        }
        return next;
      });
      if (copied > 0) {
        toast.success(`Скопировано ${copied} полей со вчера`);
      } else {
        toast.message("Вчерашняя структура отличается — заполните вручную");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setYesterdayBusy(false);
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
    <main className="min-h-screen bg-[#f5f6ff]">
      {/* Hero — TF-style насыщенный indigo→violet с blur-орбами.
          Layout: на мобиле иконка СВЕРХУ заголовка (column),
          на sm+ — рядом (row). Раньше иконка size-14 «прижимала»
          длинный title к правому краю, текст переносился на 3
          строки и визуально «наезжал» на иконку. Кнопка «Как
          заполнять» теперь компактнее и не перетягивает внимание
          с заголовка. */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#3d4efc] via-[#5566f6] to-[#7a5cff] text-white">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-32 size-[480px] rounded-full bg-[#a78bfa]/40 blur-[140px]" />
          <div className="absolute -bottom-48 -right-32 size-[520px] rounded-full bg-[#3d4efc]/55 blur-[160px]" />
          <div className="absolute left-1/3 top-1/2 size-[280px] rounded-full bg-white/10 blur-[120px]" />
        </div>
        <div className="relative z-10 mx-auto max-w-xl px-5 pb-10 pt-6 sm:px-6 sm:pb-12 sm:pt-8">
          {/* Top bar: иконка слева + helper-кнопка справа.
              Раздельные блоки в одной строке — не «налегают» */}
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30 backdrop-blur-sm">
              <ClipboardCheck className="size-6" />
            </span>
            <button
              type="button"
              onClick={() => setHelperOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-3 text-[12.5px] font-medium text-white ring-1 ring-white/25 backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              <HelpCircle className="size-3.5" />
              Как заполнять
            </button>
          </div>

          {/* Title — единый блок без иконки внутри. Если documentTitle
              полностью содержит journalLabel (типичный случай auto-create:
              «Журнал X» / «Журнал X · с DD месяца YYYY г.»), показываем
              только documentTitle. Иначе — небольшой подзаголовок-тег
              сверху + жирный title. */}
          <div className="mt-5 min-w-0">
            {!isLabelInTitle && journalLabel ? (
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 sm:text-[12px]">
                {journalLabel}
              </div>
            ) : null}
            <h1
              className={`text-[22px] font-semibold leading-[1.15] tracking-[-0.015em] sm:text-[26px] ${
                !isLabelInTitle && journalLabel ? "mt-1.5" : ""
              }`}
            >
              {documentTitle}
            </h1>
            {employeeName ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[13px] backdrop-blur-sm sm:text-[13.5px]">
                <span className="size-1.5 rounded-full bg-emerald-300" />
                <span className="font-medium">{employeeName}</span>
                {employeePositionTitle ? (
                  <span className="text-white/70">
                    · {employeePositionTitle}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Helper modal */}
      <TaskFillHelperModal
        open={helperOpen}
        onClose={() => setHelperOpen(false)}
        journalCode={journalCode}
        journalLabel={journalLabel}
      />

      {/* Body */}
      <section className="mx-auto -mt-6 max-w-xl px-3 pb-12 sm:px-5">
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
          <div className="space-y-4">
          {/* Чек-лист действий — выше формы. Сотрудник сначала
              физически делает работу + ставит галочки, потом
              заполняет числовые замеры. Required блокирует submit. */}
          {!editMode ? (
            <TaskFillChecklist
              taskId={taskId}
              token={token}
              onReadyChange={setChecklistReady}
            />
          ) : null}
          <div className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_20px_50px_-20px_rgba(11,16,36,0.18)] animate-in fade-in-0 slide-in-from-bottom-4 duration-500 sm:p-6">
            {isShared ? (
              <div className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-[#ececf4] bg-gradient-to-br from-[#f5f6ff] to-white p-4 text-[13px] leading-snug text-[#3c4053]">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#5566f6]/15 text-[#3848c7]">
                    <Calendar className="size-5" />
                  </span>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
                      Общая задача смены
                    </div>
                    <div className="mt-1 text-[14.5px] font-semibold text-[#0b1024]">
                      Записей сегодня: <span className="text-[#5566f6]">{entryCount}</span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-[#6f7282]">
                      Можно добавлять записи несколько раз — задача
                      остаётся открытой до конца смены.
                    </p>
                  </div>
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
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-[13.5px] leading-snug text-amber-900">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-200 text-amber-800">
                  <RotateCcw className="size-4" />
                </span>
                <span>
                  Вы редактируете уже сохранённую запись журнала. После
                  подтверждения старые значения будут перезаписаны.
                </span>
              </div>
            ) : null}
            {form?.intro ? (
              <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#f5f6ff] p-4 text-[14px] leading-relaxed text-[#3c4053]">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#5566f6]/15 text-[#5566f6]">
                  <Sparkles className="size-4" />
                </span>
                <p>{form.intro}</p>
              </div>
            ) : null}

            {/* Quick-fill кнопки — крупные карточки */}
            {(hasYesterdayData && form && form.fields.length > 0) ||
            allOkApplicable ? (
              <div className="mb-5 grid gap-2 sm:grid-cols-2">
                {hasYesterdayData && form && form.fields.length > 0 ? (
                  <button
                    type="button"
                    onClick={fillFromYesterday}
                    disabled={yesterdayBusy || submitting}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13.5px] font-medium text-[#3848c7] transition-all hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60"
                  >
                    {yesterdayBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    Заполнить как вчера
                  </button>
                ) : null}

                {allOkApplicable ? (
                  <button
                    type="button"
                    onClick={fillAllOk}
                    disabled={submitting}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white px-4 text-[13.5px] font-semibold text-emerald-800 shadow-[0_8px_20px_-12px_rgba(34,197,94,0.4)] transition-all hover:border-emerald-300 hover:from-emerald-100 disabled:opacity-60"
                    title="Подставит средние значения нормы для всех замеров и true для галочек"
                  >
                    <Trophy className="size-4 text-emerald-600" />
                    Всё в норме
                  </button>
                ) : null}
              </div>
            ) : null}

            {form && form.fields.length > 0 ? (
              <div className="space-y-3">
                {form.fields.map((field, idx) => (
                  <div
                    key={field.key}
                    className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 [animation-fill-mode:both]"
                    style={{ animationDelay: `${100 + idx * 60}ms` }}
                  >
                    <TaskFillField
                      field={field}
                      value={values[field.key]}
                      onChange={(v) => setField(field.key, v)}
                    />
                  </div>
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
              disabled={!readyToSubmit || !checklistReady || submitting}
              className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#3d4efc] to-[#7a5cff] px-5 text-[15.5px] font-semibold text-white shadow-[0_14px_36px_-12px_rgba(85,102,246,0.65)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:from-[#dcdfed] disabled:to-[#dcdfed] disabled:text-[#9b9fb3] disabled:shadow-none"
              title={
                !checklistReady
                  ? "Сначала отметь все обязательные пункты чек-листа"
                  : undefined
              }
            >
              {submitting ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Send className="size-5" />
              )}
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border-x border-t border-[#ececf4] bg-white p-6 shadow-[0_-20px_60px_-20px_rgba(11,16,36,0.3)] animate-in slide-in-from-bottom-8 fade-in-0 duration-300 sm:rounded-3xl sm:border sm:zoom-in-95">
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 backdrop-blur-[2px] animate-in fade-in-0 duration-200 sm:items-center">
      <div className="w-full max-w-md rounded-t-3xl border-x border-t border-[#ececf4] bg-white p-6 shadow-[0_-20px_60px_-20px_rgba(11,16,36,0.3)] animate-in slide-in-from-bottom-8 fade-in-0 duration-300 sm:rounded-3xl sm:border sm:zoom-in-95">
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
