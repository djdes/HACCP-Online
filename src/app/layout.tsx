import type { Metadata } from "next";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { BuildVersionWatcher } from "@/components/layout/build-version-watcher";
import { YandexMetrika } from "@/components/layout/yandex-metrika";
import { CookieConsent } from "@/components/public/cookie-consent";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  metadataBase: new URL("https://wesetup.ru"),
  title: {
    default:
      "WeSetup — электронные журналы СанПиН и ХАССП. Бесплатно навсегда",
    template: "%s — WeSetup",
  },
  description:
    "35 электронных журналов СанПиН и ХАССП для общепита и пищевых производств. Автозаполнение, Telegram-бот, PDF для проверок Роспотребнадзора. Бесплатно навсегда до 5 сотрудников.",
  keywords: [
    "электронные журналы",
    "журналы СанПиН",
    "журналы ХАССП",
    "HACCP онлайн",
    "гигиенический журнал",
    "бракеражный журнал",
    "журнал температурного режима",
    "Роспотребнадзор",
    "общепит",
  ],
  applicationName: "WeSetup",
  authors: [{ name: "WeSetup" }],
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://wesetup.ru",
    siteName: "WeSetup",
    title:
      "WeSetup — электронные журналы СанПиН и ХАССП. Бесплатно навсегда",
    description:
      "35 электронных журналов СанПиН и ХАССП. Автозаполнение, Telegram-бот, PDF для Роспотребнадзора.",
    images: [
      {
        url: "https://wesetup.ru/og-default",
        width: 1200,
        height: 630,
        alt: "WeSetup — электронные журналы СанПиН и ХАССП",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WeSetup — электронные журналы СанПиН и ХАССП",
    description:
      "Автозаполнение, Telegram-бот, PDF для проверок. Бесплатно навсегда.",
    images: ["https://wesetup.ru/og-default"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="apple-touch-icon"
          sizes="192x192"
          href="/icons/icon-192.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="512x512"
          href="/icons/icon-512.png"
        />
        <meta name="theme-color" content="#0b1024" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content="WeSetup" />
      </head>
      <body className="antialiased overflow-x-clip">
        <div
          role="status"
          className="relative z-[100] flex min-h-10 items-center justify-center bg-amber-400 px-4 py-2 text-center text-[13px] font-medium leading-5 text-[#3d2900] shadow-sm sm:text-[14px]"
        >
          <span className="mr-2 inline-flex size-2 shrink-0 rounded-full bg-[#8a5700]" aria-hidden />
          <span>
            Сайт находится на техническом обслуживании — ведутся технические работы.
          </span>
        </div>
        {children}
        <ServiceWorkerRegister />
        <BuildVersionWatcher />
        <YandexMetrika />
        <CookieConsent />
      </body>
    </html>
  );
}
