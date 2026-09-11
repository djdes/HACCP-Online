"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck, Send, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Card, Field, Pill, btnOutline, btnPrimary, inputClass, readError } from "@/components/partner/ui";
import type { ClientHandoverState } from "@/lib/partners/client-organizations";
import { phoneInputProps } from "@/lib/phone-input";
import { cn } from "@/lib/utils";

/**
 * Передача организации клиенту.
 *
 * Организацию можно завести без владельца, настроить её целиком и
 * передать позже: ровно так работает консультант, который приходит в
 * заведение раньше, чем у него появляется почта директора.
 *
 * Три состояния — владельца нет, приглашение отправлено, приглашение
 * истекло — и один и тот же роут на все переходы. Телефон владельца
 * просим не для галочки: без него человек при первом входе увидит
 * анкету регистрации поверх уже настроенного кабинета.
 */

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ClientHandoverCard({
  organizationId,
  handover,
}: {
  organizationId: string;
  handover: ClientHandoverState;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(handover.ownerEmail ?? "");
  const [name, setName] = useState(handover.ownerName ?? "");
  const [phone, setPhone] = useState("");

  if (handover.status === "owned") return null;

  const canResend =
    !handover.canResendAt || new Date(handover.canResendAt) <= new Date();

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/partner/clients/${organizationId}/owner`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, phone: phone || null }),
      });
      if (!res.ok) {
        toast.error(await readError(res, "Не удалось отправить приглашение"));
        return;
      }
      toast.success(`Приглашение отправлено на ${email}`);
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Владелец"
      eyebrow="Передача клиенту"
      actions={
        handover.status === "no_owner" ? (
          <Pill tone="warn">не передана</Pill>
        ) : handover.status === "invite_expired" ? (
          <Pill tone="danger">ссылка истекла</Pill>
        ) : (
          <Pill tone="indigo">приглашение отправлено</Pill>
        )
      }
    >
      {handover.status === "no_owner" ? (
        <p className="text-[13px] leading-[1.55] text-[#3c4053]">
          Организация пока только ваша: настраивайте журналы, должности и сотрудников. Когда всё готово —
          отправьте приглашение владельцу, он задаст пароль и станет руководителем. Подписку с этого момента
          оплачивает он.
        </p>
      ) : (
        <dl className="space-y-2 text-[14px]">
          <div className="flex gap-2">
            <dt className="w-[112px] shrink-0 text-[#6f7282]">Кому</dt>
            <dd className="min-w-0 break-words text-[#0b1024]">
              {handover.ownerName}
              <span className="block text-[13px] text-[#6f7282]">{handover.ownerEmail}</span>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-[112px] shrink-0 text-[#6f7282]">Отправлено</dt>
            <dd className="text-[#0b1024]">{formatDateTime(handover.invitedAt)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-[112px] shrink-0 text-[#6f7282]">
              {handover.status === "invite_expired" ? "Истекла" : "Действует до"}
            </dt>
            <dd className="text-[#0b1024]">{formatDateTime(handover.expiresAt)}</dd>
          </div>
        </dl>
      )}

      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="mt-4 space-y-3"
        >
          <Field label="Почта владельца" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="director@example.ru"
              maxLength={160}
            />
          </Field>
          <Field label="Имя" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Иван Петров"
              maxLength={120}
            />
          </Field>
          <Field
            label="Телефон"
            optional
            hint="Без него при первом входе клиент увидит анкету регистрации поверх готового кабинета"
          >
            <input {...phoneInputProps} value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={cn(btnPrimary, "disabled:opacity-50")}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Отправить приглашение
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btnOutline}>
              Отмена
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {/* Кнопку не блокируем даже во время «остывания»: через неё же
              исправляют опечатку в адресе, а на другой адрес письмо
              уходит сразу. Повтор на тот же адрес отклонит сервер. */}
          <button type="button" onClick={() => setOpen(true)} className={btnPrimary}>
            {handover.status === "no_owner" ? (
              <>
                <UserPlus className="size-4" />
                Передать клиенту
              </>
            ) : (
              <>
                <MailCheck className="size-4" />
                Отправить ещё раз
              </>
            )}
          </button>
        </div>
      )}

      {handover.status === "invited" && !canResend && !open ? (
        <p className="mt-2 text-[12px] text-[#9b9fb3]">
          Повторно отправить можно после {formatDateTime(handover.canResendAt)}. Опечатались в адресе — откройте
          форму и укажите другой, ограничение на это не действует.
        </p>
      ) : null}
    </Card>
  );
}
