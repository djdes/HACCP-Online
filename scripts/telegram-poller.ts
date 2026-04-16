/**
 * Telegram long-polling daemon.
 *
 * Runs as a separate PM2 process (`haccp-telegram-poller`). Calls
 * getUpdates in a loop via grammy so the bot keeps working even when
 * Telegram's servers cannot push to our webhook — which is the case on
 * hosters that block Telegram's IP range inbound (we see
 * "Connection timed out" in getWebhookInfo.last_error_message even
 * though outbound requests via TELEGRAM_FORCE_IP go through fine).
 *
 * Mirrors the logic of `src/app/api/notifications/telegram/route.ts` so
 * /start <token> and /stop behave identically regardless of which
 * transport delivers the update.
 */

import "dotenv/config";
import { Bot } from "grammy";
import { Agent, fetch as undiciFetch, setGlobalDispatcher } from "undici";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import crypto from "node:crypto";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const FORCE_IP = process.env.TELEGRAM_FORCE_IP?.trim();
const LINK_SECRET =
  process.env.TELEGRAM_LINK_TOKEN_SECRET ||
  process.env.TELEGRAM_WEBHOOK_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "";

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set — exiting");
  process.exit(1);
}
if (!LINK_SECRET) {
  console.error("TELEGRAM_LINK_TOKEN_SECRET missing — exiting");
  process.exit(1);
}

// Pin api.telegram.org to a reachable IP — undici's global dispatcher is
// picked up by node's global fetch, which grammy (via undici.fetch below)
// also uses. Without this, api.telegram.org times out on RU servers.
if (FORCE_IP) {
  setGlobalDispatcher(
    new Agent({
      connect: {
        lookup: ((
          hostname: string,
          options: object,
          callback: (
            err: NodeJS.ErrnoException | null,
            addresses: { address: string; family: number }[]
          ) => void
        ) => {
          if (hostname === "api.telegram.org") {
            callback(null, [{ address: FORCE_IP, family: 4 }]);
            return;
          }
          import("node:dns").then(({ lookup }) => {
            lookup(hostname, { ...options, all: true }, callback);
          });
        }) as unknown as undefined,
      },
    })
  );
}

// Match the wrapper used in src/lib/telegram.ts: grammy carries a
// polyfill AbortSignal that undici refuses, so strip it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const grammyFetch: any = async (url: unknown, init: unknown) => {
  const opts = (init as { signal?: unknown } | undefined) ?? {};
  const signal = opts.signal;
  const forwarded =
    signal && !(signal instanceof AbortSignal)
      ? { ...(init as object), signal: undefined }
      : (init as object | undefined);
  return undiciFetch(
    url as Parameters<typeof undiciFetch>[0],
    forwarded as Parameters<typeof undiciFetch>[1]
  );
};

const bot = new Bot(TOKEN, {
  client: { fetch: grammyFetch },
});

// Prisma with the pg adapter (same config as prisma/seed.ts).
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function hmacBase64Url(payload: string): string {
  return crypto
    .createHmac("sha256", LINK_SECRET)
    .update(payload)
    .digest("base64url");
}

function parseLinkToken(token: string): { userId: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const i1 = decoded.indexOf(":");
    const i2 = decoded.indexOf(":", i1 + 1);
    if (i1 < 0 || i2 < 0) return null;
    const userId = decoded.slice(0, i1);
    const expStr = decoded.slice(i1 + 1, i2);
    const sig = decoded.slice(i2 + 1);
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    const expected = hmacBase64Url(`${userId}:${expStr}`);
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    return { userId };
  } catch {
    return null;
  }
}

bot.command("start", async (ctx) => {
  const token = ctx.match?.trim();
  if (!token) {
    await ctx.reply(
      "Для привязки аккаунта используйте ссылку из настроек HACCP-Online."
    );
    return;
  }
  const parsed = parseLinkToken(token);
  if (!parsed) {
    await ctx.reply(
      "Неверная ссылка привязки. Попробуйте получить новую ссылку в настройках HACCP-Online."
    );
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: parsed.userId } });
  if (!user) {
    await ctx.reply("Пользователь не найден. Проверьте ссылку привязки.");
    return;
  }
  const chatId = String(ctx.chat.id);
  await prisma.user.update({
    where: { id: parsed.userId },
    data: { telegramChatId: chatId },
  });
  await ctx.reply("✅ Аккаунт успешно привязан! Вы будете получать уведомления.");
  console.log(`[link] user=${parsed.userId} chat=${chatId}`);
});

bot.command("stop", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const user = await prisma.user.findFirst({
    where: { telegramChatId: chatId },
  });
  if (!user) {
    await ctx.reply("Ваш аккаунт не привязан к HACCP-Online.");
    return;
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null },
  });
  await ctx.reply(
    "Аккаунт отвязан. Вы больше не будете получать уведомления.\n" +
      "Для повторной привязки используйте ссылку из настроек HACCP-Online."
  );
  console.log(`[unlink] user=${user.id}`);
});

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text || "";
  if (text.startsWith("/")) return; // commands handled above
  await ctx.reply(
    "Этот бот отправляет уведомления из HACCP-Online.\n\n" +
      "Команды:\n/start <токен> — привязать аккаунт\n/stop — отвязать аккаунт\n\n" +
      "Для привязки используйте ссылку из настроек: https://wesetup.ru/settings/notifications"
  );
});

bot.catch((err) => {
  console.error("[poller] bot error", err);
});

async function main() {
  // Ensure webhook is removed so long polling works. Safe to call
  // repeatedly; drop_pending_updates=true clears any stale queue.
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    console.log("[poller] webhook cleared, starting long polling");
  } catch (err) {
    console.error("[poller] deleteWebhook failed", err);
  }
  await bot.start({
    onStart: (me) => console.log(`[poller] @${me.username} listening`),
  });
}

main().catch((err) => {
  console.error("[poller] fatal", err);
  process.exit(1);
});
