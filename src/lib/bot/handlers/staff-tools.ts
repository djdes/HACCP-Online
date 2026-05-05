import type { Composer, Context } from "grammy";
import type { InlineKeyboardButton } from "grammy/types";
import { db } from "@/lib/db";
import { escapeTelegramHtml as esc, personalizeMessage } from "@/lib/telegram";
import {
  getMiniAppBaseUrlFromEnv,
  buildMiniAppUrl,
} from "@/lib/journal-obligation-links";
import { buildTelegramWebAppKeyboard } from "@/lib/telegram-web-app";
import { getUserRoleLabel } from "@/lib/user-roles";
import { botCallbackRateLimiter } from "@/lib/rate-limit";

/**
 * Команды для линейного сотрудника. В отличие от /today/missing
 * (зависят от management-роли), эти команды доступны любому
 * привязанному к чату пользователю — повар видит свою смену, повар
 * видит свой профиль.
 *
 *   /shift  → мой статус смены сегодня + inline-кнопки start/end.
 *   /me     → мой профиль (имя, должность, организация).
 *
 * Callback-кнопки start/end используют тот же storage что и
 * /api/mini/shift/me — обновляют WorkShift.status (working/ended).
 */

type LinkedUser = {
  id: string;
  name: string | null;
  organizationId: string;
  role: string;
  isRoot: boolean;
};

async function resolveLinkedUser(
  chatId: number | string | undefined
): Promise<LinkedUser | null> {
  if (chatId === undefined || chatId === null) return null;
  return db.user.findFirst({
    where: {
      telegramChatId: String(chatId),
      isActive: true,
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      role: true,
      isRoot: true,
    },
  });
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const STATUS_LABEL: Record<string, string> = {
  none: "🆕 Смена ещё не открыта",
  scheduled: "🕒 По графику, но ещё не на смене",
  working: "🟢 На смене сейчас",
  ended: "✅ Смена сегодня закрыта",
  absent: "🔴 Помечена как пропуск",
  off: "🌴 Выходной",
  vacation: "✈️ Отпуск",
  sick: "🤒 Больничный",
};

function buildShiftKeyboard(args: {
  shiftStatus: string;
  miniAppBaseUrl: string | null;
}): { inline_keyboard: InlineKeyboardButton[][] } | undefined {
  const rows: InlineKeyboardButton[][] = [];
  if (args.shiftStatus === "working") {
    rows.push([
      { text: "🛑 Закончить смену", callback_data: "shift-tg:end" },
    ]);
  } else if (args.shiftStatus === "ended" || args.shiftStatus === "absent") {
    // Завершено или пропущено — никаких inline-actions, только web_app.
  } else if (
    args.shiftStatus === "off" ||
    args.shiftStatus === "vacation" ||
    args.shiftStatus === "sick"
  ) {
    // Сегодня не на смене по плану — менять статус через бота не даём,
    // чтобы повар случайно не сломал HR-учёт.
  } else {
    // ВАЖНО: префикс `shift-tg:` (а не `shift:`) — иначе срабатывает
    // ДВА handler'а одновременно: shift-gate.ts матчит "shift:start"
    // (status='scheduled') и сразу staff-tools regex /^shift:(start|end)$/
    // перезаписывает на 'working'. Pass-3 review нашёл это как CRITICAL.
    rows.push([
      { text: "🟢 Я вышел на смену", callback_data: "shift-tg:start" },
    ]);
  }
  if (args.miniAppBaseUrl) {
    const url = buildMiniAppUrl(args.miniAppBaseUrl, "/mini");
    if (url) {
      rows.push([{ text: "📋 Открыть Кабинет", web_app: { url } }]);
    }
  }
  if (rows.length === 0) return undefined;
  return { inline_keyboard: rows };
}

async function buildShiftReply(user: LinkedUser): Promise<{
  text: string;
  reply_markup?: { inline_keyboard: InlineKeyboardButton[][] };
}> {
  const today = utcDayStart(new Date());
  const shift = await db.workShift.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
    select: { status: true, jobPosition: { select: { name: true } } },
  });
  const status = shift?.status ?? "none";
  const positionLine = shift?.jobPosition?.name
    ? `\nДолжность сегодня: <b>${esc(shift.jobPosition.name)}</b>`
    : "";
  const text = personalizeMessage(
    `🕓 <b>{greeting}, {name}!</b>\n\n` +
      `Статус смены: <b>${STATUS_LABEL[status] ?? esc(status)}</b>${positionLine}`,
    { name: user.name }
  );
  const miniAppBaseUrl = getMiniAppBaseUrlFromEnv();
  return {
    text,
    reply_markup: buildShiftKeyboard({
      shiftStatus: status,
      miniAppBaseUrl,
    }),
  };
}

async function applyShiftAction(
  user: LinkedUser,
  action: "start" | "end"
): Promise<{ ok: boolean; status: string; message: string }> {
  const today = utcDayStart(new Date());
  if (action === "start") {
    const result = await db.workShift.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: { status: "working" },
      create: {
        organizationId: user.organizationId,
        userId: user.id,
        date: today,
        status: "working",
      },
      select: { status: true },
    });
    return { ok: true, status: result.status, message: "Смена открыта" };
  }
  const existing = await db.workShift.findUnique({
    where: { userId_date: { userId: user.id, date: today } },
    select: { id: true, status: true },
  });
  if (!existing || existing.status !== "working") {
    return {
      ok: false,
      status: existing?.status ?? "none",
      message: "Сначала откройте смену",
    };
  }
  const updated = await db.workShift.update({
    where: { id: existing.id },
    data: { status: "ended" },
    select: { status: true },
  });
  return { ok: true, status: updated.status, message: "Смена закрыта" };
}

