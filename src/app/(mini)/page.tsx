"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { getTelegramWebApp } from "./_components/telegram-web-app";

type LocalState =
  | { kind: "init" }
  | { kind: "no-telegram" }
  | { kind: "error"; message: string };

/**
 * Mini App root screen — Stage 1 stub.
 *
 * Flow:
 *   1. If NextAuth already reports `authenticated` we greet the user and
 *      stop — session cookie is authoritative.
 *   2. Otherwise, on the first `unauthenticated` tick, read
 *      `window.Telegram.WebApp.initData`. If absent the user opened `/mini`
 *      in a plain browser — show the "только в Telegram" hint.
 *   3. With initData in hand call `signIn("telegram", { initData })`.
 *      On success NextAuth flips session status and we render the greeting.
 *
 * We derive the "authed" branch directly from `session` instead of mirroring
 * it into local state — that avoids the React-hooks `no-set-state-in-effect`
 * antipattern and keeps the render cheap.
 */
export default function MiniRootPage() {
  const { data: session, status } = useSession();
  const [localState, setLocalState] = useState<LocalState>({ kind: "init" });
  const signInStarted = useRef(false);

  useEffect(() => {
    if (status !== "unauthenticated" || signInStarted.current) return;

    const webApp = getTelegramWebApp();
    if (!webApp || !webApp.initData) {
      signInStarted.current = true;
      // React 19 `no-set-state-in-effect` wants pure derivation, but the
      // value here depends on `window.Telegram`, which isn't available
      // during SSR — the effect is where we can safely read it. We latch
      // the result with `signInStarted` so this runs once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalState({ kind: "no-telegram" });
      return;
    }

    try {
      webApp.ready();
      webApp.expand();
    } catch {
      /* older TG clients don't expose every method */
    }

    signInStarted.current = true;
    void (async () => {
      const result = await signIn("telegram", {
        initData: webApp.initData,
        redirect: false,
      });
      if (!result) {
        setLocalState({ kind: "error", message: "Сессия Telegram не получена" });
        return;
      }
      if (result.error) {
        setLocalState({ kind: "error", message: result.error });
      }
      // On success the session flips and the render path above kicks in.
    })();
  }, [status]);

  if (status === "authenticated" && session?.user?.name) {
    return (
      <div className="flex flex-1 flex-col items-start gap-3">
        <h1 className="text-2xl font-semibold">Привет, {session.user.name}!</h1>
        <p className="text-sm text-muted-foreground">
          Скоро здесь появится ваш список задач на смену.
        </p>
      </div>
    );
  }
  if (localState.kind === "no-telegram") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold">Откройте внутри Telegram</h1>
        <p className="text-sm text-muted-foreground">
          Рабочий кабинет сотрудника доступен только как Mini App в Telegram.
          Попросите у руководителя персональную ссылку-приглашение.
        </p>
      </div>
    );
  }
  if (localState.kind === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold">Не получилось войти</h1>
        <p className="text-sm text-red-500">{localState.message}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Загружаем…
    </div>
  );
}
