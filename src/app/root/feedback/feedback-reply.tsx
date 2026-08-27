"use client";

import { useState } from "react";
import { MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** Куда ответ уйдёт — говорим до отправки, а не «куда-то в базу». */
function describeChannels(args: {
  hasRecipient: boolean;
  hasTelegram: boolean;
  hasEmail: boolean;
}): string {
  const channels: string[] = [];
  if (args.hasRecipient) channels.push("уведомления в приложении");
  if (args.hasTelegram) channels.push("Telegram");
  if (args.hasEmail) channels.push("почта");
  return channels.length > 0
    ? `Ответ придёт: ${channels.join(" · ")}.`
    : "У автора нет ни аккаунта, ни Telegram, ни почты: ответ сохранится, но доставить его некуда.";
}

export function FeedbackReply({
  reportId,
  hasRecipient,
  hasTelegram,
  hasEmail,
}: {
  reportId: string;
  hasRecipient: boolean;
  hasTelegram: boolean;
  hasEmail: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/root/feedback/${reportId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Не удалось отправить ответ");

      // Показываем только реально сработавшие каналы: иначе «отправлено»
      // означало бы всего лишь «записано в базу», как было раньше.
      const delivered: string[] = [];
      if (data?.channels?.inApp) delivered.push("в приложении");
      if (data?.channels?.telegram) delivered.push("Telegram");
      if (data?.channels?.email) delivered.push("почта");

      if (delivered.length > 0) {
        toast.success(`Ответ отправлен: ${delivered.join(" · ")}`);
      } else {
        toast.warning("Ответ сохранён, но доставить его не удалось ни по одному каналу");
      }
      setOpen(false);
      setMessage("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отправить ответ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg text-[12px]">
          <MessageSquareReply className="size-3.5" />
          Ответить
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Ответ на обращение</DialogTitle>
          <DialogDescription>
            {describeChannels({ hasRecipient, hasTelegram, hasEmail })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Текст ответа" rows={6} maxLength={5000} required />
          <DialogFooter>
            <Button type="submit" disabled={submitting}>{submitting ? "Отправляем…" : "Отправить ответ"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
