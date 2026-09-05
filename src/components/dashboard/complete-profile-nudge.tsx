"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { NumberStepper } from "@/components/ui/number-stepper";
import { TasksFlowPromoHint } from "@/components/tasksflow/tasksflow-promo-hint";
import {
  MAX_LOCATIONS,
  ORG_OWNERSHIP,
  ORG_SPHERES,
  normalizeSphere,
} from "@/lib/org-profile";
import { suggestPassword } from "@/lib/password-suggest";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  DEFAULT_OWNER_POSITION,
  OWNER_POSITION_CATEGORY,
  positionSuggestionsFor,
} from "@/lib/sphere-positions";

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
 * наверху, помечены красной точкой. Всё остальное человек дозаполнит в
 * настройках, и держать его на пути к первому журналу незачем.
 *
 * Раскладка рассчитана на первый экран телефона без прокрутки: поля
 * стоят парами по смыслу («Сфера · Тип», «Точек · ИНН», «Имя · Пароль»),
 * галочка сотрудника и должность — в одной строке, промо TasksFlow —
 * под телефоном, кнопки футера — в один ряд.
 *
 * Пароль подставляется сам (6 знаков, см. `suggestPassword`) и виден
 * открытым текстом: человек либо запоминает его, либо перегенерирует
 * кнопкой, либо печатает свой. При сохранении он же уходит на почту —
 * пароль из письма о регистрации после этого не подходит.
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
  // Фон под анкетой не должен прокручиваться (на iOS body.overflow не помогает).
  useBodyScrollLock(true);

  const [organizationName, setOrganizationName] = useState("");
  const [phone, setPhone] = useState("");
  const [sphere, setSphere] = useState("restaurant");
  const [ownershipKind, setOwnershipKind] = useState("private");
  const [locationsCount, setLocationsCount] = useState(1);
  const [inn, setInn] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [asEmployee, setAsEmployee] = useState(true);
  const [positionName, setPositionName] = useState(DEFAULT_OWNER_POSITION);

  // Пароль генерируем после монтирования, а не в инициализаторе state:
  // модалка рендерится и на сервере (`?welcome=1`), и случайное значение
  // на сервере и клиенте разошлось бы при гидратации.
  useEffect(() => {
    setNewPassword((current) => current || suggestPassword());
  }, []);

  // Подсказки идут за сферой: у производства и столовой свой «директор».
  const positionOptions = useMemo(
    () =>
      positionSuggestionsFor(
        normalizeSphere(sphere),
        OWNER_POSITION_CATEGORY,
        [],
      ),
    [sphere],
  );

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const nameOk = organizationName.trim().length >= 2;
  const phoneOk = phoneLooksValid(phone);
  const passwordOk = newPassword.trim().length === 0 || newPassword.trim().length >= 6;
  const busy = saving || demoLoading;
  const canSubmit = nameOk && phoneOk && passwordOk && !busy;

  // Чего не хватает — говорим прямо под кнопкой. Нативные тултипы
  // браузера («Вы пропустили это поле») выключены: они появляются
  // только по клику и выглядят чужеродно.
  const missing = [
    !nameOk ? "название организации" : null,
    !phoneOk ? "телефон" : null,
    !passwordOk ? "пароль от 6 знаков" : null,
  ].filter(Boolean) as string[];

  /**
   * Сохраняет анкету в свою организацию. Без закрытия модалки и refresh —
   * это делает вызывающий: «Готово» просто закрывает, а «демо» после
   * сохранения ещё создаёт демо-организацию и уводит в неё.
   */
  async function saveProfile(): Promise<boolean> {
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
          asEmployee,
          positionName: asEmployee ? positionName.trim() : "",
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Не удалось сохранить");
      return true;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось сохранить",
      );
      return false;
    }
  }

  const savedMessage = newPassword.trim()
    ? "Готово. Данные сохранены, пароль для входа отправили на почту"
    : "Готово. Данные организации сохранены";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    try {
      if (!(await saveProfile())) return;
      toast.success(savedMessage);
      onClose();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Анкета сохраняется в СВОЮ организацию до создания демо — иначе
   * `/api/profile/complete` (пишет в активную org) переименовал бы демо,
   * а анкета всплыла бы внутри песочницы ещё раз.
   */
  async function submitWithDemo() {
    if (!canSubmit) return;
    setDemoLoading(true);
    try {
      if (!(await saveProfile())) return;
      const res = await fetch("/api/organizations/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sphere }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || "Не удалось создать демо");
      }
      toast.success("Демо-организация готова");
      onClose();
      router.push("/dashboard?welcome-demo=1");
      router.refresh();
    } catch (err) {
      // Анкета уже сохранена — закрываем модалку, человек остаётся у себя.
      toast.error(
        err instanceof Error ? err.message : "Не удалось создать демо",
      );
      onClose();
      router.refresh();
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0b1024]/45 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-profile-title"
    >
      {/* dvh, а не vh: на iPhone Safari vh считается без учёта панелей
          браузера, и низ модалки уезжал под нижнюю панель. */}
      <div className="flex max-h-[94dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_40px_100px_-40px_rgba(11,16,36,0.6)]">
        <div className="flex shrink-0 items-start gap-3 border-b border-[#eef0f6] px-4 py-3.5 sm:p-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="complete-profile-title"
              className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]"
            >
              {welcome ? "Аккаунт создан!" : "Завершите регистрацию"}
            </h2>
            <p className="mt-0.5 text-[12px] leading-snug text-[#6f7282]">
              Логин: <span className="text-[#3c4053]">{email}</span>
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
          className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4 sm:space-y-3 sm:p-5"
        >
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
              className={CONTROL_CLASS}
            />
          </Field>

          {/* Телефон занимает ровно свою ширину — в российском номере
              11 цифр, растягивать поле на всю строку незачем. Рядом (на
              телефоне — строкой под ним) узкое промо TasksFlow: место, где
              человек вводит номер, — единственное, где реклама автосвязки
              уместна, потому что связывает аккаунты именно номер.

              Промо вынесено из <Field>: внутри <label> ссылка и кнопка
              «скопировать» перехватывались бы фокусом инпута. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <Field
              label="Телефон"
              required
              className="sm:w-[188px] sm:shrink-0"
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
                className={CONTROL_CLASS}
              />
            </Field>

            <TasksFlowPromoHint
              campaign="register_nudge"
              compact
              className="min-w-0 flex-1"
            />
          </div>

          {/* Тот, кто завёл организацию, — тоже сотрудник, и без должности
              он висит в команде безымянной строкой. Галочка и должность в
              одной строке: по умолчанию «да», «Директор» — верно для
              большинства, а снять галочку дешевле, чем искать экран. */}
          <div className="flex items-stretch gap-2">
            <label
              title="Появитесь в списке команды с должностью и сможете подтверждать заполненные журналы"
              className={`flex cursor-pointer items-center gap-2 rounded-2xl border px-3 transition-colors ${
                asEmployee
                  ? "shrink-0 border-[#5566f6]/40 bg-[#f5f6ff]"
                  : "min-w-0 flex-1 border-[#dcdfed] bg-white py-3"
              }`}
            >
              <input
                type="checkbox"
                checked={asEmployee}
                onChange={(e) => setAsEmployee(e.target.checked)}
                className="size-4 shrink-0 cursor-pointer accent-[#5566f6]"
              />
              <span className="whitespace-nowrap text-[14px] font-medium text-[#0b1024]">
                Я сотрудник
              </span>
              {!asEmployee ? (
                <span className="truncate text-[12px] text-[#6f7282]">
                  без должности в команде
                </span>
              ) : null}
            </label>

            {asEmployee ? (
              <Field label="Должность" className="min-w-0 flex-1">
                <input
                  value={positionName}
                  onChange={(e) => setPositionName(e.target.value)}
                  list="owner-position-suggestions"
                  maxLength={120}
                  placeholder={DEFAULT_OWNER_POSITION}
                  className={CONTROL_CLASS}
                />
                <datalist id="owner-position-suggestions">
                  {positionOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </Field>
            ) : null}
          </div>

          {/* Остальное необязательно и стоит парами по смыслу, чтобы анкета
              помещалась в первый экран телефона. */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Сфера">
              <SelectShell>
                <select
                  value={sphere}
                  onChange={(e) => setSphere(e.target.value)}
                  className={SELECT_CLASS}
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
                  className={SELECT_CLASS}
                >
                  {ORG_OWNERSHIP.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </SelectShell>
            </Field>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-2">
            <Field label="Точек" plain>
              {/* -my-1: кнопки счётчика 32px, а строка значения в соседних
                  полях 24px — вытягиваем поле до общей высоты, зона нажатия
                  остаётся 32px. */}
              <span className="-my-1 block">
                <NumberStepper
                  value={locationsCount}
                  onChange={setLocationsCount}
                  min={1}
                  max={MAX_LOCATIONS}
                  ariaLabel="Количество точек"
                />
              </span>
            </Field>

            <Field label="ИНН">
              <input
                value={inn}
                onChange={(e) => setInn(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="7701234567"
                maxLength={12}
                className={CONTROL_CLASS}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Ваше имя">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Мария Иванова"
                maxLength={100}
                className={CONTROL_CLASS}
              />
            </Field>

            {/* Пароль виден открытым текстом: его нужно запомнить или
                записать. Кнопка справа подбирает другой; можно и напечатать
                свой — от 6 знаков. */}
            <Field
              label="Пароль для входа"
              error={
                touched.password && !passwordOk ? "Минимум 6 знаков" : null
              }
            >
              <span className="flex items-center gap-1">
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  type="text"
                  autoComplete="new-password"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={200}
                  className={`${CONTROL_CLASS} font-mono tracking-[0.08em]`}
                />
                <button
                  type="button"
                  onClick={() => setNewPassword(suggestPassword())}
                  aria-label="Подобрать другой пароль"
                  title="Другой пароль"
                  className="-my-0.5 -mr-1.5 flex size-7 shrink-0 items-center justify-center rounded-lg text-[#5566f6] transition-colors hover:bg-[#eef1ff] hover:text-[#3848c7]"
                >
                  <RefreshCw className="size-3.5" />
                </button>
              </span>
            </Field>
          </div>

          {/* Единственное, что нельзя не сказать: вторую точку человек
              сам не создаст. Остальные пояснения ушли. */}
          {locationsCount > 1 ? (
            <p className="text-[12px] leading-snug text-[#6f7282]">
              Остальные точки создадим после настройки первой — напишем вам.
            </p>
          ) : null}
        </form>

        <div className="shrink-0 border-t border-[#eef0f6] p-4 sm:p-5">
          {/* Обе кнопки в один ряд: «Готово» и та же «Готово», но дальше — в
              отдельную демо-организацию с сотрудниками и заполненными
              журналами. Активны по одним условиям: анкета сохраняется первой. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="submit"
              form="complete-profile-form"
              disabled={!canSubmit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] text-[15px] font-semibold text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#c9cef7] disabled:shadow-none"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Готово
            </button>
            <button
              type="button"
              onClick={submitWithDemo}
              disabled={!canSubmit}
              data-testid="complete-profile-demo"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:cursor-not-allowed disabled:border-[#eef0f6] disabled:text-[#9b9fb3] disabled:hover:bg-white"
            >
              {demoLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin text-[#5566f6]" />
                  Готовим…
                </>
              ) : (
                <>
                  <Sparkles className="size-4 text-[#5566f6]" />
                  Показать демо
                </>
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] leading-snug text-[#6f7282]">
            Демо — отдельная организация с примерами на 7 дней.
          </p>

          <div className="mt-1.5 flex items-center justify-center gap-1.5 text-[12px]">
            {missing.length === 0 ? (
              <>
                <CheckCircle2 className="size-3.5 text-[#116b2a]" />
                <span className="text-[#116b2a]">Всё заполнено</span>
              </>
            ) : (
              <span className="text-[#9b9fb3]">
                Осталось: {missing.join(", ")}
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
//
// Контролы — без своей рамки: рамку и фокус-кольцо рисует `Field`
// вокруг подписи и значения. Иначе внутри поля видна вторая
// скруглённая область.
const CONTROL_CLASS =
  "h-6 w-full border-0 bg-transparent p-0 text-[16px] leading-6 text-[#0b1024] placeholder:text-[#c1c5d6] focus:outline-none focus:ring-0";

const SELECT_CLASS = `${CONTROL_CLASS} appearance-none truncate pr-6`;

/** Обёртка нативного select со стрелкой — как в форме настроек. */
function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative block">
      {children}
      <ChevronDown className="pointer-events-none absolute right-0 top-1/2 size-4 -translate-y-1/2 text-[#9b9fb3]" />
    </span>
  );
}

/**
 * Поле с подписью внутри рамки.
 *
 * Подпись стоит там же, где обычно живёт плейсхолдер, но не исчезает
 * при вводе: заполнив анкету наполовину, человек всё ещё видит, что
 * это за поле. Заодно форма стала на строку короче каждого поля — на
 * ноутбуке она помещалась впритык.
 *
 * Рамка и фокус-кольцо принадлежат этому контейнеру (`focus-within`), а
 * не самому контролу — иначе внутри было бы две рамки.
 */
function Field({
  label,
  required,
  error,
  plain = false,
  className = "",
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  /**
   * Обернуть в <div>, а не в <label>. Нужно, когда внутри не один
   * инпут, а группа контролов (счётчик «−/значение/+»): <label>
   * форвардит и :hover, и клик на свой первый контрол, поэтому наводка
   * куда угодно по полю подсвечивала кнопку «−», а клик по подписи её
   * нажимал. Контролы внутри подписаны своим aria-label.
   */
  plain?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const Tag = plain ? "div" : "label";
  return (
    <Tag className={`block ${className}`}>
      <span
        className={`flex flex-col gap-0.5 rounded-2xl border bg-white px-3.5 py-2 transition-[border-color,box-shadow] focus-within:ring-4 ${
          error
            ? "border-[#ff8d7d] focus-within:border-[#d2453d] focus-within:ring-[#d2453d]/15"
            : "border-[#dcdfed] focus-within:border-[#5566f6] focus-within:ring-[#5566f6]/15"
        }`}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium leading-none text-[#6f7282]">
          {label}
          {required ? (
            <span className="size-1.5 rounded-full bg-[#d2453d]" aria-hidden />
          ) : null}
        </span>
        {children}
      </span>
      {error ? (
        <span className="mt-1 block text-[12px] text-[#d2453d]">{error}</span>
      ) : null}
    </Tag>
  );
}
