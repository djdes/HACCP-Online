import { db } from "@/lib/db";

/**
 * K10 — Outbound webhooks для Zapier/Make/N8N integration.
 *
 * Org настраивает `Organization.webhookUrls[]` через `/settings/integrations`.
 * Когда происходит significant event (CAPA created, rejected partition,
 * etc.), мы шлём POST на каждый URL с JSON-телом.
 *
 * НЕ ждём ответа — fire-and-forget. Не блокирует business logic.
 * Если URL упал — логируем в console, не padaем.
 *
 * Пример event names:
 *   - "capa.created"
 *   - "capa.closed"
 *   - "journal.rejected" — incoming_control rejected
 *   - "equipment.expired" — Equipment + StaffCompetency expired
 *   - "user.first_login"
 *   - "compliance.daily_summary" — раз в день после weekly-digest
 */
export async function dispatchWebhooks(
  organizationId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const org = await db.organization
    .findUnique({
      where: { id: organizationId },
      select: { webhookUrls: true },
    })
    .catch(() => null);
  if (!org || !Array.isArray(org.webhookUrls) || org.webhookUrls.length === 0) {
    return;
  }

  const body = JSON.stringify({
    event,
    organizationId,
    timestamp: new Date().toISOString(),
    payload,
  });

  // Fire-and-forget на все URLs параллельно.
  await Promise.allSettled(
    org.webhookUrls.map((url) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wesetup-Event": event,
          "User-Agent": "WeSetup-Webhook/1.0",
        },
        body,
        // 5s timeout через AbortSignal — медленный URL не должен
        // блокировать основной запрос.
        signal: AbortSignal.timeout(5000),
      }).catch((err) => {
        console.warn(
          `[webhook] ${event} → ${url} failed:`,
          err instanceof Error ? err.message : err
        );
      })
    )
  );
}
