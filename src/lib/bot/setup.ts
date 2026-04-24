import type { Bot } from "grammy";
import { TELEGRAM_COMMANDS } from "@/lib/bot/start-response";
import { buildMiniAppUrl } from "@/lib/journal-obligation-links";

export const WESETUP_BOT_PROFILE = {
  name: "WeSetup · журналы ХАССП/СанПиН",
  shortDescription:
    "Электронные журналы СанПиН и ХАССП прямо в Telegram — без бумажек.",
  description:
    "WeSetup — электронные журналы СанПиН и ХАССП для кафе, ресторанов и пищевых производств.\n\n" +
    "📋 35+ готовых журналов: гигиена, здоровье, температуры холодильников, бракераж, уборка, дезинфекция, приёмка сырья.\n" +
    "✅ Заполнение в один клик прямо здесь — откройте Кабинет и отметьте строки за смену.\n" +
    "📊 PDF для Роспотребнадзора одним кликом — сборка «По звонку инспектора» за 7 дней.\n" +
    "🤖 Умные напоминания, голосовой ввод температур, офлайн-режим на кухне.\n\n" +
    "Бесплатно до 5 сотрудников. Сайт: wesetup.ru",
  menuButtonText: "🏠 Кабинет",
} as const;

export function buildTelegramMenuButton(miniAppBaseUrl: string) {
  const url = buildMiniAppUrl(miniAppBaseUrl, "/mini");
  if (!url) {
    throw new Error("Mini App URL is not configured");
  }

  return {
    menu_button: {
      type: "web_app" as const,
      text: WESETUP_BOT_PROFILE.menuButtonText,
      web_app: { url },
    },
  };
}

export async function configureTelegramBotProfile(args: {
  api: Bot["api"];
  miniAppBaseUrl: string;
  profilePhoto?: Parameters<Bot["api"]["setMyProfilePhoto"]>[0];
}): Promise<void> {
  await args.api.setMyName(WESETUP_BOT_PROFILE.name);
  await args.api.setMyShortDescription(WESETUP_BOT_PROFILE.shortDescription);
  await args.api.setMyDescription(WESETUP_BOT_PROFILE.description);
  await args.api.setMyCommands([...TELEGRAM_COMMANDS]);
  await args.api.setChatMenuButton(buildTelegramMenuButton(args.miniAppBaseUrl));

  if (args.profilePhoto) {
    await args.api.setMyProfilePhoto(args.profilePhoto);
  }
}

export async function configureTelegramBotRuntimeMenu(args: {
  api: Bot["api"];
  miniAppBaseUrl: string | null;
}): Promise<void> {
  await args.api.setMyCommands([...TELEGRAM_COMMANDS]);
  if (args.miniAppBaseUrl) {
    await args.api.setChatMenuButton(
      buildTelegramMenuButton(args.miniAppBaseUrl)
    );
  }
}
