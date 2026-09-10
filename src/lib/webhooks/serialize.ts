export type WebhookDto = {
  id: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export function serializeWebhook(w: { id: string; url: string; secret: string; events: string[]; enabled: boolean; lastSuccessAt: Date | null; lastError: string | null; createdAt: Date }): WebhookDto {
  return { id: w.id, url: w.url, secret: w.secret, events: w.events, enabled: w.enabled, lastSuccessAt: w.lastSuccessAt?.toISOString() ?? null, lastError: w.lastError, createdAt: w.createdAt.toISOString() };
}