export function registerStaffToolsHandlers(composer: Composer<Context>): void {
  composer.command("shift", async (ctx) => {
    const user = await resolveLinkedUser(ctx.from?.id);
    if (!user) {
      await ctx.reply(
        "🔒 Ваш Telegram-чат пока не привязан к рабочему аккаунту. Попросите руководителя выслать ссылку-приглашение.",
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
      );
      return;
    }
    const reply = await buildShiftReply(user);
    await ctx.reply(reply.text, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(reply.reply_markup ? { reply_markup: reply.reply_markup } : {}),
    });
  });

  composer.command("me", async (ctx) => {
    const user = await resolveLinkedUser(ctx.from?.id);
    if (!user) {
      await ctx.reply(
        "🔒 Ваш Telegram-чат пока не привязан к рабочему аккаунту. Попросите руководителя выслать ссылку-приглашение.",
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
      );
      return;
    }
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
      select: {
        name: true,
        email: true,
        positionTitle: true,
        jobPosition: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });
    const position =
      fullUser?.jobPosition?.name?.trim() ||
      fullUser?.positionTitle?.trim() ||
      getUserRoleLabel(user.role);
    const lines = [
      `👤 <b>${esc(fullUser?.name ?? "—")}</b>`,
      `Должность: ${esc(position)}`,
      fullUser?.organization?.name
        ? `Организация: ${esc(fullUser.organization.name)}`
        : "",
      fullUser?.email ? `Email: <code>${esc(fullUser.email)}</code>` : "",
    ].filter(Boolean);

    const miniAppBaseUrl = getMiniAppBaseUrlFromEnv();
    const url = miniAppBaseUrl ? buildMiniAppUrl(miniAppBaseUrl, "/mini/me") : null;
    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      ...(url
        ? {
            reply_markup: buildTelegramWebAppKeyboard({
              label: "⚙️ Настройки профиля",
              url,
            }),
          }
        : {}),
    });
  });

  // Callback `notif:snooze:<minutes>` — пользователь нажал «Отложить»
  // на push'е. Записываем `notificationPrefs.snoozedUntil = now + minutes`,
  // notifyEmployee увидит этот флаг и пропустит будущие отправки.
  composer.callbackQuery(/^notif:snooze:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    if (!botCallbackRateLimiter.consume(`${fromId}:notif:snooze`)) {
      await ctx.answerCallbackQuery({
        text: "Слишком много кликов, подождите минуту",
        show_alert: false,
      });
      return;
    }
    const rawMinutes = Number(ctx.match[1]);
    if (!Number.isFinite(rawMinutes)) return;
    const minutes = Math.min(24 * 60, Math.max(1, rawMinutes));
    const user = await resolveLinkedUser(fromId);
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Чат не привязан к аккаунту",
        show_alert: true,
      });
      return;
    }
    const snoozedUntil = new Date(Date.now() + minutes * 60 * 1000);
    const existing = await db.user.findUnique({
      where: { id: user.id },
      select: { notificationPrefs: true },
    });
    const prefs =
      (existing?.notificationPrefs as Record<string, unknown> | null) ?? {};
    await db.user.update({
      where: { id: user.id },
      data: {
        notificationPrefs: {
          ...prefs,
          snoozedUntil: snoozedUntil.toISOString(),
        },
      },
    });
    const until = snoozedUntil.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
    await ctx.answerCallbackQuery({
      text: `Отложено до ${until}`,
      show_alert: false,
    });
    // Убираем кнопку «Отложить» из исходного сообщения (само сообщение
    // оставляем — пользователь захочет позже к нему вернуться).
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: undefined });
    } catch {
      /* старое или удалённое сообщение — не критично */
    }
  });

  // Callback-handler для inline-кнопок start/end из /shift.
  // Регекспируем именно `shift-tg:` — НЕ `shift:`, потому что
  // shift-gate.ts держит «shift:start» под собой (onboarding —
  // отметка «начал смену», status='scheduled'). Подробнее см. JSDoc
  // выше у buildShiftKeyboard.
  composer.callbackQuery(/^shift-tg:(start|end)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    if (!botCallbackRateLimiter.consume(`${fromId}:shift-tg`)) {
      await ctx.answerCallbackQuery({
        text: "Слишком много кликов, подождите минуту",
        show_alert: false,
      });
      return;
    }
    const action = ctx.match[1] as "start" | "end";
    const user = await resolveLinkedUser(fromId);
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Чат не привязан к аккаунту",
        show_alert: true,
      });
      return;
    }
    const result = await applyShiftAction(user, action);
    await ctx.answerCallbackQuery({
      text: result.message,
      show_alert: !result.ok,
    });
    if (!result.ok) return;
    // Обновляем сообщение, чтобы кнопки и статус были актуальные.
    const reply = await buildShiftReply(user);
    try {
      await ctx.editMessageText(reply.text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(reply.reply_markup ? { reply_markup: reply.reply_markup } : {}),
      });
    } catch {
      // Если editMessageText упал (например сообщение слишком старое или
      // в нём нечего менять — Telegram бросает 400) — просто отправим
      // новый message с актуальным состоянием.
      await ctx.reply(reply.text, {
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(reply.reply_markup ? { reply_markup: reply.reply_markup } : {}),
      });
    }
  });
}
