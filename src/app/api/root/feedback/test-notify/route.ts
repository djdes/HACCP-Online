import { NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth-helpers";
import { sendPlatformAdminTestEmail } from "@/lib/email";
import {
  getPlatformAdminChatIds,
  getPlatformAdminEmail,
  notifyPlatformAdmin,
} from "@/lib/platform-admin";

/**
 * POST /api/root/feedback/test-notify
 *
 * «Проверить связь» из панели обращений. Владелец не должен выяснять по
 * логам и env, чей chat id настроен: жмёт кнопку — и видит своими
 * глазами, куда пришло сообщение и письмо.
 *
 * Отправки синхронные (не через after()): ответ роута — и есть результат
 * проверки, ради него всё и затевалось.
 */
export async function POST() {
  const session = await requireRoot();

  const chatIds = getPlatformAdminChatIds();
  const adminEmail = getPlatformAdminEmail();
  const who = session.user.name ?? session.user.email ?? "ROOT";
  const when = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });

  const telegram = await notifyPlatformAdmin(
    [
      "✅ <b>Тест: уведомления платформы приходят сюда</b>",
      "",
      "Сюда же будут приходить обращения, регистрации и оплаты.",
      `Запустил: ${who} · ${when}`,
    ].join("\n"),
    { kind: "test" }
  ).catch((error) => {
    console.error("[test-notify] telegram failed:", error);
    return false;
  });

  const email = adminEmail
    ? await sendPlatformAdminTestEmail({
        to: adminEmail,
        triggeredBy: who,
      }).catch((error) => {
        console.error("[test-notify] email failed:", error);
        return false;
      })
    : false;

  return NextResponse.json({
    ok: true,
    telegram,
    telegramChats: chatIds.length,
    email,
    emailConfigured: Boolean(adminEmail),
  });
}
