"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, Loader2, Sparkles, X } from "lucide-react";
import { NumberStepper } from "@/components/ui/number-stepper";
import { TasksFlowPromoHint } from "@/components/tasksflow/tasksflow-promo-hint";
import {
  MAX_LOCATIONS,
  ORG_OWNERSHIP,
  ORG_SPHERES,
} from "@/lib/org-profile";

const DISMISS_KEY = "wesetup.complete-profile-dismissed";

/**
 * Напоминание заполнить анкету после мгновенной регистрации.
 *
 * Аккаунт создаётся по одной почте, поэтому данные организации
 * собираются уже внутри кабинета. Баннер закрывается на текущую
 * сессию: возвращается при следующем входе, но не мешает работать
 * прямо сейчас.
 *
 * Сразу после регистрации (`?welcome=1`) модалка открывается сама —
 * это единственный авто-показ, дальше только баннер.
 */
export function CompleteProfileNudge({ email }: { email: string }) {
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome") === "1";

  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(welcome);

  useEffect(() => {
    if (welcome) return;
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
              название организации и телефон — они идут в шапку журналов и
              PDF для проверок.
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

/** Телефон считаем годным, если в нём 11 цифр и он начинается с 7/8. */
function phoneLooksValid(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 11 && /^[78]/.test(digits);
}

/**
 * Анкета. Обязательны только название организации и телефон — они
 * наверху, отдельной группой. Всё остальное человек дозаполнит в
 * настройках, и держать его на пути к первому журналу незачем.
 *
 * Подтверждения почты здесь больше нет: оно блокировало «Готово» до
 * похода в почтовый ящик. Переехало в /settings.
 */
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
  const [phone, setPhone] = useState("");
  const [sphere, setSphere] = useState("restaurant");
  const [ownershipKind, setOwnershipKind] = useState("private");
  const [locationsCount, setLocationsCount] = useState(1);
  const [inn, setInn] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const nameOk = organizationName.trim().length >= 2;
  const phoneOk = phoneLooksValid(phone);
  const canSubmit = nameOk && phoneOk && !saving;

  // Чего не хватает — говорим прямо под кнопкой. Нативные тултипы
  // браузера («Вы пропустили это поле») выключены: они появляются
  // только по клику и выглядят чужеродно.
  const missing = [
    !nameOk ? "название организации" : null,
    !phoneOk ? "телефон" : null,
  ].filter(Boolean) as string[];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: organizationName.trim(),
          phone: phone.trim(),
          sphere,
          ownershipKind,
          locationsCount,
          inn: inn.trim(),
          name: name.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
      toast.success("Готово. Данные организации сохранены");
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось сохранить",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b1024]/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_40px_100px_-40px_rgba(11,16,36,0.6)]">
        <div className="flex shrink-0 items-start gap-3 border-b border-[#eef0f6] p-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              {welcome ? "Аккаунт создан!" : "Завершите регистрацию"}
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-[#6f7282]">
              Пароль отправлен на {email}. Осталось назвать организацию.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="shrink-0 rounded-lg p-1 text-[#9b9fb3] transition-colors hover:text-[#0b1024]"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          id="complete-profile-form"
          noValidate
          onSubmit={submit}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5"
        >
          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9b9fb3]">
              Обязательно
            </div>

            <Field
              label="Название организации"
              required
              error={touched.org && !nameOk ? "Минимум 2 символа" : null}
            >
              <input
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, org: true }))}
                aria-required
                placeholder="ООО «Ромашка»"
                maxLength={200}
                className={inputCls(touched.org && !nameOk)}
              />
            </Field>

            <Field
              label="Телефон"
              required
              error={
                touched.phone && !phoneOk ? "Формат: +7 999 123-45-67" : null
              }
            >
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                aria-required
                inputMode="tel"
                placeholder="+7 999 123-45-67"
                maxLength={40}
                className={inputCls(touched.phone && !phoneOk)}
              />
            </Field>

            {/* Промо вынесено из <Field>: внутри <label> ссылка и кнопка
                «скопировать» перехватывались бы фокусом инпута.
                Организация только что зарегистрирована — интеграции
                TasksFlow у неё заведомо нет, промо показываем всегда. */}
            <TasksFlowPromoHint
              campaign="register_nudge"
              autolinkNote="Если у вас уже есть TasksFlow с этим номером — свяжем аккаунты автоматически."
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-[#eef0f6]" />
            <span className="text-[11px] text-[#9b9fb3]">
              можно заполнить позже
            </span>
            <span className="h-px flex-1 bg-[#eef0f6]" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Сфера">
              <SelectShell>
                <select
                  value={sphere}
                  onChange={(e) => setSphere(e.target.value)}
                  className={selectCls}
                >
                  {ORG_SPHERES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>

            <Field label="Тип">
              <SelectShell>
                <select
                  value={ownershipKind}
                  onChange={(e) => setOwnershipKind(e.target.value)}
                  className={selectCls}
                >
                  {ORG_OWNERSHIP.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>

            <Field label="Точек">
              <NumberStepper
                value={locationsCount}
                onChange={setLocationsCount}
                min={1}
                max={MAX_LOCATIONS}
                ariaLabel="Количество точек"
              />
            </Field>

            <Field label="ИНН" hint="Необязательно">
              <input
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="7701234567"
                maxLength={12}
                className={inputCls(false)}
              />
            </Field>
          </div>

          <p className="text-[12px] leading-snug text-[#6f7282]">
            1 точка = 1 объект со своим списком сотрудников и журналами.
            {locationsCount > 1 ? (
              <>
                {" "}
                Остальные точки создадим после настройки первой — напишем
                вам.
              </>
            ) : null}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ваше имя" hint="Если не указать — возьмём название">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Мария Иванова"
                maxLength={100}
                className={inputCls(false)}
              />
            </Field>

            <Field label="Новый пароль" hint="Необязательно">
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                type="password"
                placeholder="••••••"
                maxLength={200}
                className={inputCls(false)}
              />
            </Field>
          </div>
        </form>

        <div className="shrink-0 border-t border-[#eef0f6] p-5">
          <button
            type="submit"
            form="complete-profile-form"
            disabled={!canSubmit}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[15px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#c9cef7] disabled:shadow-none"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            Готово
          </button>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[12px]">
            {missing.length === 0 ? (
              <>
                <CheckCircle2 className="size-3.5 text-[#116b2a]" />
                <span className="text-[#116b2a]">Всё заполнено</span>
              </>
            ) : (
              <span className="text-[#9b9fb3]">
                Осталось: {missing.join(" и ")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// text-[16px] во всех полях анкеты: ниже 16px iOS Safari зумит
// страницу при фокусе и обратно масштаб не возвращает.
const selectCls =
  "h-11 w-full appearance-none rounded-2xl border border-[#dcdfed] bg-white pl-4 pr-10 text-[16px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15";

function inputCls(invalid: boolean) {
  return `h-11 w-full rounded-2xl border bg-white px-4 text-[16px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:outline-none focus:ring-4 ${
    invalid
      ? "border-[#ff8d7d] focus:border-[#d2453d] focus:ring-[#d2453d]/15"
      : "border-[#dcdfed] focus:border-[#5566f6] focus:ring-[#5566f6]/15"
  }`;
}

/** Обёртка нативного select со стрелкой — как в форме настроек. */
function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative block">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b9fb3]" />
    </span>
  );
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-[#3c4053]">
        {label}
        {required ? (
          <span className="size-1.5 rounded-full bg-[#d2453d]" aria-hidden />
        ) : null}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-[12px] text-[#d2453d]">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[12px] text-[#9b9fb3]">{hint}</span>
      ) : null}
    </label>
  );
}
