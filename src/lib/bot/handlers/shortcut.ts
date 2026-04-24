import type { Composer, Context } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import { getMiniAppBaseUrlFromEnv, buildMiniAppUrl } from "@/lib/journal-obligation-links";
import { buildTelegramWebAppKeyboard } from "@/lib/telegram-web-app";

/**
 * Короткие команды-ярлыки из меню бота (`/journals`, `/tasks`,
 * `/reports`, `/help`). Каждая отвечает кратким сообщением и
 * web_app-кнопкой, которая открывает нужный раздел Mini App внутри
 * Telegram — пользователь не покидает мессенджер.
 */

async function reply(
  ctx: Context,
  text: string,
  opts: { miniPath: string; buttonLabel: string }
): Promise<void> {
  const base = getMiniAppBaseUrlFromEnv();
  const url = base ? buildMiniAppUrl(base, opts.miniPath) : null;
  await ctx.reply(text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(url
      ? {
          reply_markup: buildTelegramWebAppKeyboard({
            label: opts.buttonLabel,
            url,
          }),
        }
      : {}),
  });
}

export function registerShortcutHandlers(composer: Composer<Context>): void {
  composer.command("journals", async (ctx) => {
    // Даём две дороги: web_app-кнопка на полный список в Mini App
    // (быстрый привычный путь) и inline-кнопка на bot-навигацию
    // `/edit` — drill-down по каждому журналу без выхода из чата.
    const base = getMiniAppBaseUrlFromEnv();
    const url = base ? buildMiniAppUrl(base, "/mini/journals") : null;
    const rows: InlineKeyboardButton[][] = [];
    if (url) {
      rows.push([{ text: "📋 Открыть в Mini App", web_app: { url } }]);
    }
    rows.push([
      { text: "✏️ Выбрать и изменить документ", callback_data: "edit:home" },
    ]);
    await ctx.reply(
      "📋 <b>Мои журналы</b>\nВсе журналы СанПиН и ХАССП прямо в Telegram — клик по ячейке, запись готова.",
      {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        reply_markup: { inline_keyboard: rows },
      }
    );
  });

  composer.command("tasks", async (ctx) => {
    await reply(
      ctx,
      "✅ <b>Задачи на сегодня</b>\nТо, что надо заполнить прямо сейчас: гигиена, температуры, уборка, бракераж.",
      { miniPath: "/mini", buttonLabel: "Задачи на смену" }
    );
  });

  composer.command("reports", async (ctx) => {
    await reply(
      ctx,
      "📊 <b>Отчёты</b>\nPDF и Excel за любой период. Одна кнопка «По звонку инспектора» собирает ZIP с cover-страницей, всеми журналами и CAPA за последние 7 дней.",
      { miniPath: "/mini/reports", buttonLabel: "Открыть отчёты" }
    );
  });

  composer.command("help", async (ctx) => {
    await reply(
      ctx,
      "💬 <b>WeSetup в Telegram</b>\n\n" +
        "• /start — домашний экран с задачами на смену\n" +
        "• /journals — журналы СанПиН и ХАССП\n" +
        "• /tasks — что надо заполнить сегодня\n" +
        "• /reports — PDF и ZIP для инспектора\n" +
        "• /stop — отвязать Telegram от аккаунта\n\n" +
        "Поддержка: пишите в @wesetupbot — отвечаем лично.\n" +
        "Сайт: wesetup.ru",
      { miniPath: "/mini", buttonLabel: "Открыть Кабинет" }
    );
  });
}
