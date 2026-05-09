"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCw, AlertTriangle } from "lucide-react";

type TfAuditEvent = {
  id: number;
  companyId: number | null;
  actorWorkerId: number | null;
  taskId: number | null;
  action: string;
  payload: unknown;
  createdAt: number;
};

type FetchResult = {
  events: TfAuditEvent[];
  count: number;
  integration: { id: string } | null;
};

/**
 * Feed событий из TasksFlow audit log (Phase 2.10 спека Wesetup
 * docs/superpowers/specs/2026-05-09-wesetup-tasksflow-integration-design.md, П-17).
 *
 * Wesetup audit page фокусируется на manager-actions + journal-fill.
 * События task lifecycle (created/completed/claimed_by_other/deleted)
 * живут на стороне TF — этот компонент подтягивает их через proxy
 * /api/integrations/tasksflow/audit и рендерит карточками.
 *
 * Не объединяем с Wesetup AuditLog в одну ленту физически — две
 * рядом стоящие секции лучше для observability (понятно из какой
 * системы пришло событие). Группировка по дню как у Wesetup-ленты.
 */
export function TasksflowAuditFeed() {
  const [events, setEvents] = useState<TfAuditEvent[]>([]);
  const [hasIntegration, setHasIntegration] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/integrations/tasksflow/audit?limit=200", {
        credentials: "include",
      });
      const data = (await r.json()) as Partial<FetchResult> & {
        error?: string;
      };
      if (!r.ok) {
        throw new Error(data.error ?? `HTTP ${r.status}`);
      }
      setEvents(data.events ?? []);
      setHasIntegration(Boolean(data.integration));
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading && events.length === 0) {
    return (
      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <SectionHeader />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-2xl bg-[#fafbff]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <SectionHeader />
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#ffd7d3] bg-[#fff4f2] p-4 text-[#a13a32]">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1">
            <div className="text-[14px] font-semibold">
              Не удалось получить события TasksFlow
            </div>
            <div className="mt-1 text-[13px] leading-relaxed">{error}</div>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl border border-[#dcdfed] bg-white px-3 text-[12.5px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            <RefreshCw className="size-3.5" />
            Повторить
          </button>
        </div>
      </section>
    );
  }

  if (hasIntegration === false) {
    return (
      <section className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-6">
        <SectionHeader muted />
        <p className="mt-3 text-[13px] leading-[1.55] text-[#6f7282]">
          TasksFlow интеграция не настроена для этой организации.
          События task lifecycle (создание, выполнение, удаление) появятся
          здесь после подключения в{" "}
          <a
            href="/settings/integrations/tasksflow"
            className="font-medium text-[#5566f6] hover:text-[#4a5bf0]"
          >
            настройках интеграции
          </a>
          .
        </p>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <SectionHeader />
        <p className="mt-4 rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-4 py-8 text-center text-[13px] text-[#6f7282]">
          Пока нет событий TasksFlow за последние 30 дней
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <SectionHeader count={events.length} onRefresh={load} loading={loading} />
      <ul className="mt-4 space-y-1.5">
        {events.map((event) => (
          <TfEventRow key={event.id} event={event} />
        ))}
      </ul>
    </section>
  );
}

function SectionHeader(props: {
  count?: number;
  onRefresh?: () => void;
  loading?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${
            props.muted
              ? "bg-[#ececf4] text-[#9b9fb3]"
              : "bg-[#eef1ff] text-[#5566f6]"
          }`}
        >
          <Activity className="size-5" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]">
            События TasksFlow
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#6f7282]">
            Жизненный цикл задач в TF: создание, выполнение, удаление и
            sibling-claim'ы
            {typeof props.count === "number" ? ` · ${props.count} событий` : null}
          </p>
        </div>
      </div>
      {props.onRefresh ? (
        <button
          type="button"
          onClick={props.onRefresh}
          disabled={props.loading}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-[#dcdfed] bg-white px-3 text-[12.5px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-50"
        >
          <RefreshCw
            className={`size-3.5 ${props.loading ? "animate-spin" : ""}`}
          />
          Обновить
        </button>
      ) : null}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "task.created": "Задача создана",
  "task.updated": "Задача обновлена",
  "task.deleted": "Задача удалена",
  "task.completed": "Задача выполнена",
  "task.uncompleted": "Выполнение отменено",
  "task.claimed_by_other": "Сделано другим уборщиком",
  "task.verified": "Проверка пройдена",
  "task.rejected": "Возвращено на доработку",
  "task.photo_uploaded": "Фото загружено",
  "task.photo_deleted": "Фото удалено",
};

const ACTION_COLORS: Record<string, string> = {
  "task.created": "bg-[#eef1ff] text-[#3848c7]",
  "task.completed": "bg-[#ecfdf5] text-[#116b2a]",
  "task.deleted": "bg-[#fff4f2] text-[#a13a32]",
  "task.uncompleted": "bg-[#fff8eb] text-[#b25f00]",
  "task.verified": "bg-[#ecfdf5] text-[#116b2a]",
  "task.rejected": "bg-[#fff4f2] text-[#a13a32]",
  "task.claimed_by_other": "bg-[#f3eeff] text-[#7a5cff]",
};

function TfEventRow({ event }: { event: TfAuditEvent }) {
  const actionLabel = ACTION_LABELS[event.action] ?? event.action;
  const colorCls = ACTION_COLORS[event.action] ?? "bg-[#f5f6ff] text-[#3848c7]";
  const date = new Date(event.createdAt * 1000);
  const timeStr = date.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const payload = event.payload as Record<string, unknown> | null;
  const title =
    payload && typeof payload.title === "string" ? payload.title : null;

  return (
    <li className="rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:border-[#dcdfed] hover:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span
            className={`mt-0.5 inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${colorCls}`}
          >
            {actionLabel}
          </span>
          <div className="min-w-0 flex-1">
            {title ? (
              <div className="truncate text-[13.5px] font-medium text-[#0b1024]">
                {title}
              </div>
            ) : null}
            {event.taskId ? (
              <div className="text-[12px] text-[#6f7282]">
                Task #{event.taskId}
                {event.actorWorkerId
                  ? ` · worker #${event.actorWorkerId}`
                  : null}
              </div>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-[11.5px] tabular-nums text-[#9b9fb3]">
          {timeStr}
        </span>
      </div>
    </li>
  );
}
