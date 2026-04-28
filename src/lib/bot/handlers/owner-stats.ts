import type { Composer, Context } from "grammy";
import { db } from "@/lib/db";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { getManagerObligationSummary } from "@/lib/journal-obligations";
import { escapeTelegramHtml as esc, personalizeMessage } from "@/lib/telegram";

/**
 * Команды бота для руководителя (manager / head_chef / owner / technologist /
 * ROOT). Все четыре команды отдают краткую сводку в чат — без web-app
 * кнопок, чтобы пользователь не уходил из чата для базового контроля.
 *
 *   /today    → «X / Y журналов заполнено сегодня».
 *   /missing  → список незаполненных журналов.
 *   /capa     → количество и пара примеров открытых CAPA-тикетов.
 *   /stats    → 7-дневный график выполнения (text-only).
 *
 * Авторизация: бот узнаёт организацию по `User.telegramChatId`. Если
 * чат не привязан или пользователь — линейный сотрудник без management-
 * роли, отвечаем вежливым отказом.
 */

type ManagementUser = {
  id: string;
  name: string | null;
  organizationId: string;
  role: string;
  isRoot: boolean;
};

async function resolveManagementUser(
  chatId: number | string | undefined
): Promise<ManagementUser | null> {
  if (chatId === undefined || chatId === null) return null;
  const candidate = await db.user.findFirst({
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
  if (!candidate) return null;
  if (!hasFullWorkspaceAccess(candidate)) return null;
  return candidate;
}

async function replyNotAuthorized(ctx: Context): Promise<void> {
  await ctx.reply(
    "🔒 Эта команда — для руководителей. Если вы менеджер/owner и видите это сообщение, значит ваш Telegram-чат пока не привязан к рабочему аккаунту. Откройте /settings/notifications в кабинете и привяжите его.",
    { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
  );
}

function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function formatDateRu(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
  });
}

export function registerOwnerStatsHandlers(composer: Composer<Context>): void {
  // /today — общий процент выполнения сегодня.
  composer.command("today", async (ctx) => {
    const user = await resolveManagementUser(ctx.from?.id);
    if (!user) return replyNotAuthorized(ctx);

    const now = new Date();
    const summary = await getManagerObligationSummary(user.organizationId, now);
    const pct = summary.total === 0
      ? 0
      : Math.round((summary.done / summary.total) * 100);

    const lines = [
      personalizeMessage("📋 <b>{greeting}, {name}!</b>", { name: user.name }),
      "",
      `Сегодня (${formatDateRu(now)}):`,
      `• Заполнено: <b>${summary.done}</b> / ${summary.total} (${pct}%)`,
      `• Осталось: <b>${summary.pending}</b>`,
      `• Сотрудников с открытыми задачами: ${summary.employeesWithPending}`,
    ];
    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });

  // /missing — что не заполнено.
  composer.command("missing", async (ctx) => {
    const user = await resolveManagementUser(ctx.from?.id);
    if (!user) return replyNotAuthorized(ctx);

    const now = new Date();
    const dateKey = utcDayStart(now);
    const pending = await db.journalObligation.findMany({
      where: {
        organizationId: user.organizationId,
        dateKey,
        status: "pending",
      },
      select: {
        userId: true,
        template: { select: { name: true, code: true } },
        user: { select: { name: true } },
      },
      orderBy: [{ template: { name: "asc" } }, { user: { name: "asc" } }],
      take: 20,
    });

    if (pending.length === 0) {
      await ctx.reply(
        "✅ <b>Все журналы заполнены</b>\nНа сегодня нет открытых задач — отличная работа смене.",
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
      );
      return;
    }

    const grouped = new Map<string, string[]>();
    for (const row of pending) {
      const key = row.template.name;
      const arr = grouped.get(key) ?? [];
      arr.push(row.user.name?.trim() || "—");
      grouped.set(key, arr);
    }
    const lines = [
      `📋 <b>Не заполнено сегодня · ${pending.length}</b>`,
      "",
      ...Array.from(grouped.entries()).map(
        ([name, users]) =>
          `• <b>${esc(name)}</b> — ${users.map(esc).join(", ")}`
      ),
    ];
    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });

  // /capa — открытые тикеты.
  composer.command("capa", async (ctx) => {
    const user = await resolveManagementUser(ctx.from?.id);
    if (!user) return replyNotAuthorized(ctx);

    const tickets = await db.capaTicket.findMany({
      where: {
        organizationId: user.organizationId,
        status: { in: ["open", "in_progress"] },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        assignedToId: true,
      },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 10,
    });
    const assigneeIds = Array.from(
      new Set(tickets.map((t) => t.assignedToId).filter((v): v is string => Boolean(v)))
    );
    const assignees = assigneeIds.length
      ? await db.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];
    const assigneeNameById = new Map(assignees.map((u) => [u.id, u.name ?? ""]));

    if (tickets.length === 0) {
      await ctx.reply(
        "✅ <b>Открытых CAPA нет</b>\nВсе предписания закрыты — можно выдохнуть.",
        { parse_mode: "HTML", link_preview_options: { is_disabled: true } }
      );
      return;
    }

    const lines = [
      `🛠 <b>Открытые CAPA · ${tickets.length}</b>`,
      "",
      ...tickets.map((t) => {
        const due = t.dueDate ? formatDateRu(t.dueDate) : "без срока";
        const assignee =
          (t.assignedToId && assigneeNameById.get(t.assignedToId)?.trim()) ||
          "не назначено";
        return `• [${esc(t.priority)}] <b>${esc(t.title)}</b>\n   ${esc(assignee)} · до ${esc(due)}`;
      }),
    ];
    await ctx.reply(lines.join("\n"), {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });

  // /stats — 7-дневный график.
  composer.command("stats", async (ctx) => {
    const user = await resolveManagementUser(ctx.from?.id);
    if (!user) return replyNotAuthorized(ctx);

    const now = new Date();
    const days: Array<{ date: Date; done: number; total: number }> = [];
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - offset);
      const dayStart = utcDayStart(d);
      const rows = await db.journalObligation.groupBy({
        by: ["status"],
        where: { organizationId: user.organizationId, dateKey: dayStart },
        _count: { _all: true },
      });
      const done = rows.find((r) => r.status === "done")?._count._all ?? 0;
      const pending = rows.find((r) => r.status === "pending")?._count._all ?? 0;
      days.push({ date: dayStart, done, total: done + pending });
    }

    const dayLabels = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
    const totalDone = days.reduce((sum, d) => sum + d.done, 0);
    const totalAll = days.reduce((sum, d) => sum + d.total, 0);
    const weekPct = totalAll === 0 ? 0 : Math.round((totalDone / totalAll) * 100);

    const lines = [
      "📊 <b>7 дней · сводка</b>",
      "",
      `Заполнено: <b>${totalDone}</b> / ${totalAll} (${weekPct}%)`,
      "",
      ...days.map((d) => {
        const pct = d.total === 0 ? 0 : Math.round((d.done / d.total) * 100);
        const bar = bar10(pct);
        return `${dayLabels[d.date.getUTCDay()]} ${formatDateRu(d.date).padEnd(10)} ${bar} ${pct}%`;
      }),
    ];
    await ctx.reply(`<pre>${lines.join("\n")}</pre>`, {
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
    });
  });
}

function bar10(pct: number): string {
  const filled = Math.round((Math.max(0, Math.min(100, pct)) / 100) * 10);
  return "█".repeat(filled) + "·".repeat(10 - filled);
}
