"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import {
  HARDWARE_DEVICES,
  type HardwareDevice,
} from "@/lib/hardware-pricing";
import { ROBOKASSA_IFRAME_SCRIPT_URL } from "@/lib/robokassa-constants";
import type { Tariff } from "@/lib/tariffs";
import {
  RECURRING_CONSENT_TEXT,
  RECURRING_OFFER_HREF,
  RECURRING_PERIOD_TEXT,
} from "@/lib/recurring-consent";

type ReturnParams = {
  outSum: string;
  invId: string;
  signature: string;
  completeToken: string;
};

type OrderStatus = {
  invId: number;
  status: string;
  email: string;
  amountRub: number;
  description: string;
  isTest: boolean;
  needsCompletion: boolean;
};

declare global {
  interface Window {
    Robokassa?: { StartPayment: (params: Record<string, string>) => void };
  }
}

function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

/**
 * Одна страница на три состояния, потому что кабинет Робокассы принимает
 * ровно один SuccessURL/FailURL:
 *
 *   1. checkout — пришли с лендинга по /order?plan=…, спрашиваем почту
 *      и открываем оплату в iFrame;
 *   2. возврат после оплаты — Робокасса вернула OutSum/InvId/Signature,
 *      поллим статус (вебхук может прийти на секунду позже) и, если это
 *      новый клиент, показываем форму достройки профиля;
 *   3. переход по ссылке из письма — ?complete=<токен>, сразу форма.
 *
 * Отдельного «fail»-состояния в query нет: если валидной подписи нет,
 * а заказ не оплачен — показываем экран неудачи с возвратом к оплате.
 */
export function OrderClient({
  tariff,
  bundleConfig,
  amountRub,
  returnParams,
  sessionEmail = "",
  recurringDefault = false,
}: {
  tariff: Tariff | null;
  bundleConfig: Record<string, number> | null;
  amountRub: number;
  returnParams: ReturnParams;
  /// Почта вошедшего пользователя — подставляем, чтобы не спрашивать её
  /// второй раз сразу после регистрации.
  sessionEmail?: string;
  /// Пришли по кнопке «Включить автопродление» — галочка уже отмечена.
  /// Это не нарушает требование Робокассы «не проставлено по умолчанию»:
  /// человек сам нажал кнопку с этим смыслом, а снять отметку он может.
  recurringDefault?: boolean;
}) {
  const isReturn = Boolean(
    (returnParams.invId && returnParams.signature) || returnParams.completeToken,
  );
  return isReturn ? (
    <ReturnFlow params={returnParams} />
  ) : (
    <Checkout
      tariff={tariff}
      bundleConfig={bundleConfig}
      amountRub={amountRub}
      sessionEmail={sessionEmail}
      recurringDefault={recurringDefault}
    />
  );
}

/* ---------------------------------------------------------------- checkout */

