import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { MiniSessionProvider } from "./_components/mini-session-provider";
import { MiniNav } from "./_components/mini-nav";
import { OfflineIndicator } from "./_components/offline-indicator";
import { MiniTelegramRuntime, MiniTopBar } from "./_components/mini-shell";
import "./mini-theme.css";

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
  title: "WeSetup — Mini App",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0b0f",
};

export default function MiniLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <MiniTelegramRuntime />
        <div className="mini-root min-h-dvh">
          <MiniTopBar />
          <main className="mx-auto flex min-h-[calc(100dvh-64px)] w-full max-w-lg flex-col px-4 pb-28 pt-4">
            {children}
          </main>
          <OfflineIndicator />
          <MiniNav />
        </div>
      </MiniSessionProvider>
    </>
  );
}
