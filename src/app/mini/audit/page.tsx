"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type AuditLog = {
  id: string;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

export default function MiniAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/mini/audit", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setLogs(data.logs ?? []);
      } catch {
        setError("Не удалось загрузить журнал аудита");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-24">
      <Link
        href="/mini"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-slate-500"
      >
        <ArrowLeft className="size-4" />
        На главную
      </Link>

      <header className="px-1">
        <h1 className="text-[20px] font-semibold text-slate-900">
          Журнал аудита
        </h1>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Последние 100 действий
        </p>
      </header>

      {loading ? (
        <div className="text-center text-sm text-slate-500">Загружаем…</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">
          Пока нет записей.
        </div>
      ) : (
        <section className="space-y-2">
          {logs.map((log) => {
            const dt = new Date(log.createdAt).toLocaleString("ru-RU", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            });
            const actionLabel = formatAction(log.action);
            return (
              <div
                key={log.id}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-slate-500">
                    {actionLabel}
                  </span>
                  <span className="text-[11px] text-slate-400">{dt}</span>
                </div>
                <div className="mt-1 text-[13px] text-slate-700">
                  {log.userName ?? "Неизвестный"} · {log.entity}
                  {log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}
                </div>
                {log.details ? (
                  <div className="mt-1 text-[11px] text-slate-400">
                    {JSON.stringify(log.details).slice(0, 120)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

function formatAction(action: string): string {
  const map: Record<string, string> = {
    "journal_entry.create": "Создание записи",
    "journal_entry.copy": "Копирование записей",
    "journal_entry.delete": "Удаление записи",
    "attachment.upload": "Загрузка файла",
    "staff.add": "Добавление сотрудника",
    "staff.update": "Изменение сотрудника",
    "equipment.add": "Добавление оборудования",
    "equipment.update": "Изменение оборудования",
  };
  return map[action] ?? action;
}
