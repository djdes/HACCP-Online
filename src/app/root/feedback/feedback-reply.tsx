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

export function FeedbackReply({ reportId, hasRecipient }: { reportId: string; hasRecipient: boolean }) {
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
      toast.success(data?.notified ? "Ответ отправлен, пользователь получит уведомление" : "Ответ сохранён. Уведомление пользователю недоступно");
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
            {hasRecipient ? "Пользователь получит ответ в уведомлениях приложения." : "Автор не привязан к аккаунту: ответ сохранится, но уведомление отправить нельзя."}
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
