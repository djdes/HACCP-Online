import type { Metadata } from "next";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { BuildVersionWatcher } from "@/components/layout/build-version-watcher";
import { YandexMetrika } from "@/components/layout/yandex-metrika";
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
    // Без og:image Telegram / VK / Discord link previews показывают
    // голый текст на пустом фоне. 512×512 brand-logo лучше пустоты;
    // когда появится designed 1200×630 hero — поменяем на него.
    images: [
      {
        url: "https://wesetup.ru/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "WeSetup — электронные журналы СанПиН и ХАССП",
      },
    ],
  },
  twitter: {
    // Square logo лучше подходит под `summary` (144×144 thumbnail),
    // чем под `summary_large_image` (требует 2:1 hero, минимум 300×157).
    // С неправильным aspect ratio Twitter молча downgrade'ит карту,
    // и итог такой же как до этого фикса — пустой preview.
    card: "summary",
    title: "WeSetup — электронные журналы СанПиН и ХАССП",
    description:
      "Автозаполнение, Telegram-бот, PDF для проверок. Бесплатно навсегда.",
    images: ["https://wesetup.ru/icons/icon-512.png"],
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
        <meta name="theme-color" content="#0b1024" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content="WeSetup" />
      </head>
      <body className="antialiased overflow-x-clip">
        {children}
        <ServiceWorkerRegister />
        <BuildVersionWatcher />
        <YandexMetrika />
      </body>
    </html>
  );
}
