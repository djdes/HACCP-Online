"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, Eye, PencilLine, Search, Stethoscope, Users } from "lucide-react";
import {
  OVERVIEW_FILTER_LABELS,
  filterOverviewClients,
  type OverviewClientRow,
  type OverviewFilter,
  type OverviewTiles,
} from "@/lib/partners/overview-shared";
import { EmptyState, Pill, formatDate, inputClass, planLabel, relativeDays } from "@/components/partner/ui";
import { cn } from "@/lib/utils";

const FILTER_ORDER: OverviewFilter[] = ["all", "active", "inactive", "overdue", "medbooks", "detached"];

/**
 * Обзор: четыре плитки (кликабельные — включают соответствующий фильтр)
 * + таблица клиентов с чипами-фильтрами и поиском. Все данные приходят
 * с сервера одним объектом; фильтрация — в памяти (≤ пары сотен строк).
 */
export function OverviewClients({
  tiles,
  clients,
  initialFilter,
}: {
  tiles: OverviewTiles;
  clients: OverviewClientRow[];
  initialFilter: OverviewFilter;
}) {
  const [filter, setFilter] = useState<OverviewFilter>(initialFilter);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const base = filterOverviewClients(clients, filter);
    const q = query.trim().toLowerCase();
    return q ? base.filter((c) => c.name.toLowerCase().includes(q)) : base;
  }, [clients, filter, query]);

  const counts = useMemo(() => {
    const out = {} as Record<OverviewFilter, number>;
    for (const f of FILTER_ORDER) out[f] = filterOverviewClients(clients, f).length;
    return out;
  }, [clients]);

  const tileDefs: { key: OverviewFilter; label: string; value: number; icon: typeof Users; tone: string; hint: string }[] = [
    { key: "all", label: "Клиентов", value: tiles.clientsTotal, icon: Users, tone: "bg-[#eef1ff] text-[#5566f6]", hint: "Активные привязки" },
    { key: "active", label: "Активные", value: tiles.activeLast7Days, icon: Activity, tone: "bg-[#ecfdf5] text-[#116b2a]", hint: "Записи каждый из 7 последних дней" },
    { key: "overdue", label: "Просрочка сегодня", value: tiles.overdueToday, icon: AlertTriangle, tone: "bg-[#fff4f2] text-[#a13a32]", hint: "Есть ежедневный журнал без записи за сегодня" },
    { key: "medbooks", label: "Медкнижки", value: tiles.medBooksExpiring30, icon: Stethoscope, tone: "bg-[#fff7ed] text-[#9a4a06]", hint: "Истекают в ближайшие 30 дней" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tileDefs.map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              className={cn(
                "flex items-start gap-3 rounded-3xl border bg-white p-4 text-left shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all duration-200 hover:shadow-[0_16px_40px_-24px_rgba(85,102,246,0.35)]",
                active ? "border-[#5566f6]" : "border-[#ececf4]",
              )}
              aria-pressed={active}
              title={t.hint}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", t.tone)}>
                <t.icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-[26px] font-semibold leading-none tracking-[-0.02em] text-[#0b1024] tabular-nums">
                  {t.value}
                </span>
                <span className="mt-1 block text-[13px] font-medium text-[#3c4053]">{t.label}</span>
                <span className="block text-[12px] text-[#9b9fb3]">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <section className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex flex-col gap-3 border-b border-[#ececf4] px-4 py-4 md:flex-row md:items-center md:justify-between md:px-5">
          <div className="flex flex-wrap gap-1.5">
            {FILTER_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors duration-150",
                  filter === f ? "bg-[#5566f6] text-white" : "bg-[#f4f5fb] text-[#3c4053] hover:bg-[#eef1ff] hover:text-[#3848c7]",
                )}
              >
                {OVERVIEW_FILTER_LABELS[f]}
                <span className={cn("tabular-nums", filter === f ? "text-white/80" : "text-[#9b9fb3]")}>{counts[f]}</span>
              </button>
            ))}
          </div>
          <label className="relative block md:w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9b9fb3]" />
            <input
              className={cn(inputClass, "h-9 pl-9 text-[14px]")}
              placeholder="Поиск по названию"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {rows.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState
              title={clients.length === 0 ? "Клиентов пока нет" : "Ничего не найдено"}
              hint={
                clients.length === 0
                  ? "Отправьте клиенту ссылку или код из раздела «Приглашения» — после регистрации он появится здесь."
                  : "Попробуйте другой фильтр или запрос."
              }
              action={
                clients.length === 0 ? (
                  <Link href="/partner/invites" className="text-[14px] font-medium text-[#3848c7] hover:text-[#5566f6]">
                    Перейти к приглашениям →
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[14px]">
              <thead className="text-[12px] uppercase tracking-[0.08em] text-[#6f7282]">
                <tr className="border-b border-[#ececf4]">
                  <th className="px-4 py-3 font-medium md:px-5">Клиент</th>
                  <th className="px-3 py-3 font-medium">Тариф</th>
                  <th className="px-3 py-3 font-medium">Активность</th>
                  <th className="px-3 py-3 text-center font-medium">Просрочка</th>
                  <th className="px-3 py-3 text-center font-medium">Медкнижки</th>
                  <th className="px-3 py-3 font-medium">Доступ</th>
                  <th className="px-4 py-3 font-medium md:px-5">Подключён</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const detached = Boolean(c.detachedAt);
                  return (
                    <tr key={c.partnerClientId} className={cn("border-b border-[#f0f1f7] transition-colors hover:bg-[#fafbff]", detached && "opacity-60")}>
                      <td className="px-4 py-3 md:px-5">
                        <Link href={`/partner/clients/${c.organizationId}`} className="block min-w-0">
                          <span className="block truncate font-medium text-[#0b1024] hover:text-[#5566f6]">{c.name}</span>
                          <span className="block text-[12px] text-[#6f7282]">{c.type}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-[#0b1024]">{planLabel(c.plan)}</div>
                        {c.subscriptionEnd ? <div className="text-[12px] text-[#6f7282]">до {formatDate(c.subscriptionEnd)}</div> : null}
                      </td>
                      <td className="px-3 py-3">
                        {detached ? (
                          <Pill tone="neutral">отключён {formatDate(c.detachedAt)}</Pill>
                        ) : c.activeLast7Days ? (
                          <Pill tone="ok">7 дней подряд</Pill>
                        ) : (
                          <Pill tone="neutral" title="Последняя запись">{relativeDays(c.lastActivityAt)}</Pill>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">
                        {c.overdueToday > 0 ? <Pill tone="danger">{c.overdueToday}</Pill> : <span className="text-[#9b9fb3]">—</span>}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">
                        {c.medBooksExpiring > 0 ? <Pill tone="warn">{c.medBooksExpiring}</Pill> : <span className="text-[#9b9fb3]">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-[#3c4053]">
                          {c.accessLevel === "edit" ? <PencilLine className="size-3.5 text-[#5566f6]" /> : <Eye className="size-3.5 text-[#6f7282]" />}
                          {c.accessLevel === "edit" ? "редактирование" : "просмотр"}
                        </span>
                        {c.clientHidesBranding ? <div className="text-[11px] text-[#9b9fb3]">брендинг скрыт</div> : null}
                      </td>
                      <td className="px-4 py-3 text-[#3c4053] md:px-5">{formatDate(c.attachedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
