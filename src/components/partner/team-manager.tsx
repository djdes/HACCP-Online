"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pill, btnPrimary, formatDate, formatDateTime, inputClass, readError } from "@/components/partner/ui";

export type TeamMemberRow = {
  id: string;
  role: "owner" | "member";
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  since: string;
};

/**
 * Команда партнёра: список участников и форма добавления по почте.
 * Владелец — один, его удалить нельзя; участники видят всё то же, что
 * владелец, кроме реквизитов и состава команды.
 */
export function TeamManager({ team, meUserId, canManage }: { team: TeamMemberRow[]; meUserId: string; canManage: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<TeamMemberRow | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/partner/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Не удалось добавить"));
        return;
      }
      const data = (await res.json()) as { created: boolean };
      toast.success(data.created ? "Аккаунт создан, письмо с паролем отправлено" : "Сотрудник добавлен в команду");
      setEmail("");
      setName("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function remove() {
    if (!removing) return;
    const res = await fetch(`/api/partner/team/${removing.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error(await readError(res, "Не удалось удалить"));
      return;
    }
    toast.success(`${removing.name || removing.email} больше не в команде`);
    setRemoving(null);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {canManage ? (
        <form onSubmit={add} className="grid gap-2 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="email"
            required
            className={inputClass}
            placeholder="Почта сотрудника"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
          <input
            className={inputClass}
            placeholder="Имя (необязательно)"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className={btnPrimary} disabled={adding || !email.trim()}>
            <UserPlus className="size-4" />
            {adding ? "Добавляем…" : "Добавить"}
          </button>
          <p className="text-[12px] leading-[1.5] text-[#6f7282] md:col-span-3">
            Если у человека уже есть аккаунт WeSetup — он получит доступ к кабинету сразу. Если нет — мы создадим аккаунт и
            отправим письмо с установкой пароля.
          </p>
        </form>
      ) : null}

      <ul className="divide-y divide-[#f0f1f7] rounded-2xl border border-[#ececf4]">
        {team.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eef1ff] text-[14px] font-semibold text-[#3848c7]">
              {(m.name || m.email).slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-[#0b1024]">{m.name || m.email}</span>
                {m.role === "owner" ? <Crown className="size-3.5 text-[#e0a100]" aria-label="Владелец" /> : null}
                {m.userId === meUserId ? <Pill tone="indigo">это вы</Pill> : null}
                {!m.isActive ? <Pill tone="danger">заблокирован</Pill> : null}
              </div>
              <div className="truncate text-[12px] text-[#6f7282]">
                {m.email} · в команде с {formatDate(m.since)}
                {m.lastLoginAt ? ` · был ${formatDateTime(m.lastLoginAt)}` : " · ещё не входил"}
              </div>
            </div>
            <Pill tone={m.role === "owner" ? "indigo" : "neutral"}>{m.role === "owner" ? "Владелец" : "Сотрудник"}</Pill>
            {canManage && m.role !== "owner" ? (
              <button
                type="button"
                onClick={() => setRemoving(m)}
                className="rounded-xl p-2 text-[#9b9fb3] transition-colors hover:bg-[#fff4f2] hover:text-[#a13a32]"
                title="Убрать из команды"
                aria-label="Убрать из команды"
              >
                <UserMinus className="size-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        variant="danger"
        title={`Убрать ${removing?.name || removing?.email || ""} из команды?`}
        description="Аккаунт WeSetup у человека останется — пропадёт только доступ к партнёрскому кабинету и кабинетам клиентов."
        confirmLabel="Убрать"
      />
    </div>
  );
}
