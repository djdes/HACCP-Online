"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Loader2, Send, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Super-user dev tools — секция видна только специальному dev-аккаунту
 * (см. src/lib/super-user.ts). Server-component передаёт сюда
 * `enabled` булев. Если false — компонент возвращает null.
 *
 * Содержит две операции:
 *
 *   1. «Очистить все журналы» — destructive, requires typeToConfirm.
 *      POST /api/dev/clear-journal-data — сносит JournalEntry,
 *      JournalDocument + entries, TasksFlowTaskLink в текущей орге.
 *      Структуру (users/positions/templates/areas) НЕ трогает.
 *
 *   2. «Force отправить в TasksFlow» — POST bulk-assign-today с
 *      { force:true, bypassTimeFilter:true }. Bypass'ит фильтр
 *      «уже заполнено сегодня» + rate-limit, для итеративного
 *      тестирования fan-out'а без ожидания до завтра.
 */
type Props = {
  enabled: boolean;
};

export function SuperUserDevTools({ enabled }: Props) {
  const router = useRouter();
  const [clearOpen, setClearOpen] = useState(false);
  const [forceOpen, setForceOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [forcing, setForcing] = useState(false);

  if (!enabled) return null;

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch("/api/dev/clear-journal-data", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка очистки");
        return;
      }
      toast.success(
        `Очищено: ${data.entriesDeleted} field-записей · ${data.documentsDeleted} документов · ${data.documentEntriesDeleted} строк · ${data.tasksflowLinksDeleted} TF-связок`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Сеть упала");
    } finally {
      setClearing(false);
    }
  }

  async function handleForceSend() {
    setForcing(true);
    try {
      const res = await fetch(
        "/api/integrations/tasksflow/bulk-assign-today",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            force: true,
            bypassTimeFilter: true,
          }),
        },
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Ошибка fan-out");
        return;
      }
      toast.success(
        `TF: создано ${data.created ?? 0} · уже было ${data.alreadyLinked ?? 0} · пропущено ${data.skipped ?? 0} · ошибок ${data.errors ?? 0}`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Сеть упала");
    } finally {
      setForcing(false);
    }
  }

  return (
    <>
      <section className="rounded-3xl border border-dashed border-[#a13a32]/40 bg-gradient-to-br from-[#fff4f2] to-[#fafbff] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#a13a32]/10 text-[#a13a32]">
            <Wand2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024] sm:text-[18px]">
              Dev-tools (super-user)
            </h2>
            <p className="mt-1 text-[13px] leading-snug text-[#6f7282]">
              Видны только тебе. Нужны для тестирования: можно очистить
              все журналы и переслать задачи в TasksFlow без ожидания
              «до завтра».
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            disabled={clearing || forcing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#a13a32] px-4 text-[14px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(161,58,50,0.55)] transition-colors hover:bg-[#8b3128] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {clearing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Eraser className="size-4" />
            )}
            Очистить все журналы
          </button>

          <button
            type="button"
            onClick={() => setForceOpen(true)}
            disabled={clearing || forcing}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#5566f6] to-[#7a5cff] px-4 text-[14px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(85,102,246,0.6)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {forcing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Force-отправить в TasksFlow
          </button>
        </div>
      </section>

      {clearOpen ? (
        <ConfirmDialog
          open={clearOpen}
          onClose={() => setClearOpen(false)}
          onConfirm={async () => {
            setClearOpen(false);
            await handleClear();
          }}
          title="Очистить все журналы?"
          description="Это безвозвратно удалит ВСЕ заполненные записи журналов, документы, фотографии и связки с TasksFlow. Структура (сотрудники, должности, шаблоны журналов) НЕ затрагивается."
          bullets={[
            {
              label: "Затрагивает только текущую организацию.",
              tone: "info",
            },
            {
              label:
                "После очистки можно сразу нажать «Force-отправить в TasksFlow» — задачи разлетятся заново.",
              tone: "info",
            },
            {
              label:
                "Используй только в тестовой орге. Эта операция не журналируется в audit-log в полном объёме.",
              tone: "warn",
            },
          ]}
          confirmLabel="Да, очистить"
          variant="danger"
          icon={Eraser}
          typeToConfirm="ОЧИСТИТЬ"
        />
      ) : null}

      {forceOpen ? (
        <ConfirmDialog
          open={forceOpen}
          onClose={() => setForceOpen(false)}
          onConfirm={async () => {
            setForceOpen(false);
            await handleForceSend();
          }}
          title="Force-отправить в TasksFlow?"
          description="Снимет фильтр «уже заполнено сегодня» и rate-limit. ВСЕ выбранные журналы получат task'и в TasksFlow заново — даже если кто-то уже заполнил их сегодня."
          bullets={[
            {
              label:
                "Старые task'и в TasksFlow удалятся (force=true), новые создадутся вместо них.",
              tone: "info",
            },
            {
              label:
                "Если только что нажимал «Очистить все журналы» — этот шаг пересоздаст task'и для свежих документов.",
              tone: "info",
            },
          ]}
          confirmLabel="Отправить заново"
          variant="default"
          icon={Send}
        />
      ) : null}
    </>
  );
}
