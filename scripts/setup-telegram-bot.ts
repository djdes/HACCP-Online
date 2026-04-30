import dotenv from "dotenv";
import { InputFile } from "grammy";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ensureBotInit, getInboundBot } from "@/lib/bot/bot-app";
import {
  configureTelegramBotProfile,
  WESETUP_BOT_PROFILE,
} from "@/lib/bot/setup";
import { getMiniAppBaseUrlFromEnv } from "@/lib/journal-obligation-links";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

async function main() {
  const bot = getInboundBot();
  if (!bot) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  const miniAppBaseUrl = getMiniAppBaseUrlFromEnv();
  if (!miniAppBaseUrl) {
    throw new Error("MINI_APP_BASE_URL or NEXTAUTH_URL is not configured");
  }

  const avatarPath =
    process.env.TELEGRAM_BOT_PROFILE_PHOTO_PATH?.trim() ||
    path.join(process.cwd(), "public", "icons", "wesetup-bot-avatar.jpg");
  const avatar = await readFile(avatarPath);

  await ensureBotInit(bot);
  await configureTelegramBotProfile({
    api: bot.api,
    miniAppBaseUrl,
    profilePhoto: {
      type: "static",
      photo: new InputFile(avatar, "wesetup-bot-avatar.jpg"),
    },
  });

  console.log(
    [
      `Telegram bot profile configured: ${WESETUP_BOT_PROFILE.name}`,
      `Mini App: ${miniAppBaseUrl}`,
      `Avatar: ${avatarPath}`,
    ].join("\n")
  );
}

main().catch((error) => {
  console.error("Telegram bot setup failed:", error);
  process.exitCode = 1;
});