function Checkout({
  tariff,
  bundleConfig,
  amountRub,
  sessionEmail,
  recurringDefault = false,
}: {
  tariff: Tariff | null;
  bundleConfig: Record<string, number> | null;
  amountRub: number;
  sessionEmail: string;
  recurringDefault?: boolean;
}) {
  const [email, setEmail] = useState(sessionEmail);
  // По умолчанию выключено — этого требует Робокасса: согласие на
  // автосписание человек даёт сам, а не получает вместе с формой.
  const [recurringConsent, setRecurringConsent] = useState(recurringDefault);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scriptReady = useRobokassaScript();
  // Пока клиент платит в iFrame, следим за заказом здесь: возврат на
  // SuccessURL происходит внутри рамки, и внешняя страница иначе так и
  // осталась бы формой оплаты, хотя деньги уже прошли.
  const [watch, setWatch] = useState<{ invId: number; psig: string } | null>(
    null,
  );
  const [paid, setPaid] = useState<OrderStatus | null>(null);

  useEffect(() => {
    if (!watch || paid) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/payments/robokassa/status?invId=${watch.invId}&psig=${encodeURIComponent(watch.psig)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as OrderStatus;
          if (data.status !== "pending") {
            if (!stopped) setPaid(data);
            return;
          }
        }
      } catch {
        /* сеть моргнула — просто пробуем ещё раз */
      }
      if (!stopped) timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 3000);

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [watch, paid]);

  if (paid) {
    return (
      <Card>
        <Paid order={paid} />
        {paid.needsCompletion ? (
          <>
            <p className="mt-4 text-[15px] leading-[1.7] text-[#3c4053]">
              Мы отправили на <strong>{paid.email}</strong> письмо со ссылкой
              для завершения настройки: там нужно задать пароль и название
              организации.
            </p>
            <p className="mt-2 text-[13px] text-[#9b9fb3]">
              Письма нет через 10 минут? Напишите на support@wesetup.ru —
              вышлем ссылку вручную.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 text-[15px] leading-[1.7] text-[#3c4053]">
              Подписка вашей организации продлена. Входите под своей обычной
              учётной записью.
            </p>
            <div className="mt-6">
              <PrimaryLink href="/login">Войти в кабинет</PrimaryLink>
            </div>
          </>
        )}
      </Card>
    );
  }

  if (!tariff) {
    return (
      <Card>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
          Тариф недоступен
        </h1>
        <p className="mt-3 text-[15px] leading-[1.7] text-[#3c4053]">
          Похоже, ссылка устарела. Выберите тариф заново на странице цен.
        </p>
        <div className="mt-6">
          <PrimaryLink href="/pricing">Перейти к тарифам</PrimaryLink>
        </div>
      </Card>
    );
  }

  const items: Array<{ device: HardwareDevice; qty: number }> = bundleConfig
    ? HARDWARE_DEVICES.filter((d) => (bundleConfig[d.id] ?? 0) > 0).map((d) => ({
        device: d,
        qty: bundleConfig[d.id] ?? 0,
      }))
    : [];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/payments/robokassa/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          tariffKey: tariff!.key,
          bundleConfig: bundleConfig ?? undefined,
          recurringConsent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось создать заказ");
        setLoading(false);
        return;
      }
      // iFrame — основной путь; если скрипт не поднялся (блокировщик,
      // офлайн CDN), уводим на обычную форму оплаты, чтобы клиент не
      // упёрся в неработающую кнопку.
      if (scriptReady && window.Robokassa) {
        window.Robokassa.StartPayment(data.params);
        setWatch({ invId: data.invId, psig: data.params.SignatureValue });
        setLoading(false);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз");
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">
        Оформление подписки
      </h1>
      <p className="mt-3 text-[15px] leading-[1.7] text-[#3c4053]">
        {tariff.title} — доступ ко всем 35 журналам СанПиН и ХАССП на{" "}
        {tariff.periodDays} дней.
      </p>

      <div className="mt-6 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] uppercase tracking-[0.14em] text-[#9b9fb3]">
            К оплате
          </span>
          <span className="text-[26px] font-semibold tabular-nums tracking-[-0.01em]">
            {formatRub(amountRub)}
          </span>
        </div>
        {items.length > 0 ? (
          <ul className="mt-4 space-y-1.5 border-t border-[#ececf4] pt-4">
            <li className="flex justify-between gap-3 text-[13px] text-[#3c4053]">
              <span>Подписка на {tariff.periodDays} дн.</span>
              <span className="tabular-nums">{formatRub(tariff.priceRub)}</span>
            </li>
            {items.map(({ device, qty }) => (
              <li
                key={device.id}
                className="flex justify-between gap-3 text-[13px] text-[#3c4053]"
              >
                <span>
                  {device.title}
                  {device.mode === "per-unit" ? ` × ${qty}` : ""}
                </span>
                <span className="tabular-nums">
                  {formatRub(device.price * qty)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <form onSubmit={submit} className="mt-6">
        <label
          htmlFor="order-email"
          className="block text-[13px] font-medium text-[#0b1024]"
        >
          Электронная почта
        </label>
        <p className="mt-1 text-[12px] text-[#9b9fb3]">
          На неё придёт чек и ссылка для входа в кабинет.
        </p>
        <input
          id="order-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.ru"
          className="mt-2 h-12 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[16px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
        />

        {error ? (
          <p className="mt-3 rounded-2xl bg-[#fff4f2] px-4 py-3 text-[13px] text-[#a13a32]">
            {error}
          </p>
        ) : null}

        {/* Автосписания. Галочка НЕ проставлена по умолчанию: без неё
            платёж разовый, и это нормальный путь. Текст согласия и
            периодичность списаний видны здесь же — скрытых платежей быть
            не должно. */}
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-4 py-3">
          <input
            type="checkbox"
            checked={recurringConsent}
            onChange={(event) => setRecurringConsent(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 accent-[#5566f6]"
          />
          <span className="text-[13px] leading-[1.5] text-[#3c4053]">
            {RECURRING_CONSENT_TEXT} (
            <Link
              href={RECURRING_OFFER_HREF}
              target="_blank"
              className="text-[#3848c7] underline"
            >
              раздел 13 оферты
            </Link>
            ).
            <span className="mt-1 block text-[12px] text-[#6f7282]">
              {RECURRING_PERIOD_TEXT}
            </span>
            <span className="mt-1 block text-[12px] text-[#9b9fb3]">
              Без галочки оплата пройдёт разовым платежом — автосписаний не
              будет.
            </span>
          </span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Открываем оплату…
            </>
          ) : (
            <>
              Перейти к оплате
              <ArrowRight className="size-4" />
            </>
          )}
        </button>

        {watch ? (
          <p className="mt-3 flex items-center justify-center gap-2 text-[13px] text-[#6f7282]">
            <Loader2 className="size-3.5 animate-spin text-[#5566f6]" />
            Ждём подтверждение оплаты — страница обновится сама.
          </p>
        ) : null}
      </form>

      <p className="mt-4 flex items-start gap-2 text-[12px] leading-[1.6] text-[#9b9fb3]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#5566f6]" />
        <span>
          Оплата проходит на стороне сервиса «Робокасса», данные карты нам не
          передаются. Нажимая «Перейти к оплате», вы принимаете условия{" "}
          <Link href="/oferta" className="text-[#3848c7]">
            договора-оферты
          </Link>{" "}
          и{" "}
          <Link href="/privacy" className="text-[#3848c7]">
            политики конфиденциальности
          </Link>
          , а также{" "}
          <Link href="/terms" className="text-[#3848c7]">
            пользовательского соглашения
          </Link>{" "}
          и{" "}
          <Link href="/consent" className="text-[#3848c7]">
            согласия на обработку персональных данных
          </Link>
          .
        </span>
      </p>
    </Card>
  );
}

/* ------------------------------------------------------------------ return */

function ReturnFlow({ params }: { params: ReturnParams }) {
  const [order, setOrder] = useState<OrderStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const attempts = useRef(0);

  const query = params.completeToken
    ? `complete=${encodeURIComponent(params.completeToken)}`
    : `OutSum=${encodeURIComponent(params.outSum)}&InvId=${encodeURIComponent(
        params.invId,
      )}&SignatureValue=${encodeURIComponent(params.signature)}`;

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/robokassa/status?${query}`);
      if (!res.ok) {
        setFailed(true);
        return true;
      }
      const data = (await res.json()) as OrderStatus;
      setOrder(data);
      // Вебхук может опоздать на пару секунд — ждём перехода в paid,
      // но не бесконечно: после ~20 попыток показываем «проверьте позже».
      if (data.status === "pending") {
        attempts.current += 1;
        if (attempts.current > 20) {
          setFailed(true);
          return true;
        }
        return false;
      }
      return true;
    } catch {
      attempts.current += 1;
      if (attempts.current > 20) {
        setFailed(true);
        return true;
      }
      return false;
    }
  }, [query]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      const done = await poll();
      if (stopped || done) return;
      timer = setTimeout(tick, 2000);
    };
    void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  if (failed) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <XCircle className="size-7 text-[#a13a32]" />
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
            Оплата не прошла
          </h1>
        </div>
        <p className="mt-3 text-[15px] leading-[1.7] text-[#3c4053]">
          Платёж не подтверждён. Деньги, если они списались, вернутся
          автоматически в течение нескольких дней.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryLink href="/pricing">Попробовать ещё раз</PrimaryLink>
          <a
            href="mailto:support@wesetup.ru"
            className="inline-flex h-12 items-center rounded-2xl border border-[#dcdfed] bg-white px-5 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            Написать в поддержку
          </a>
        </div>
      </Card>
    );
  }

  if (!order || order.status === "pending") {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <Loader2 className="size-6 animate-spin text-[#5566f6]" />
          <h1 className="text-[22px] font-semibold tracking-[-0.01em]">
            Проверяем оплату…
          </h1>
        </div>
        <p className="mt-3 text-[15px] leading-[1.7] text-[#3c4053]">
          Это занимает несколько секунд. Не закрывайте страницу.
        </p>
      </Card>
    );
  }

  if (order.needsCompletion && params.completeToken) {
    return <CompleteForm token={params.completeToken} order={order} />;
  }

  if (order.needsCompletion) {
    // Токен есть в заказе, но в адресе его нет (обычный success-возврат).
    // Ссылка ушла письмом — просим открыть её.
    return (
      <Card>
        <Paid order={order} />
        <p className="mt-4 text-[15px] leading-[1.7] text-[#3c4053]">
          Мы отправили на <strong>{order.email}</strong> письмо со ссылкой для
          завершения настройки: там нужно задать пароль и название организации.
        </p>
        <p className="mt-2 text-[13px] text-[#9b9fb3]">
          Письма нет через 10 минут? Напишите на support@wesetup.ru — вышлем
          ссылку вручную.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <Paid order={order} />
      <p className="mt-4 text-[15px] leading-[1.7] text-[#3c4053]">
        Подписка вашей организации продлена. Входите под своей обычной учётной
        записью.
      </p>
      <div className="mt-6">
        <PrimaryLink href="/login">Войти в кабинет</PrimaryLink>
      </div>
    </Card>
  );
}

function Paid({ order }: { order: OrderStatus }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-7 text-[#116b2a]" />
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
          Оплата получена
        </h1>
      </div>
      <div className="mt-4 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-5 text-[14px] text-[#3c4053]">
        <div className="flex justify-between gap-3">
          <span>{order.description}</span>
          <span className="tabular-nums font-semibold text-[#0b1024]">
            {formatRub(order.amountRub)}
          </span>
        </div>
        <div className="mt-2 text-[12px] text-[#9b9fb3]">
          Заказ №{order.invId}
          {order.isTest ? " · тестовый платёж" : ""}
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- complete */

function CompleteForm({
  token,
  order,
}: {
  token: string;
  order: OrderStatus;
}) {
  const router = useRouter();
  const [organizationName, setOrganizationName] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== password2) {
      setError("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/robokassa/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, organizationName, name, phone, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить данные");
        setLoading(false);
        return;
      }
      // Автологин тем же паролем — клиент не должен вводить его дважды.
      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password }),
      });
      if (login.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      router.push("/login");
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз");
      setLoading(false);
    }
  }

  return (
    <Card>
      <Paid order={order} />
      <h2 className="mt-7 text-[18px] font-semibold tracking-[-0.01em]">
        Завершите настройку
      </h2>
      <p className="mt-2 text-[14px] leading-[1.7] text-[#3c4053]">
        Кабинет для <strong>{order.email}</strong> уже создан. Осталось задать
        пароль и назвать организацию.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field
          id="org"
          label="Название организации"
          value={organizationName}
          onChange={setOrganizationName}
          placeholder="ООО «Ромашка»"
          required
        />
        <Field
          id="name"
          label="Ваше имя"
          value={name}
          onChange={setName}
          placeholder="Иван Иванов"
          required
          autoComplete="name"
        />
        <Field
          id="phone"
          label="Телефон"
          value={phone}
          onChange={setPhone}
          placeholder="+7 999 123-45-67"
          hint="Нужен, чтобы связать аккаунт с задачами в TasksFlow."
          required
          type="tel"
          autoComplete="tel"
        />
        <Field
          id="password"
          label="Пароль"
          value={password}
          onChange={setPassword}
          placeholder="Не короче 6 символов"
          required
          type="password"
          autoComplete="new-password"
        />
        <Field
          id="password2"
          label="Пароль ещё раз"
          value={password2}
          onChange={setPassword2}
          required
          type="password"
          autoComplete="new-password"
        />

        {error ? (
          <p className="rounded-2xl bg-[#fff4f2] px-4 py-3 text-[13px] text-[#a13a32]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Сохраняем…
            </>
          ) : (
            <>
              Войти в кабинет
              <ArrowRight className="size-4" />
            </>
          )}
        </button>
      </form>
    </Card>
  );
}

/* ------------------------------------------------------------------- вспом. */

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-8">
      {children}
    </div>
  );
}

function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-12 items-center gap-2 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(85,102,246,0.65)] transition-colors hover:bg-[#4a5bf0]"
    >
      {children}
      <ArrowRight className="size-4" />
    </Link>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-[#0b1024]">
        {label}
      </label>
      {hint ? <p className="mt-1 text-[12px] text-[#9b9fb3]">{hint}</p> : null}
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-12 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[16px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
      />
    </div>
  );
}

/**
 * Скрипт iFrame-оплаты подгружаем лениво — он нужен только на checkout'е
 * и только по клику, а тянуть внешний файл на каждый рендер страницы
 * возврата незачем.
 */
function useRobokassaScript(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setReady(true);
    };

    // Скрипт мог остаться от предыдущей навигации — тогда просто
    // отмечаем готовность, но уже вне тела эффекта.
    if (window.Robokassa) {
      queueMicrotask(markReady);
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${ROBOKASSA_IFRAME_SCRIPT_URL}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", markReady);
    if (!existing) {
      script.src = ROBOKASSA_IFRAME_SCRIPT_URL;
      script.async = true;
      document.body.appendChild(script);
    }
    return () => {
      cancelled = true;
      script.removeEventListener("load", markReady);
    };
  }, []);

  return ready;
}
