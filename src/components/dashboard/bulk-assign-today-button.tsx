"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatBulkAssignToastMessage } from "@/lib/tasksflow-bulk-assign-toast";

type BulkAssignResult = {
  created: number;
  alreadyLinked: number;
  skipped: number;
  errors: number;
  documentsCreated?: number;
  message?: string;
  byJournal?: Array<{
    label: string;
    skipReason?: string;
    documentAutoCreated?: boolean;
  }>;
  tfUserSync?: {
    attempted: boolean;
    created: number;
    linked: number;
    withoutPhone: number;
    failures: number;
  };
};

/**
 * One-click fan-out button: creates TasksFlow tasks for selected journals
 * that are not filled today. Per-employee journals still fan out to staff;
 * normal journal-per-day templates get a single task.
 *
 * Вторая кнопка — «Пересоздать все»: посылает {force: true}, что чистит
 * все локальные TasksFlowTaskLink перед назначением. Используется когда
 * задачи в TasksFlow удалены вручную, а linked-записи в БД WeSetup
 * остались (alreadyLinked блокирует создание новых).
 */
export function BulkAssignTodayButton({
  unfilledCount,
}: {
  unfilledCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"idle" | "send" | "force" | "cleanup">(
    "idle"
  );

  async function run(force: boolean) {
    if (busy !== "idle") return;
    setBusy(force ? "force" : "send");
    try {
      const response = await fetch(
        "/api/integrations/tasksflow/bulk-assign-today",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force }),
        }
      );
      const data = (await response.json().catch(() => null)) as
        | BulkAssignResult
        | { error: string }
        | null;
      if (!response.ok) {
        const msg =
          (data && "error" in data && data.error) || "Не удалось отправить";
        toast.error(msg);
        return;
      }
      const result = data as BulkAssignResult;
      const totals =
        result.created + result.alreadyLinked + result.skipped + result.errors;

      if (totals === 0) {
        const withReason = (result.byJournal ?? []).filter((b) => b.skipReason);
        if (withReason.length > 0) {
          const firstReason = withReason[0].skipReason;
          toast.error(
            `Задачи не отправлены. Причина: ${firstReason}. Журналов затронуто: ${withReason.length}.`
          );
        } else {
          toast.success(
            result.message ??
              "Нечего отправлять — все ежедневные журналы уже на заполнении."
          );
        }
      } else {
        toast.success(formatBulkAssignToastMessage(result));
      }
      // Подсветить tfUserSync результат отдельным тостом, если есть
      // что показать — иначе непонятно почему N сотрудников без TF
      // не получили задачи.
      const tfSync = result.tfUserSync;
      if (tfSync?.attempted) {
        if (tfSync.created > 0) {
          toast.success(
            `Создано в TasksFlow ${tfSync.created} новых сотрудник(ов)`,
            { duration: 4000 }
          );
        }
        if (tfSync.withoutPhone > 0) {
          toast.warning(
            `${tfSync.withoutPhone} сотрудник(ов) без телефона — задачи в TasksFlow не получат. Заведите phone в /settings/users.`,
            { duration: 7000 }
          );
        }
        if (tfSync.failures > 0) {
          toast.error(
            `TF-sync: ${tfSync.failures} ошибок при создании юзеров. Проверьте /settings/integrations/tasksflow.`,
            { duration: 7000 }
          );
        }
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setBusy("idle");
    }
  }

  function handleForce() {
    if (busy !== "idle") return;
    const ok = window.confirm(
      "«Пересоздать все» сбросит все локальные связки задач TasksFlow и заново создаст задачи для незаполненных журналов.\n\n" +
        "Сами задачи в TasksFlow при этом НЕ удаляются — если ты не удалил их вручную в TasksFlow, могут остаться дубли. " +
        "Используй когда удалил задачи в TasksFlow напрямую и хочешь начать с чистого листа.\n\nПродолжить?"
    );
    if (!ok) return;
    void run(true);
  }

  async function handleCleanup() {
    if (busy !== "idle") return;
    const ok = window.confirm(
      "«Очистить невыполненные» удалит ВСЕ незавершённые задачи в TasksFlow, " +
        "которые были созданы из этого аккаунта WeSetup. Выполненные задачи " +
        "НЕ трогаем — они нужны для compliance-истории.\n\nПродолжить?"
    );
    if (!ok) return;
    setBusy("cleanup");
    try {
      const response = await fetch(
        "/api/integrations/tasksflow/cleanup-pending",
        { method: "POST" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Не удалось очистить");
        return;
      }
      const total =
        (data?.deletedTfTasks ?? 0) + (data?.alreadyGone ?? 0);
      if (total === 0) {
        toast.success(data?.message ?? "Нет невыполненных задач");
      } else {
        toast.success(
          `Очищено: ${data?.deletedTfTasks ?? 0} задач в TasksFlow${
            data?.alreadyGone ? ` (+${data.alreadyGone} уже были удалены)` : ""
          }`
        );
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setBusy("idle");
    }
  }

  const sendDisabled = busy !== "idle" || unfilledCount === 0;
  const forceDisabled = busy !== "idle";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => run(false)}
        disabled={sendDisabled}
        title={
          unfilledCount === 0
            ? "Всё уже заполнено на сегодня"
            : `Создать задачи в TasksFlow для всех ${unfilledCount} незаполненных журналов`
        }
        className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[13px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#c8cbe0] disabled:shadow-none"
      >
        {busy === "send" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
        {busy === "send" ? "Отправляем…" : "Отправить всем на заполнение"}
      </button>
      <button
        type="button"
        onClick={handleForce}
        disabled={forceDisabled}
        title="Сбросить локальные связки и создать задачи заново. Полезно если задачи в TasksFlow удалены вручную."
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-3 text-[13px] font-medium text-[#3c4053] transition-colors hover:border-[#5566f6]/50 hover:bg-[#f5f6ff] hover:text-[#5566f6] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "force" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCcw className="size-4" />
        )}
        {busy === "force" ? "Пересоздаём…" : "Пересоздать все"}
      </button>
      <button
        type="button"
        onClick={handleCleanup}
        disabled={busy !== "idle"}
        title="Удалить ВСЕ незавершённые задачи в TasksFlow, созданные из этого аккаунта WeSetup. Выполненные не трогает."
        className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#ffd2cd] bg-white px-3 text-[13px] font-medium text-[#a13a32] transition-colors hover:border-[#a13a32]/50 hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy === "cleanup" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        {busy === "cleanup" ? "Очищаем…" : "Очистить невыполненные"}
      </button>
    </div>
  );
}
