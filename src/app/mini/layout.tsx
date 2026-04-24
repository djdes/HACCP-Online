import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { MiniSessionProvider } from "./_components/mini-session-provider";
import { MiniNav } from "./_components/mini-nav";
import { OfflineIndicator } from "./_components/offline-indicator";
import { MiniTelegramRuntime, MiniTopBar } from "./_components/mini-shell";

/**
 * Mini App layout.
 *
 * Intentionally separate from the dashboard layout — no sidebar, no nav
 * chrome, no AuthSessionProvider (which requires a non-null session and
 * thus redirects unauthenticated users). Mini App routes accept anonymous
 * visits because the initData-based sign-in happens client-side inside
 * `/mini` itself.
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
  themeColor: "#0b1024",
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
      <MiniSessionProvider>
        <MiniTelegramRuntime />
        <div className="min-h-dvh bg-[#eef1ff] text-[#0b1024]">
          <MiniTopBar />
          <main className="mx-auto flex min-h-[calc(100dvh-58px)] w-full max-w-lg flex-col bg-[#fafbff] px-3 pb-28 pt-4 shadow-[0_0_80px_-48px_rgba(85,102,246,0.65)] sm:px-4">
            {children}
          </main>
          <OfflineIndicator />
          <MiniNav />
        </div>
      </MiniSessionProvider>
    </>
  );
}
