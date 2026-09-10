"use client";

import { Copy, Plus, RefreshCw, Send, Trash2, Webhook } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { WebhookDto } from "@/lib/webhooks/serialize";
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABEL, type WebhookEvent } from "@/lib/webhooks/events";

type Delivery = { id: string; webhookId: string; event: string; status: string; attempts: number; lastStatus: number | null; lastError: string | null; createdAt: string; sentAt: string | null; nextAttemptAt: string | null };

const CARD = "rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]";
const PRIMARY = "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60";
const SECONDARY = "inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[13.5px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60";
const INPUT = "h-12 w-full rounded-2xl border border-[#dcdfed] bg-white px-4 text-[15px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15";
const SUBSCRIBABLE = WEBHOOK_EVENTS.filter((e) => e !== "ping");

const STATUS_TONE: Record<string, string> = { sent: "bg-[#ecfdf5] text-[#116b2a]", queued: "bg-[#fff8eb] text-[#b25f00]", failed: "bg-[#fff4f2] text-[#a13a32]" };
const STATUS_LABEL: Record<string, string> = { sent: "доставлено", queued: "в очереди", failed: "не доставлено" };

export function WebhooksClient() {
  const [webhooks, setWebhooks] = useState<WebhookDto[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<WebhookEvent[]>(["journal.entry", "journal.deviation", "capa.created"]);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<WebhookDto | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/settings/webhooks/subscriptions");
      const data = (await response.json()) as { webhooks: WebhookDto[]; deliveries: Delivery[] };
      setWebhooks(data.webhooks ?? []);
      setDeliveries(data.deliveries ?? []);
    } catch {
      toast.error("Не удалось загрузить вебхуки");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy("create");
    try {
      const response = await fetch("/api/settings/webhooks/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, events }) });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Не удалось добавить");
      toast.success("Подписка добавлена — секрет ниже, скопируйте его в свой сервис");
      setUrl("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: string, body: Record<string, unknown>, okText: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/settings/webhooks/subscriptions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Не удалось сохранить");
      toast.success(okText);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function test(id: string) {
    setBusy(`test-${id}`);
    try {
      const response = await fetch(`/api/settings/webhooks/subscriptions/${id}`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { outcome?: { ok: boolean; status: number | null; error: string | null } } | null;
      if (!response.ok || !data?.outcome) throw new Error("Не удалось отправить");
      if (data.outcome.ok) toast.success(`Тест доставлен: ответ ${data.outcome.status}`);
      else toast.error(`Не доставлено: ${data.outcome.error ?? "ошибка"}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    await fetch(`/api/settings/webhooks/subscriptions/${id}`, { method: "DELETE" });
    toast.success("Подписка удалена");
    await load();
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Скопировано");
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-6">
        <section className={CARD}>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-[#0b1024]">
            <Plus className="size-4 text-[#5566f6]" />
            Новая подписка
          </div>
          <div className="mt-4 space-y-3">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ваш-сервер.ru/wesetup-hook" inputMode="url" aria-label="Адрес вебхука" className={INPUT} data-testid="webhook-url" />
            <div className="flex flex-wrap gap-2">
              {SUBSCRIBABLE.map((e) => {
                const on = events.includes(e);
                return (
                  <button key={e} type="button" aria-pressed={on} onClick={() => setEvents((prev) => (on ? prev.filter((x) => x !== e) : [...prev, e]))} className={`inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors ${on ? "border-[#5566f6] bg-[#5566f6] text-white" : "border-[#dcdfed] bg-white text-[#0b1024] hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"}`}>
                    {WEBHOOK_EVENT_LABEL[e]}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => void create()} disabled={busy === "create" || !url.trim() || events.length === 0} className={PRIMARY} data-testid="webhook-create">
              <Webhook className="size-4" />
              {busy === "create" ? "Добавляем…" : "Добавить подписку"}
            </button>
          </div>
        </section>

        {loading ? (
          <div className="text-[14px] text-[#6f7282]">Загружаем…</div>
        ) : webhooks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-12 text-center">
            <div className="text-[15px] font-medium text-[#0b1024]">Подписок пока нет</div>
            <p className="mx-auto mt-1.5 max-w-[380px] text-[13px] text-[#6f7282]">Добавьте адрес вашего сервера и выберите события — WeSetup начнёт присылать их сам.</p>
          </div>
        ) : (
          webhooks.map((w) => (
            <section key={w.id} className={CARD} data-testid="webhook-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="break-all text-[14px] font-semibold text-[#0b1024]">{w.url}</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {w.events.map((e) => (
                      <span key={e} className="rounded-full bg-[#f5f6ff] px-2.5 py-0.5 text-[12px] text-[#3848c7]">{WEBHOOK_EVENT_LABEL[e as WebhookEvent] ?? e}</span>
                    ))}
                  </div>
                  <div className="mt-2 text-[12px] text-[#6f7282]">
                    {w.enabled ? "Включена" : "Выключена"}
                    {w.lastSuccessAt ? ` · последняя удачная доставка ${new Date(w.lastSuccessAt).toLocaleString("ru-RU")}` : ""}
                    {w.lastError ? <span className="text-[#a13a32]"> · последняя ошибка: {w.lastError}</span> : null}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#fafbff] px-3.5 py-2.5">
                <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-[#0b1024]" data-testid="webhook-secret">{w.secret}</code>
                <button type="button" onClick={() => void copy(w.secret)} className="text-[#3848c7]" aria-label="Скопировать секрет">
                  <Copy className="size-4" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void test(w.id)} disabled={busy === `test-${w.id}`} className={SECONDARY} data-testid="webhook-test">
                  <Send className="size-4 text-[#5566f6]" />
                  {busy === `test-${w.id}` ? "Отправляем…" : "Отправить тест"}
                </button>
                <button type="button" onClick={() => void patch(w.id, { enabled: !w.enabled }, w.enabled ? "Подписка выключена" : "Подписка включена")} disabled={busy === w.id} className={SECONDARY}>
                  {w.enabled ? "Выключить" : "Включить"}
                </button>
                <button type="button" onClick={() => void patch(w.id, { rotateSecret: true }, "Секрет перевыпущен — обновите его в своём сервисе")} disabled={busy === w.id} className={SECONDARY}>
                  <RefreshCw className="size-4 text-[#5566f6]" />
                  Новый секрет
                </button>
                <button type="button" onClick={() => setDeleting(w)} className={`${SECONDARY} text-[#a13a32]`}>
                  <Trash2 className="size-4" />
                  Удалить
                </button>
              </div>
            </section>
          ))
        )}
      </div>

      <aside className="space-y-6">
        <section className={CARD}>
          <div className="text-[15px] font-semibold text-[#0b1024]">Как проверять подпись</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[#6f7282]">
            Заголовок <code className="rounded bg-[#f5f6ff] px-1 py-0.5 text-[12px]">X-WeSetup-Signature</code> = <code className="rounded bg-[#f5f6ff] px-1 py-0.5 text-[12px]">sha256=HMAC-SHA256(секрет, тело)</code>. Ещё приходят <code className="rounded bg-[#f5f6ff] px-1 py-0.5 text-[12px]">X-WeSetup-Event</code> и <code className="rounded bg-[#f5f6ff] px-1 py-0.5 text-[12px]">X-WeSetup-Delivery</code>. Отвечайте 2xx за 10 секунд; иначе повторим через 1, 5 и 30 минут. Нет своего сервера — подпишите тестовый приёмник <code className="rounded bg-[#f5f6ff] px-1 py-0.5 text-[12px]">https://wesetup.ru/api/webhooks/echo</code> и смотрите доставки здесь. Подробности — на wesetup.ru/developers.
          </p>
        </section>
        <section className={CARD}>
          <div className="text-[15px] font-semibold text-[#0b1024]">Последние доставки</div>
          {deliveries.length === 0 ? (
            <p className="mt-2 text-[13px] text-[#9b9fb3]">Пока ничего не отправлялось.</p>
          ) : (
            <ul className="mt-3 space-y-2" data-testid="deliveries">
              {deliveries.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-3 rounded-2xl border border-[#ececf4] px-3.5 py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <div className="font-medium text-[#0b1024]">{WEBHOOK_EVENT_LABEL[d.event as WebhookEvent] ?? d.event}</div>
                    <div className="text-[12px] text-[#6f7282]">
                      {new Date(d.createdAt).toLocaleString("ru-RU")} · попыток {d.attempts}
                      {d.lastStatus ? ` · HTTP ${d.lastStatus}` : ""}
                      {d.lastError ? ` · ${d.lastError}` : ""}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] ${STATUS_TONE[d.status] ?? ""}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        variant="danger"
        title="Удалить подписку?"
        description={deleting ? `События перестанут приходить на ${deleting.url}.` : ""}
        bullets={[{ label: "История доставок удалится вместе с подпиской" }]}
        confirmLabel="Удалить"
        onConfirm={remove}
      />
    </div>
  );
}
