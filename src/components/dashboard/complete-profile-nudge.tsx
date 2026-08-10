"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Sparkles, X } from "lucide-react";

const DISMISS_KEY = "wesetup.complete-profile-dismissed";

const ORG_TYPES = [
  { value: "restaurant", label: "Ресторан / кафе" },
  { value: "meat", label: "Мясная продукция" },
  { value: "dairy", label: "Молочная продукция" },
  { value: "bakery", label: "Хлебобулочные изделия" },
  { value: "confectionery", label: "Кондитерские изделия" },
  { value: "other", label: "Другое" },
];

/**
 * Ненавязчивое напоминание заполнить анкету после мгновенной
 * регистрации.
 *
 * Аккаунт создаётся по одной почте, поэтому данные организации и
 * контакты собираются уже внутри кабинета — здесь. Баннер закрывается
 * на текущую сессию: возвращается при следующем входе, но не мешает
 * работать прямо сейчас.
 *
 * Сразу после регистрации (`?welcome=1`) модалка открывается сама —
 * это единственный авто-показ, дальше только баннер.
 */
export function CompleteProfileNudge({ email }: { email: string }) {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [hidden, setHidden] = useState(false);
  // Сразу после регистрации модалку открываем без задержки — значение
  // известно уже на первом рендере, эффект тут не нужен.
  const [open, setOpen] = useState(welcome);

  useEffect(() => {
    if (welcome) return;
    // sessionStorage читаем только после гидратации, иначе разъедется
    // серверная и клиентская разметка. Состояние ставим в микротаске —
    // синхронный setState в теле эффекта даёт лишний каскад рендеров.
    let cancelled = false;
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY)) {
        queueMicrotask(() => {
          if (!cancelled) setHidden(true);
        });
      }
    } catch {
      /* sessionStorage недоступен — просто показываем баннер */
    }
    return () => {
      cancelled = true;
    };
  }, [welcome]);

  function dismiss() {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* не смогли запомнить — скроем только до перезагрузки */
    }
    setHidden(true);
  }

  return (
    <>
      {!hidden ? (
        <div className="flex items-center gap-3 bg-[#5566f6] px-4 py-2.5 text-white md:px-6">
          <Sparkles className="size-4 shrink-0" />
          <p className="min-w-0 flex-1 text-[13px] leading-[1.45]">
            <span className="font-medium">Завершите регистрацию:</span>{" "}
            <span className="text-white/85">
              подтвердите почту и заполните данные организации — они идут в
              шапку журналов и PDF для проверок.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-xl bg-white/15 px-3 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/25"
          >
            Завершить
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Скрыть до следующего входа"
            className="shrink-0 rounded-lg p-1 text-white/70 transition-colors hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {open ? (
        <CompleteProfileModal
          email={email}
          welcome={welcome}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function CompleteProfileModal({
  email,
  welcome,
  onClose,
}: {
  email: string;
  welcome: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [organizationType, setOrganizationType] = useState("restaurant");
  const [inn, setInn] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function sendCode() {
    setError(null);
    setSending(true);
    try {
      const res = await fetch("/api/profile/complete/send-code", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось отправить код");
        return;
      }
      setCodeSent(true);
      toast.success(`Код отправлен на ${email}`);
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз");
    } finally {
      setSending(false);
    }
  }

  async function lookupInn() {
    setError(null);
    try {
      const res = await fetch(`/api/public/inn-lookup?inn=${inn}`);
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Не нашли по ИНН");
        return;
      }
      if (data.name) setOrganizationName(data.name);
    } catch {
      setError("Ошибка проверки ИНН");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          organizationName,
          organizationType,
          inn: inn || undefined,
          name,
          phone,
          newPassword: newPassword || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить");
        return;
      }
      toast.success("Регистрация завершена");
      onClose();
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b1024]/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-[480px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_30px_80px_-30px_rgba(11,16,36,0.6)]">
        <div className="shrink-0 border-b border-[#ececf4] px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
                {welcome ? "Аккаунт создан!" : "Завершите регистрацию"}
              </h2>
              <p className="mt-1 text-[13px] leading-[1.5] text-[#6f7282]">
                {welcome ? (
                  <>
                    Пароль отправлен на <strong>{email}</strong>. Осталось
                    подтвердить почту и заполнить данные организации.
                  </>
                ) : (
                  <>
                    Данные организации попадают в шапку журналов и PDF для
                    проверок — без них выгрузка будет неполной.
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[#9b9fb3] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024]"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col"
          id="complete-profile-form"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <Field
              id="cp-org"
              label="Название организации"
              value={organizationName}
              onChange={setOrganizationName}
              placeholder="ООО «Вкусный дом»"
              required
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr]">
              <div>
                <span className="mb-1.5 block text-[13px] font-medium text-[#0b1024]">
                  Тип организации
                </span>
                <select
                  value={organizationType}
                  onChange={(e) => setOrganizationType(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-3 text-[15px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                >
                  {ORG_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Field
                  id="cp-inn"
                  label="ИНН"
                  value={inn}
                  onChange={setInn}
                  placeholder="опционально"
                  inputMode="numeric"
                />
                {/^\d{10}$|^\d{12}$/.test(inn) ? (
                  <button
                    type="button"
                    onClick={lookupInn}
                    className="text-[12px] font-medium text-[#3848c7] hover:underline"
                  >
                    Подтянуть название по ИНН
                  </button>
                ) : null}
              </div>
            </div>

            <Field
              id="cp-name"
              label="Ваше имя"
              value={name}
              onChange={setName}
              placeholder="Иван Петров"
              autoComplete="name"
              required
            />
            <Field
              id="cp-phone"
              label="Телефон"
              value={phone}
              onChange={setPhone}
              placeholder="+7 999 123-45-67"
              type="tel"
              autoComplete="tel"
              helper="Нужен, чтобы связать аккаунт с задачами в TasksFlow."
              required
            />
            <Field
              id="cp-password"
              label="Новый пароль"
              value={newPassword}
              onChange={setNewPassword}
              placeholder="Необязательно"
              type="password"
              autoComplete="new-password"
              helper="Оставьте пустым, если пароль из письма вас устраивает."
            />

            <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4">
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#0b1024]">
                <CheckCircle2 className="size-4 text-[#5566f6]" />
                Подтверждение почты
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-[#6f7282]">
                Отправим код на {email} — так мы убедимся, что письма до вас
                доходят.
              </p>
              {codeSent ? (
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6 цифр из письма"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  className="mt-3 h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-center text-[18px] tracking-[0.4em] text-[#0b1024] placeholder:tracking-normal placeholder:text-[15px] placeholder:text-[#c1c5d6] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                />
              ) : (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={sending}
                  className="mt-3 inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Отправляем…
                    </>
                  ) : (
                    "Отправить код"
                  )}
                </button>
              )}
            </div>

            {error ? (
              <p className="rounded-2xl bg-[#fff4f2] px-4 py-3 text-[13px] text-[#a13a32]">
                {error}
              </p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-[#ececf4] px-6 py-4">
            <button
              type="submit"
              disabled={saving || !codeSent}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[15px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Сохраняем…
                </>
              ) : (
                "Готово"
              )}
            </button>
            {!codeSent ? (
              <p className="mt-2 text-center text-[12px] text-[#9b9fb3]">
                Сначала запросите код подтверждения почты
              </p>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  inputMode,
  helper,
  required,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "tel" | "email";
  helper?: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-[#0b1024]">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        required={required}
        className="h-11 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#c1c5d6] transition-[border-color,box-shadow] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
      />
      {helper ? (
        <span className="mt-1 block text-[11px] leading-snug text-[#6f7282]">
          {helper}
        </span>
      ) : null}
    </label>
  );
}
