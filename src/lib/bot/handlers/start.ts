import type { Composer, Context } from "grammy";
import { db } from "@/lib/db";
import {
  hashBotInviteToken,
  stripBotInvitePrefix,
} from "@/lib/bot-invite-tokens";
import { getBotMiniAppLabel } from "@/lib/role-access";

/**
 * Handle `/start <payload>` messages.
 *
 * The only payload shape Stage 1 recognises is `inv_<raw>` — a TG-first
 * invite. When a match is found we bind the caller's TG user id to the
 * pending `User`, flip `isActive`, mark the token consumed, then reply
 * with a Mini App Web App button.
 *
 * Every branch that results in a DM reply MUST use plain text (no HTML /
 * Markdown) to avoid accidental entity escaping issues. The bot never
 * echoes the raw token back.
 */
export function registerStartHandler(composer: Composer<Context>): void {
  composer.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    if (!payload) {
      await ctx.reply(
        "Этот бот работает только по персональной ссылке-приглашению от вашего руководителя."
      );
      return;
    }

    if (!stripBotInvitePrefix(payload)) {
      await ctx.reply(
        "Ссылка-приглашение некорректна. Попросите руководителя создать новую."
      );
      return;
    }

    const tokenHash = hashBotInviteToken(payload);
    const fromId = ctx.from?.id;
    if (!fromId) {
      await ctx.reply("Не удалось определить ваш Telegram-аккаунт.");
      return;
    }

    const token = await db.botInviteToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!token) {
      await ctx.reply(
        "Приглашение не найдено или уже использовано. Попросите новую ссылку."
      );
      return;
    }
    if (token.consumedAt) {
      await ctx.reply("Это приглашение уже использовано.");
      return;
    }
    if (token.expiresAt.getTime() < Date.now()) {
      await ctx.reply("Срок действия приглашения истёк. Попросите новую ссылку.");
      return;
    }

    const chatIdStr = String(fromId);

    // Forbid reusing a TG account that's already tied to a different user —
    // otherwise two physical employees could share one Telegram, and our
    // `User.telegramChatId` lookup would silently route Mini App sessions
    // to whichever row is found first.
    const collision = await db.user.findFirst({
      where: {
        telegramChatId: chatIdStr,
        id: { not: token.userId },
      },
      select: { id: true },
    });
    if (collision) {
      await ctx.reply(
        "Этот Telegram уже привязан к другому сотруднику. Используйте другой аккаунт."
      );
      return;
    }

    await db.$transaction([
      db.user.update({
        where: { id: token.userId },
        data: {
          telegramChatId: chatIdStr,
          isActive: true,
        },
      }),
      db.botInviteToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() },
      }),
    ]);

    const miniBase =
      process.env.MINI_APP_BASE_URL ||
      (process.env.NEXTAUTH_URL
        ? `${process.env.NEXTAUTH_URL.replace(/\/+$/, "")}/mini`
        : null);

    if (!miniBase) {
      await ctx.reply(
        `Готово, ${token.user.name}. Свяжитесь с руководителем — кабинет не настроен.`
      );
      return;
    }

    await ctx.reply(
      `Готово, ${token.user.name}! Откройте рабочий кабинет кнопкой ниже.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: getBotMiniAppLabel({
                  role: token.user.role,
                  isRoot: false,
                }),
                web_app: { url: miniBase },
              },
            ],
          ],
        },
      }
    );
  });
}
