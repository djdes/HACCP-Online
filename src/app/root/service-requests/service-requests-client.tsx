"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe, Mail, MessageSquare, Phone, Send } from "lucide-react";

/**
 * Список заявок со сменой статуса прямо в строке.
 *
 * Статусов четыре и они линейные, поэтому обычный select проще любого
 * канбана: заявок в день единицы, а не сотни.
 */
export type RequestRow = {
  id: string;
  serviceTitle: string;
  organizationName: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  comment: string | null;
  status: string;
  paidRub: number;
  source: string;
  notifiedTg: boolean;
  notifiedEmail: boolean;
  createdAt: string;
};

const STATUS_LABEL: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  done: "Выполнена",
  cancelled: "Отменена",
};

const STATUS_TONE: Record<string, string> = {
  new: "bg-[#eef1ff] text-[#3848c7]",
  in_progress: "bg-[#fff4f2] text-[#a13a32]",
  done: "bg-[#ecfdf5] text-[#116b2a]",
  cancelled: "bg-[#f3f4f6] text-[#6b7280]",
};

export function ServiceRequestsClient({ initial }: { initial: RequestRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function changeStatus(id: string, status: string) {
    setBusyId(id);
    const previous = rows;
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, status } : row))
    );
    try {
      const response = await fetch("/api/root/service-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Не удалось изменить статус");
      }
      toast.success(`Статус: ${STATUS_LABEL[status] ?? status}`);
    } catch (error) {
      setRows(previous);
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
        <div className="text-[15px] font-medium text-[#0b1024]">
          Заявок пока нет
        </div>
        <p className="mx-auto mt-1.5 max-w-[380px] text-[13px] text-[#6f7282]">
          Они появятся здесь, как только клиент закажет услугу в кабинете или
          на странице «Услуги».
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-3xl border border-[#ececf4] bg-white p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[#0b1024]">
                {row.serviceTitle}
              </div>
              <div className="mt-1 text-[13px] text-[#6f7282]">
                {row.organizationName ?? "Заявка с сайта, без организации"} ·{" "}
                {new Date(row.createdAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {row.paidRub > 0 ? (
                <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 text-[12px] font-medium tabular-nums text-[#116b2a]">
                  Оплачено {row.paidRub.toLocaleString("ru-RU")} ₽
                </span>
              ) : (
                <span className="rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[12px] text-[#6b7280]">
                  Не оплачено
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${STATUS_TONE[row.status] ?? STATUS_TONE.new}`}
              >
                {STATUS_LABEL[row.status] ?? row.status}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#3c4053]">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-3.5 text-[#5566f6]" />
              {row.contactName}, {row.contactPhone}
            </span>
            {row.contactEmail ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5 text-[#5566f6]" />
                {row.contactEmail}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-[#6f7282]">
              <Globe className="size-3.5" />
              {row.source === "site" ? "с сайта" : "из кабинета"}
            </span>
          </div>

          {row.comment ? (
            <div className="mt-3 flex gap-2 rounded-2xl bg-[#fafbff] p-3">
              <MessageSquare className="mt-0.5 size-4 shrink-0 text-[#9b9fb3]" />
              <p className="text-[13px] leading-[1.5] text-[#3c4053]">
                {row.comment}
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[12px] text-[#9b9fb3]">
              <Send className="size-3.5" />
              {row.notifiedTg ? "Telegram доставлен" : "Telegram не ушёл"}
              {" · "}
              {row.notifiedEmail ? "письмо ушло" : "письма не было"}
            </span>
            <select
              value={row.status}
              disabled={busyId === row.id}
              onChange={(event) => changeStatus(row.id, event.target.value)}
              className="h-10 rounded-2xl border border-[#dcdfed] bg-white px-3 text-[13px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15 disabled:opacity-60"
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}
