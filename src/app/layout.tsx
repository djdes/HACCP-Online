import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { BuildVersionWatcher } from "@/components/layout/build-version-watcher";
import { YandexMetrika } from "@/components/layout/yandex-metrika";
import { CookieConsent } from "@/components/public/cookie-consent";
import "./globals.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Manrope — шрифт эталона (lk.haccp-online.ru). Подключаем как CSS-переменную
 * и НЕ ставим его на <body>: лендинг и публичные страницы должны остаться на
 * текущем системном стеке. Переменную потребляет только `.app-shell`
 * (см. `app-theme.css`), то есть дашборд и /root.
 *
 * Self-hosted (next/font/local): прод-сервер не имеет доступа к
 * fonts.gstatic.com, и next/font/google валил сборку («Failed to fetch
 * Manrope from Google Fonts»). Вариативный TTF (латиница + кириллица,
 * веса 200–800) лежит в репозитории — сборка не зависит от сети.
 */
const manrope = localFont({
  src: "./fonts/manrope-variable.ttf",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
});

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

/**
 * Явный viewport вместо неявного Next-дефолта: раньше поведение
 * масштаба на телефоне было «как получится», и разбираться с
 * самопроизвольным зумом приходилось вслепую.
 *
 * maximumScale намеренно НЕ ставим: жёсткий запрет зума ломает
 * WCAG 1.4.4 (слабовидящие не смогут увеличить текст). Причина
 * авто-зума — шрифты полей меньше 16px, они подняты до 16px.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Владелец дважды просил убрать самопроизвольное увеличение на
  // iPhone. Причину (поля меньше 16px) починили, но Safari умеет
  // зумить и по двойному тапу, поэтому фиксируем масштаб.
  //
  // `userScalable: false` НЕ ставим: iOS всё равно оставляет ручной
  // pinch-zoom при одном лишь maximumScale, и слабовидящий человек
  // сможет увеличить текст пальцами. Полный запрет отрезал бы его от
  // сайта совсем.
  maximumScale: 1,
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
        {/* Иконки вкладки и домашнего экрана берёт App Router из
            src/app/icon.png и src/app/apple-icon.png — ручные <link>
            здесь дублировали бы их и расходились при замене. */}
        <meta name="theme-color" content="#0b1024" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content="WeSetup" />
      </head>
      <body className={`${manrope.variable} antialiased overflow-x-clip`}>
        {children}
        <ServiceWorkerRegister />
        <BuildVersionWatcher />
        <YandexMetrika />
        <CookieConsent />
      </body>
    </html>
  );
}
