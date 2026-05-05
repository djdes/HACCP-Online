import type { Composer, Context } from "grammy";
import { db } from "@/lib/db";
import { botCallbackRateLimiter } from "@/lib/rate-limit";

/**
 * Shift gate — перед началом смены сотрудник видит ОДНУ кнопку
 * «Начать смену». Других опций нет. После клика создаётся
 * WorkShift сегодняшней даты с status='scheduled' и сотрудник
 * получает обычное приветствие + задачи.
 *
 * Цель — заставить отметку начала смены, чтобы заведующая на
 * Контрольной доске видела кто реально вышел на работу.
 *
 * Implementation: callback_query handler `shift:start`.
 * Кнопка добавляется в start.ts когда юзер ещё не отметил смену.
 */

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Возвращает true если у юзера WorkShift на сегодня есть.
 */
export async function userStartedShiftToday(userId: string): Promise<boolean> {
  const today = utcMidnight(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const shift = await db.workShift.findFirst({
    where: { userId, date: { gte: today, lt: tomorrow } },
    select: { id: true, status: true },
  });
  if (!shift) return false;
  return shift.status === "scheduled";
}

/**
 * Атомарно создаёт WorkShift статуса scheduled на сегодня.
 * Идемпотентно: если уже есть — обновляет статус.
 */
export async function startShiftForUser(
  userId: string,
  organizationId: string
): Promise<void> {
  const today = utcMidnight(new Date());
  await db.workShift.upsert({
    where: { userId_date: { userId, date: today } },
    create: {
      userId,
      organizationId,
      date: today,
      status: "scheduled",
    },
    update: { status: "scheduled" },
  });
}

export function registerShiftGateHandler(composer: Composer<Context>): void {
  // Callback "shift:start" — юзер нажал «Начать смену».
  composer.callbackQuery("shift:start", async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) {
      await ctx.answerCallbackQuery({ text: "Ошибка идентификации" });
      return;
    }
    if (!botCallbackRateLimiter.consume(`${fromId}:shift-start`)) {
      await ctx.answerCallbackQuery({
        text: "Слишком много кликов, подождите минуту",
      });
      return;
    }
    const user = await db.user.findFirst({
      where: { telegramChatId: String(fromId), isActive: true },
      select: { id: true, organizationId: true, name: true },
    });
    if (!user) {
      await ctx.answerCallbackQuery({
        text: "Аккаунт не найден",
        show_alert: true,
      });
      return;
    }
    try {
      await startShiftForUser(user.id, user.organizationId);
    } catch (err) {
      console.error("[shift:start]", err);
      await ctx.answerCallbackQuery({
        text: "Не удалось начать смену",
        show_alert: true,
      });
      return;
    }
    await ctx.answerCallbackQuery({ text: "Смена начата ✓" });
    // Удаляем сообщение с кнопкой «Начать смену» — заменяем на полноценное
    // приветствие через replyWithLoadedStartHome (вызовется после редактирования).
    try {
      await ctx.editMessageText(
        `👋 Смена начата, ${escapeName(user.name)}!\n\nОткрой /start чтобы увидеть задачи на сегодня.`,
        { parse_mode: "HTML" }
      );
    } catch {
      // ignore — message might already be modified or deleted
    }
  });
}

function escapeName(name: string): string {
  return name
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
