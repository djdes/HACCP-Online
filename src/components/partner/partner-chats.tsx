"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Search,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  AttachButton,
  AttachmentChips,
  MessageAttachments,
  useAttachmentUploads,
} from "@/components/support/attachment-composer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  EmptyState,
  Pill,
  btnOutline,
  btnPrimary,
  formatDateTime,
  inputClass,
  readError,
  textareaClass,
} from "@/components/partner/ui";
import { announceSupportChatRead } from "@/lib/support-chat-bus";
import { ageLabel } from "@/lib/support-threads-shared";
import type { SupportAttachmentMeta } from "@/lib/support-attachments-shared";
import { cn } from "@/lib/utils";

/**
 * Чаты партнёра с его организациями.
 *
 * Слева — ветки (кто, что последнее, сколько ждёт ответа), справа —
 * переписка с композером. На телефоне — по очереди: список, потом ветка.
 * «Написать клиенту» заводит ветку организации, у которой её ещё нет:
 * клиент увидит сообщение в кабинете со звуком и всплывашкой.
 */

type ThreadRow = {
  id: string;
  kind: "org" | "guest" | "legacy";
  organizationId: string | null;
  organizationName: string | null;
  userName: string | null;
  lastMessageAt: string;
  unreadForStaff: number;
  last: { author: string; preview: string; createdAt: string } | null;
};

type ClientRow = { organizationId: string; name: string; threadId: string | null };

type Message = {
  id: string;
  author: string;
  body: string;
  operatorName: string | null;
  authorName: string | null;
  attachments: SupportAttachmentMeta[];
  createdAt: string;
};

const LIST_POLL_MS = 20_000;
const THREAD_POLL_MS = 10_000;

