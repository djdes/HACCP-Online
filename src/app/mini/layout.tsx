import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { MiniSessionProvider } from "./_components/mini-session-provider";
import { MiniNav } from "./_components/mini-nav";
import { OfflineIndicator } from "./_components/offline-indicator";
import { MiniTelegramRuntime, MiniTopBar } from "./_components/mini-shell";
import { MiniTour } from "./_components/mini-tour";
import {
  MiniThemeBootstrap,
  MiniThemeProvider,
} from "./_components/mini-theme";
import "./mini-theme.css";
// app-theme.css scopes site dashboard styles to `.app-shell` — needed
// here because the Mini App embeds site components (e.g. document
// editor in /mini/documents/[id]). We mirror `.app-shell` onto
// `#mini-root` so those embedded components pick up the right theme.
import "@/app/app-theme.css";

/**
 * Mini App layout.
 *
 * Intentionally separate from the dashboard layout — no sidebar, no nav
 * chrome, no AuthSessionProvider (which requires a non-null session and
 * thus redirects unauthenticated users). Mini App routes accept anonymous
 * visits because the initData-based sign-in happens client-side inside
 * `/mini` itself.
 *
 * Theme: "Dark Kitchen Operator" — editorial dark mode с fraunces-italic
 * заголовками, lime-accent, зерном на фоне. См. `mini-theme.css`.
 */

export const metadata: Metadata = {
  // title.absolute обходит root layout's template "%s — WeSetup". Без
  // absolute получали бы "WeSetup — Mini App — WeSetup" (бренд дублируется).
  title: { absolute: "WeSetup — Mini App" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0b0f",
};

export default async function MiniLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the user's saved theme so the layout SSRs in the right colour
  // immediately. Anonymous visitors (Mini App auth happens client-side
  // via Telegram initData) get the default `dark`; once they sign in,
  // a subsequent navigation pulls their preference.
  const session = await getServerSession(authOptions).catch(() => null);
  const initialTheme: "light" | "dark" = await (async () => {
    if (!session?.user?.id) return "dark";
    const user = await db.user
      .findUnique({
        where: { id: session.user.id },
        select: { themePreference: true },
      })
      .catch(() => null);
    return user?.themePreference === "light" ? "light" : "dark";
  })();

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {/* Distinctive font stack, loaded once. Display serif для editorial
          заголовков, mono для температур/кодов, grotesque для body. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..700,0..100;1,9..144,300..700,0..100&family=Bricolage+Grotesque:opsz,wght@12..96,400..700&family=Geist+Mono:wght@400;500;600&display=swap"
      />
      <MiniSessionProvider>
        <MiniThemeProvider initialTheme={initialTheme}>
          <MiniTelegramRuntime />
          {/* `id="mini-root"` нужен для pre-hydration скрипта
              `<MiniThemeBootstrap />` и для `applyThemeToDOM`: они
              ищут этот контейнер по id, чтобы выставить `data-theme`
              без FOUC. `suppressHydrationWarning` — скрипт может
              перезаписать атрибут до того, как React гидратирует
              элемент; без этого флага React выругался бы.
              `class="app-shell"` + `data-app-theme` мирорят тему на
              site-уровень — встроенные клиенты документов из
              `(dashboard)` (например HygieneDocumentClient) подхватят
              правильную dark/light палитру через `.app-shell[data-app-theme]`. */}
          <div
            id="mini-root"
            className="mini-root app-shell min-h-dvh"
            data-theme={initialTheme}
            data-app-theme={initialTheme}
            suppressHydrationWarning
          >
            <MiniThemeBootstrap />
            <MiniTopBar />
            {/* Safe-area-inset для iPhone notch и home-indicator. На
                iPhone X+ Telegram WebApp в expand-режиме растягивается
                на всю высоту, и без учёта env(safe-area-inset-*) контент
                клипается под notch'ем сверху и под home-indicator-полосой
                снизу. pb-28 (нижний nav) дополняем `safe-area-inset-bottom`,
                pt-4 — `safe-area-inset-top` где notch заходит в шапку. */}
            <main
              className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-lg flex-col px-4"
              style={{
                paddingTop: "max(1rem, env(safe-area-inset-top))",
                paddingBottom:
                  "max(7rem, calc(env(safe-area-inset-bottom) + 6rem))",
              }}
            >
              {children}
            </main>
            <OfflineIndicator />
            <MiniNav />
            <MiniTour />
          </div>
        </MiniThemeProvider>
      </MiniSessionProvider>
    </>
  );
}
