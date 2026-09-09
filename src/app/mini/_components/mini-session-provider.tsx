"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useRef } from "react";

import { adoptCookieSession } from "../_lib/cookie-session";
import { getTelegramWebApp } from "./telegram-web-app";

/**
 * SessionProvider for the Mini App route group.
 *
 * Unlike `AuthSessionProvider` (which demands a non-null session), this one
 * starts with `session={null}` and lets the Mini App's `/page.tsx` trigger
 * a Telegram `signIn` once the client has `window.Telegram.WebApp.initData`
 * in hand. `refetchOnWindowFocus` stays off because the Mini App webview
 * triggers focus events aggressively on iOS.
 *
 * Вне Telegram у провайдера нет способа узнать о живой куке (см.
 * `_lib/cookie-session.ts`), и любая страница Mini на холодном старте
 * висела бы на «Загружаем…». `CookieSessionBootstrap` подхватывает куку
 * для всех страниц разом; главная сверх этого решает, вести ли на вход.
 */
function CookieSessionBootstrap() {
  const { status } = useSession();
  const started = useRef(false);
  useEffect(() => {
    if (status !== "unauthenticated" || started.current) return;
    // В Telegram вход делает главная через signIn("telegram") — не мешаем.
    if (getTelegramWebApp()?.initData) return;
    started.current = true;
    void adoptCookieSession();
  }, [status]);
  return null;
}

export function MiniSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider
      session={null}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
      refetchInterval={0}
    >
      <CookieSessionBootstrap />
      {children}
    </SessionProvider>
  );
}
