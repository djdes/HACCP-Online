import type { Composer, Context } from "grammy";
import { db } from "@/lib/db";

/**
 * Handle `/stop` — unlink the user's Telegram account.
 *
 * Clears `telegramChatId` so the user can re-link later with a fresh invite.
 */
export function registerStopHandler(composer: Composer<Context>): void {
  composer.command("stop", async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) {
      await ctx.reply("Не удалось определить ваш Telegram-аккаунт.");
      return;
    }

    const chatIdStr = String(fromId);
    const user = await db.user.findFirst({
      where: {
        telegramChatId: chatIdStr,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true, name: true },
    });

    if (!user) {
      await ctx.reply(
        "Этот Telegram не привязан к аккаунту. Чтобы привязать, откройте персональную ссылку из приглашения руководителя."
      );
      return;
    }

    await db.user.update({
      where: { id: user.id },
      data: { telegramChatId: null },
    });

    await ctx.reply(
      `${user.name}, ваш Telegram отвязан. Чтобы снова пользоваться ботом, попросите руководителя отправить новое приглашение.`
    );
  });
}
