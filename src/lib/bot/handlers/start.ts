import type { Composer, Context } from "grammy";
import {
  hashBotInviteToken,
  stripBotInvitePrefix,
} from "@/lib/bot-invite-tokens";
import { loadTelegramStartHome } from "@/lib/bot/start-home";
import {
  buildTelegramLinkedStartReply,
  buildTelegramUnlinkedStartReply,
  type TelegramLinkedStartState,
} from "@/lib/bot/start-response";
import { db } from "@/lib/db";
import { getMiniAppBaseUrlFromEnv } from "@/lib/journal-obligation-links";
import { buildTelegramWebAppKeyboard } from "@/lib/telegram-web-app";
import { userStartedShiftToday } from "./shift-gate";
import { effectivePreset } from "@/lib/permission-presets";

function getMiniAppBaseUrl(): string | null {
  return getMiniAppBaseUrlFromEnv();
}

async function replyWithLinkedStart(
  ctx: Context,
  state: TelegramLinkedStartState,
  buttonUrl: string | null
): Promise<void> {
  const reply = buildTelegramLinkedStartReply(state, buttonUrl);
  await ctx.reply(reply.text, {
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(reply.buttonLabel && reply.buttonUrl
      ? {
          reply_markup: buildTelegramWebAppKeyboard({
            label: reply.buttonLabel,
            url: reply.buttonUrl,
          }),
        }
      : {}),
  });
}

async function replyWithLoadedStartHome(
  ctx: Context,
  fromId: string
): Promise<void> {
  const home = await loadTelegramStartHome({
    chatId: fromId,
    miniAppBaseUrl: getMiniAppBaseUrl(),
  });

  if (home.kind === "unlinked") {
    await ctx.reply(buildTelegramUnlinkedStartReply().text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
    return;
  }

  // Shift gate — для линейного персонала (не admin/head_chef): пока
  // не нажата «Начать смену», показываем ОДНУ кнопку и не загружаем
  // обычный home. Это заставляет фиксировать выход на смену, чтобы
  // заведующая на Контрольной доске видела кто реально работает.
  const dbUser = await db.user.findFirst({
    where: { telegramChatId: fromId, isActive: true },
    select: {
      id: true,
      name: true,
      role: true,
      permissionPreset: true,
      isRoot: true,
    },
  });
  if (dbUser) {
    const preset = effectivePreset({
      permissionPreset: dbUser.permissionPreset,
      role: dbUser.role,
      isRoot: dbUser.isRoot,
    });
    const isLineStaff =
      preset !== "admin" && preset !== "head_chef";
    if (isLineStaff) {
      const started = await userStartedShiftToday(dbUser.id);
      if (!started) {
        const greetName = dbUser.name.split(" ")[1] || dbUser.name.split(" ")[0] || dbUser.name;
        await ctx.reply(
          `👋 Привет, ${escapeName(greetName)}!\n\n` +
            `Чтобы получить задачи на сегодня — нажми «Начать смену».`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "▶️ Начать смену", callback_data: "shift:start" }],
              ],
            },
          }
        );
        return;
      }
    }
  }

  if (home.kind === "manager") {
    await replyWithLinkedStart(
      ctx,
      {
        name: home.actor.name,
        role: home.actor.role,
        isRoot: home.actor.isRoot,
        kind: "manager",
        pendingCount: home.summary.pending,
        employeesWithPending: home.summary.employeesWithPending,
      },
      home.buttonUrl
    );
    return;
  }

  if (home.kind === "readonly") {
    await replyWithLinkedStart(
      ctx,
      {
        name: home.actor.name,
        role: home.actor.role,
        isRoot: home.actor.isRoot,
        kind: "readonly",
      },
      home.buttonUrl
    );
    return;
  }

  await replyWithLinkedStart(
    ctx,
    {
      name: home.actor.name,
      role: home.actor.role,
      isRoot: home.actor.isRoot,
      kind: "staff",
      nextActionLabel: home.nextAction?.label ?? null,
    },
    home.buttonUrl
  );
}

/**
 * Handle `/start <payload>` messages.
 *
 * The only payload shape Stage 1 recognises is `inv_<raw>`: a TG-first
 * invite. When a match is found we bind the caller's TG user id to the
 * pending `User`, flip `isActive`, mark the token consumed, then reply
 * with a Mini App Web App button.
 *
 * Every branch that results in a DM reply MUST use plain text (no HTML /
 * Markdown) to avoid accidental entity escaping issues. The bot never
 * echoes the raw token back.
 */
function escapeName(name: string): string {
  return name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function registerStartHandler(composer: Composer<Context>): void {
  composer.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    if (!payload) {
      const fromId = ctx.from?.id;
      if (!fromId) {
        await ctx.reply("Не удалось определить ваш Telegram-аккаунт.");
        return;
      }

      await replyWithLoadedStartHome(ctx, String(fromId));
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
      await ctx.reply("Срок действия приглашения истек. Попросите новую ссылку.");
      return;
    }

    const chatIdStr = String(fromId);

    // Forbid reusing a TG account that's already tied to a different user:
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

    await replyWithLoadedStartHome(ctx, chatIdStr);
  });
}