export function PartnerChats({ brandName }: { brandName: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("thread");

  const [threads, setThreads] = useState<ThreadRow[] | null>(null);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const files = useAttachmentUploads();

  const loadList = useCallback(async () => {
    const response = await fetch("/api/partner/chats", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) return;
    const data = await response.json().catch(() => null);
    setThreads(data?.threads ?? []);
    setClients(data?.clients ?? []);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const response = await fetch(`/api/partner/chats/${id}`, { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setMessages([]);
      return;
    }
    const data = await response.json().catch(() => null);
    setMessages(data?.messages ?? []);
  }, []);

  useEffect(() => {
    void loadList();
    const timer = setInterval(() => void loadList(), LIST_POLL_MS);
    return () => clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setMessages(null);
      return;
    }
    setMessages(null);
    void loadThread(selectedId);
    const timer = setInterval(() => void loadThread(selectedId), THREAD_POLL_MS);
    return () => clearInterval(timer);
  }, [selectedId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const selected = useMemo(
    () => threads?.find((t) => t.id === selectedId) ?? null,
    [threads, selectedId]
  );

  function select(id: string | null) {
    router.replace(id ? `/partner/chats?thread=${encodeURIComponent(id)}` : "/partner/chats");
  }

  async function send() {
    if (!selectedId) return;
    const body = draft.trim();
    const attachments = files.readyAttachments;
    if (body.length < 2 && attachments.length === 0) return;
    if (files.uploading) {
      toast.error("Дождитесь загрузки файлов");
      return;
    }
    setBusy(true);
    setDraft("");
    try {
      const response = await fetch(`/api/partner/chats/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body, attachments }),
      });
      if (!response.ok) throw new Error(await readError(response, "Не удалось отправить"));
      const data = await response.json();
      files.clear();
      if (data.threadId && data.threadId !== selectedId) {
        // Ответ в старую личную ветку ушёл в ветку организации — переходим туда.
        select(data.threadId);
      } else {
        setMessages((current) => [...(current ?? []), data.message]);
      }
      setThreads((current) =>
        (current ?? []).map((t) =>
          t.id === selectedId
            ? {
                ...t,
                unreadForStaff: 0,
                lastMessageAt: data.message.createdAt,
                last: { author: "operator", preview: body || "📎 Вложение", createdAt: data.message.createdAt },
              }
            : t
        )
      );
      announceSupportChatRead();
    } catch (error) {
      setDraft(body);
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  const waiting = (threads ?? []).reduce((sum, t) => sum + t.unreadForStaff, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card
        className={cn("flex flex-col p-0 md:p-0", selectedId && "hidden lg:flex")}
        title={undefined}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#ececf4] px-5 py-4">
          <div>
            <div className="text-[15px] font-semibold text-[#0b1024]">Переписки</div>
            <div className="text-[12px] text-[#6f7282]">
              {waiting > 0 ? `Ждут ответа: ${waiting}` : "Всё отвечено"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setComposeOpen(true)}
            className={cn(btnPrimary, "h-9 px-3 text-[13px]")}
            disabled={clients.length === 0}
          >
            <MessageSquarePlus className="size-4" />
            Написать
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {threads === null ? (
            <div className="flex items-center gap-2 px-5 py-6 text-[13px] text-[#9b9fb3]">
              <Loader2 className="size-4 animate-spin" />
              Загружаем
            </div>
          ) : threads.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Пока никто не писал"
                hint="Напишите клиенту первым — он увидит сообщение в кабинете со звуком и всплывающим уведомлением."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#ececf4]">
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => select(t.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-[#f5f6ff]",
                      t.id === selectedId && "bg-[#f5f6ff]"
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5566f6]">
                      <Building2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-medium text-[#0b1024]">
                          {t.organizationName || "Организация"}
                        </span>
                        <span className="ml-auto shrink-0 text-[11.5px] text-[#9b9fb3]">
                          {ageLabel(t.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-[#6f7282]">
                        {t.last
                          ? `${t.last.author === "client" ? "Клиент: " : "Вы: "}${t.last.preview}`
                          : "Без сообщений"}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1.5">
                        {t.unreadForStaff > 0 ? (
                          <Pill tone="danger">ждёт ответа: {t.unreadForStaff}</Pill>
                        ) : null}
                        {t.kind === "legacy" ? (
                          <Pill tone="neutral" title="Старая личная ветка сотрудника — ответ уйдёт в чат организации">
                            архив
                          </Pill>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card className={cn("flex min-h-[520px] flex-col p-0 md:p-0", !selectedId && "hidden lg:flex")}>
        {!selectedId ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-[14px] text-[#6f7282]">
            Выберите переписку слева или напишите клиенту первым.
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-[#ececf4] px-5 py-4">
              <button
                type="button"
                onClick={() => select(null)}
                className="rounded-lg p-1 text-[#6f7282] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024] lg:hidden"
                aria-label="К списку"
              >
                <ArrowLeft className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold text-[#0b1024]">
                  {selected?.organizationName || "Переписка"}
                </div>
                <div className="truncate text-[12px] text-[#6f7282]">
                  {selected?.userName ? `Последним писал: ${selected.userName}` : "Чат организации"}
                </div>
              </div>
              {selected?.organizationId ? (
                <Link
                  href={`/partner/clients/${selected.organizationId}`}
                  className={cn(btnOutline, "h-9 px-3 text-[13px]")}
                >
                  <ExternalLink className="size-3.5 text-[#5566f6]" />
                  <span className="hidden sm:inline">Карточка</span>
                </Link>
              ) : null}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {messages === null ? (
                <div className="flex items-center gap-2 text-[13px] text-[#9b9fb3]">
                  <Loader2 className="size-4 animate-spin" />
                  Загружаем переписку
                </div>
              ) : messages.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-[#6f7282]">Сообщений пока нет.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-[1.5]",
                      m.author === "operator"
                        ? "ml-auto bg-[#5566f6] text-white"
                        : "bg-[#f5f6ff] text-[#0b1024]"
                    )}
                  >
                    <div
                      className={cn(
                        "mb-0.5 text-[11px] font-medium",
                        m.author === "operator" ? "text-white/75" : "text-[#3848c7]"
                      )}
                    >
                      {m.author === "operator"
                        ? m.operatorName || "Вы"
                        : m.authorName || "Клиент"}
                      {" · "}
                      {formatDateTime(m.createdAt)}
                    </div>
                    {m.body ? <div className="whitespace-pre-wrap break-words">{m.body}</div> : null}
                    <MessageAttachments attachments={m.attachments} light={m.author === "operator"} />
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="shrink-0 border-t border-[#ececf4] p-3">
              <AttachmentChips uploads={files.uploads} onRemove={files.remove} />
              <div className="flex items-end gap-2">
                <AttachButton onFiles={files.addFiles} disabled={busy} />
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onPaste={files.handlePaste}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder={`Ответить как ${brandName}`}
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-[#dcdfed] px-3.5 py-3 text-[14px] text-[#0b1024] placeholder:text-[#9b9fb3] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={
                    busy ||
                    files.uploading ||
                    (draft.trim().length < 2 && files.readyAttachments.length === 0)
                  }
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#5566f6] text-white transition-colors hover:bg-[#4a5bf0] disabled:opacity-50"
                  aria-label="Отправить"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[#9b9fb3]">
                Клиент получит сообщение в чате кабинета, в Telegram и в колокольчике.
              </p>
            </div>
          </>
        )}
      </Card>

      <ComposeDialog
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        clients={clients}
        brandName={brandName}
        onSent={(threadId) => {
          setComposeOpen(false);
          void loadList();
          select(threadId);
        }}
      />
    </div>
  );
}

/** «Написать клиенту»: выбрать организацию и отправить первое сообщение. */
function ComposeDialog({
  open,
  onClose,
  clients,
  brandName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientRow[];
  brandName: string;
  onSent: (threadId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients;
  }, [clients, query]);
  const chosen = clients.find((c) => c.organizationId === orgId) ?? null;

  async function submit() {
    if (!orgId || text.trim().length < 2) return;
    setBusy(true);
    try {
      const response = await fetch("/api/partner/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, message: text.trim() }),
      });
      if (!response.ok) throw new Error(await readError(response, "Не удалось отправить"));
      const data = await response.json();
      toast.success(`Отправлено: ${chosen?.name ?? "клиенту"}`);
      setText("");
      setOrgId(null);
      setQuery("");
      onSent(data.threadId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : null)}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Написать клиенту</DialogTitle>
          <DialogDescription>
            Сообщение появится в чате кабинета организации — со звуком и всплывающим
            уведомлением, а руководство получит его в Telegram.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#9b9fb3]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти организацию"
              className={cn(inputClass, "pl-10")}
            />
          </div>
          <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-2xl border border-[#ececf4] p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[13px] text-[#9b9fb3]">Ничего не найдено</div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.organizationId}
                  type="button"
                  onClick={() => setOrgId(c.organizationId)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] transition-colors",
                    orgId === c.organizationId
                      ? "bg-[#5566f6] text-white"
                      : "text-[#0b1024] hover:bg-[#f5f6ff]"
                  )}
                >
                  <Building2 className="size-4 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.threadId ? (
                    <span className="shrink-0 text-[11px] opacity-70">есть переписка</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder={`Сообщение от ${brandName}`}
            className={textareaClass}
          />
        </div>
        <DialogFooter>
          <button type="button" onClick={onClose} className={btnOutline}>
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !orgId || text.trim().length < 2}
            className={btnPrimary}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Отправить
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
