import webpush from "web-push";

import { db } from "@/lib/db";

/**
 * Push-уведомления в установленном приложении.
 *
 * Зачем вообще, если есть Telegram: кабинет теперь ставится на телефон и
 * работает без Telegram (см. `docs/PWA.md`). У сотрудника, которого
 * привязали по QR, Telegram может не быть вовсе — и напомнить ему о
 * незаполненном журнале нечем.
 *
 * Ключи VAPID живут в env одной парой на платформу. Без них модуль
 * молча выключен: подписка не предлагается, отправка — no-op. Это
 * сознательно, чтобы отсутствие настройки на сервере не роняло запросы.
 */

const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
// mailto: с настоящим адресом — требование RFC 8292: по нему пуш-сервис
// связывается, если с отправителя пошёл спам.
const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:noreply@wesetup.ru";

let configured = false;
if (publicKey && privateKey) {
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (error) {
    console.error("[web-push] некорректные ключи VAPID", error);
  }
}

export function isWebPushConfigured(): boolean {
  return configured;
}

/** Публичный ключ отдаём браузеру — по нему он и делает подписку. */
export function webPushPublicKey(): string | null {
  return configured ? (publicKey as string) : null;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Куда вести по нажатию. Только внутрь /mini. */
  url?: string;
  /**
   * Тег: уведомление с тем же тегом заменяет предыдущее, а не копится.
   * Без него десять напоминаний о журнале дали бы десять строк в шторке.
   */
  tag?: string;
};

/**
 * Отправляет уведомление на все устройства пользователя.
 *
 * Best-effort и намеренно не бросает: пуш — это подсказка, а не бизнес-
 * операция. Провалившийся пуш не должен отменить создание записи или
 * заполнение журнала, из которого его вызвали.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  if (!configured) return { sent: 0, removed: 0 };

  const subscriptions = await db.webPushSubscription
    .findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    })
    .catch(() => []);

  if (subscriptions.length === 0) return { sent: 0, removed: 0 };

  const body = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: 60 * 60 },
        );
        sent++;
        await db.webPushSubscription
          .update({
            where: { id: subscription.id },
            data: { lastSuccessAt: new Date(), failureCount: 0 },
          })
          .catch(() => null);
      } catch (error) {
        const status = (error as { statusCode?: number })?.statusCode;
        // 404/410 — подписки больше нет: приложение удалили, кеш сайта
        // почистили. Держать её значит копить мусор и вечно получать
        // ошибки; удаляем сразу.
        if (status === 404 || status === 410) {
          removed++;
          await db.webPushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => null);
          return;
        }
        await db.webPushSubscription
          .update({
            where: { id: subscription.id },
            data: { failureCount: { increment: 1 } },
          })
          .catch(() => null);
      }
    }),
  );

  return { sent, removed };
}
