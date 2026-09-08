"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Share } from "lucide-react";
import { toast } from "sonner";

import { MINI_SW_SCOPE_PATH } from "@/lib/service-worker-scope";
import {
  pushState,
  readPushEnvironment,
  urlBase64ToUint8Array,
  type PushState,
} from "../_lib/push-support";

/**
 * Уведомления в установленном приложении.
 *
 * Разрешение НИКОГДА не спрашиваем само по себе — только по нажатию.
 * Один отказ на Android необратим из кода: повторный запрос браузер
 * отклоняет молча, и вернуть уведомления можно лишь через настройки
 * сайта, куда обычный человек не пойдёт. Поэтому сначала объясняем,
 * зачем это нужно, и только потом спрашиваем.
 */
export function PushSettings() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState(0);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const sync = useCallback(async () => {
    try {
      const response = await fetch("/api/mini/push", { cache: "no-store" });
      if (!response.ok) {
        setState({ kind: "unsupported" });
        return;
      }
      const data = (await response.json()) as {
        configured: boolean;
        publicKey: string | null;
        devices: number;
      };
      if (!data.configured || !data.publicKey) {
        // Ключи VAPID на сервере не заданы — раздел просто не
        // показываем, вместо кнопки, которая всегда падает.
        setState({ kind: "unsupported" });
        return;
      }
      setPublicKey(data.publicKey);
      setDevices(data.devices);

      const registration =
        "serviceWorker" in navigator
          ? await navigator.serviceWorker.getRegistration(MINI_SW_SCOPE_PATH)
          : null;
      const subscription = registration
        ? await registration.pushManager.getSubscription()
        : null;

      setState(pushState(readPushEnvironment(Boolean(subscription))));
    } catch {
      setState({ kind: "unsupported" });
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  async function enable() {
    if (!publicKey || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Уведомления не разрешены");
        await sync();
        return;
      }

      // `ready` не резолвится никогда, если воркер не зарегистрировался
      // (небезопасный контекст, запрет на данные сайтов). Без гонки с
      // таймаутом кнопка крутилась бы вечно и без объяснений.
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);
      if (!registration) {
        toast.error("Приложение ещё не готово. Обновите страницу и попробуйте снова.");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        // Без этого флага подписаться нельзя: браузеры требуют, чтобы
        // на каждый push человеку показывалось уведомление.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const response = await fetch("/api/mini/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        // Подписку в браузере откатываем: иначе он считает, что мы
        // подписаны, а сервер о нас не знает и слать некуда.
        await subscription.unsubscribe().catch(() => {});
        toast.error("Не удалось включить уведомления");
        return;
      }
      toast.success("Уведомления включены");
    } catch {
      toast.error("Не удалось включить уведомления");
    } finally {
      setBusy(false);
      await sync();
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration(
        MINI_SW_SCOPE_PATH,
      );
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/mini/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => null);
        await subscription.unsubscribe().catch(() => {});
      }
      toast.success("Уведомления выключены");
    } finally {
      setBusy(false);
      await sync();
    }
  }

  if (!state || state.kind === "unsupported") return null;

  return (
    <section className="mini-card p-4">
      <div className="mb-3">
        <div
          className="text-[14px] font-semibold"
          style={{ color: "var(--mini-text)" }}
        >
          Уведомления на телефон
        </div>
        <div
          className="mt-0.5 text-[12px] leading-[1.5]"
          style={{ color: "var(--mini-text-muted)" }}
        >
          Напоминания о незаполненных журналах и задачах смены — прямо на
          экран, без Telegram.
        </div>
      </div>

      {state.kind === "needs_install" ? (
        <div
          className="flex items-start gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] leading-[1.5]"
          style={{
            background: "var(--mini-surface-2)",
            color: "var(--mini-text-muted)",
          }}
        >
          <Share className="mt-0.5 size-4 shrink-0" />
          <span>
            На iPhone уведомления работают только у установленного
            приложения. Нажмите «Поделиться» внизу браузера и выберите «На
            экран «Домой»», потом откройте WeSetup с домашнего экрана.
          </span>
        </div>
      ) : null}

      {state.kind === "blocked" ? (
        <div
          className="rounded-2xl px-3.5 py-3 text-[13px] leading-[1.5]"
          style={{
            background: "var(--mini-surface-2)",
            color: "var(--mini-text-muted)",
          }}
        >
          Уведомления запрещены для сайта. Включить их обратно можно только
          в настройках браузера — в адресной строке нажмите на замок и
          разрешите уведомления.
        </div>
      ) : null}

      {state.kind === "can_enable" ? (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="mini-btn-primary mini-press flex h-12 w-full items-center justify-center gap-2 text-[15px] disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Bell className="size-4" />
          )}
          Включить уведомления
        </button>
      ) : null}

      {state.kind === "enabled" ? (
        <>
          <button
            type="button"
            onClick={disable}
            disabled={busy}
            className="mini-press flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-medium disabled:opacity-50"
            style={{
              background: "var(--mini-surface-2)",
              border: "1px solid var(--mini-divider)",
              color: "var(--mini-text)",
            }}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <BellOff className="size-4" />
            )}
            Выключить на этом устройстве
          </button>
          {devices > 1 ? (
            <p
              className="mt-2 text-[12px]"
              style={{ color: "var(--mini-text-muted)" }}
            >
              Уведомления приходят ещё на {devices - 1}{" "}
              {devices - 1 === 1 ? "устройство" : "устройства"}.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
