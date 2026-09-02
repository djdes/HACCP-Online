"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { INVITE_STATUS_LABELS } from "@/lib/partners/validation";
import { EmptyState, Pill, btnPrimary, formatDateTime, inputClass, readError, type PillTone } from "@/components/partner/ui";

export type EmailInviteRow = {
  id: string;
  email: string;
  status: string;
  sentAt: string;
  registeredAt: string | null;
  declinedAt: string | null;
  organizationId: string | null;
  organizationName: string | null;
};

const STATUS_TONE: Record<string, PillTone> = { sent: "neutral", registered: "ok", declined: "danger" };

/**
 * Email-приглашения: форма «отправить» и таблица со статусами
 * отправлено / зарегистрировался / отказался. Отправка идёт с
 * `noreply@wesetup.ru`, повтор на тот же адрес — не чаще раза в сутки.
 */
export function EmailInvites({ invites }: { invites: EmailInviteRow[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setSending(true);
    try {
      const res = await fetch("/api/partner/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Не удалось отправить приглашение"));
        return;
      }
      toast.success(`Приглашение отправлено на ${value}`);
      setEmail("");
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          className={inputClass}
          placeholder="pochta@klienta.ru"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="off"
        />
        <button type="submit" className={btnPrimary} disabled={sending || !email.trim()}>
          <Mail className="size-4" />
          {sending ? "Отправляем…" : "Отправить приглашение"}
        </button>
      </form>
      <p className="text-[12px] leading-[1.5] text-[#6f7282]">
        Письмо уйдёт от имени WeSetup с вашим логотипом и ссылкой на регистрацию. В письме есть ссылка «Не хочу получать
        приглашения» — после отказа повторно написать на этот адрес нельзя.
      </p>

      {invites.length === 0 ? (
        <EmptyState title="Приглашений по почте ещё не было" hint="Отправьте первое — статус появится в этой таблице." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#ececf4]">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead className="bg-[#fafbff] text-[12px] uppercase tracking-[0.08em] text-[#6f7282]">
              <tr className="border-b border-[#ececf4]">
                <th className="px-4 py-2.5 font-medium">Почта</th>
                <th className="px-3 py-2.5 font-medium">Статус</th>
                <th className="px-3 py-2.5 font-medium">Отправлено</th>
                <th className="px-4 py-2.5 font-medium">Результат</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-b border-[#f0f1f7] last:border-b-0">
                  <td className="px-4 py-2.5 text-[#0b1024]">{i.email}</td>
                  <td className="px-3 py-2.5">
                    <Pill tone={STATUS_TONE[i.status] ?? "neutral"}>{INVITE_STATUS_LABELS[i.status] ?? i.status}</Pill>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#3c4053]">{formatDateTime(i.sentAt)}</td>
                  <td className="px-4 py-2.5 text-[#3c4053]">
                    {i.status === "registered"
                      ? `${i.organizationName ?? "Организация"} · ${formatDateTime(i.registeredAt)}`
                      : i.status === "declined"
                        ? `отказ ${formatDateTime(i.declinedAt)}`
                        : "ждём регистрации"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
