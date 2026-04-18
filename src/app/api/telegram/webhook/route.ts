import { NextResponse, type NextRequest } from "next/server";
import { ensureBotInit, getInboundBot } from "@/lib/bot/bot-app";

/**
 * Telegram pushes updates to this endpoint.
 *
 * Security: Telegram lets us register a secret token at `setWebhook` time;
 * it's echoed back on every request in `X-Telegram-Bot-Api-Secret-Token`.
 * We reject anything that doesn't match. This is the ONLY authentication
 * here — bot updates are not user-scoped sessions.
 *
 * We always respond 200 after accepting an update, even on handler errors,
 * because Telegram retries failed webhooks and can hammer the endpoint
 * indefinitely. Handler failures are logged but swallowed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret is not configured" },
      { status: 500 }
    );
  }

  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  if (provided !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bot = getInboundBot();
  if (!bot) {
    return NextResponse.json(
      { error: "Bot is not configured (TELEGRAM_BOT_TOKEN missing)" },
      { status: 500 }
    );
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await ensureBotInit(bot);
    await bot.handleUpdate(update as Parameters<typeof bot.handleUpdate>[0]);
  } catch (err) {
    console.error("Telegram webhook handler failed", err);
  }

  return NextResponse.json({ ok: true });
}
