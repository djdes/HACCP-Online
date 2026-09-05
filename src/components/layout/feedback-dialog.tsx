"use client";
import { phoneInputProps } from "@/lib/phone-input";

import { useState } from "react";
import { MessageCircleMore } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "suggestion";

type FeedbackDialogProps = {
  telegramBotUsername: string;
  triggerClassName?: string;
  /**
   * Свой триггер вместо кнопки шапки. Нужен там, где форма живёт не в
   * правом кластере хедера, а карточкой в списке — например на
   * `/mini/me`: там иконко-кнопка 40×40 с подписью, скрытой до `sm`,
   * выглядела бы безымянным квадратом.
   */
  trigger?: React.ReactNode;
};

export function FeedbackDialog({
  telegramBotUsername,
  triggerClassName,
  trigger,
}: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType | "">("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const botUrl = telegramBotUsername
    ? `https://t.me/${telegramBotUsername.replace(/^@/, "")}`
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type) {
      toast.error("Выберите тип обращения");
      return;
    }
    if (message.trim().length < 3) {
      toast.error("Введите сообщение");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, message: message.trim(), phone: phone.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error ?? "Не удалось отправить обращение");
        return;
      }
      toast.success("Спасибо! Мы ответим в течение 5 рабочих дней.");
      setOpen(false);
      setType("");
      setMessage("");
      setPhone("");
    } catch {
      toast.error("Ошибка соединения с сервером");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            className={cn(
              // Единственный primary-контрол в правом кластере шапки:
              // та же геометрия (h-10 / rounded-lg / size-5 иконка), что и у
              // tinted-кнопок рядом, но со сплошной индиго-заливкой.
              "h-10 w-10 shrink-0 gap-2 rounded-lg bg-[#5566f6] px-3.5 text-[14px] font-semibold text-white shadow-[0_8px_20px_-12px_rgba(85,102,246,0.6)] transition-colors duration-200 hover:bg-[#4a5bf0]",
              // До sm подпись скрыта — тогда кнопка должна быть квадратом
              // 40×40, как остальные иконко-кнопки шапки.
              "max-sm:px-0 sm:w-auto",
              triggerClassName
            )}
          >
            <MessageCircleMore className="size-5" />
            <span className="hidden sm:inline">Обратная связь</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[18px] font-semibold text-[#0b1024]">
            Оставить обратную связь
          </DialogTitle>
          <DialogDescription className="sr-only">
            Форма обратной связи: описание проблемы или предложения, контактный
            телефон.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div className="space-y-4 text-[14px] leading-[1.55] text-[#3c4053]">
            <p>
              В данной форме вы можете оставить обратную связь по использованию
              сервиса. Вы можете описать о какой-то ошибке или ваши предложения
              по улучшению удобства сервиса.
            </p>
            <p className="italic">
              Обращаем ваше внимание, что{" "}
              <b className="font-semibold not-italic">
                обращения по данной форме обрабатываются в течении 5 рабочих
                дней
              </b>{" "}
              и если вам нужна какая-то оперативная помощь по сервису, обратитесь
              в службу поддержки в Telegram.{" "}
              {botUrl ? (
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-[#5566f6] underline-offset-2 hover:underline"
                >
                  {botUrl}
                </a>
              ) : null}
            </p>
          </div>

          <div className="space-y-3">
            <div className="text-[15px] font-semibold text-[#0b1024]">
              Выберите тип обращения
            </div>
            <div className="flex flex-wrap gap-6">
              <RadioOption
                name="feedback-type"
                value="bug"
                label="Ошибка"
                checked={type === "bug"}
                onChange={() => setType("bug")}
              />
              <RadioOption
                name="feedback-type"
                value="suggestion"
                label="Предложение"
                checked={type === "suggestion"}
                onChange={() => setType("suggestion")}
              />
            </div>
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ваше обращение"
            required
            rows={5}
            // На мобиле 16px: iOS Safari зумит страницу при фокусе в поле
            // со шрифтом меньше 16px. На десктопе оставляем прежние 14px.
            className="resize-none rounded-xl border-[#e2e5ef] bg-white text-[16px] placeholder:text-[#9b9fb3] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 sm:text-[14px]"
          />

          <Input
            {...phoneInputProps(phone, setPhone)}
            placeholder="Введите номер телефона для ответа"
            type="tel"
            inputMode="tel"
            // Те же 16px на мобиле, что и у поля выше — иначе телефон
            // «прыгает» в зум ровно на этом поле.
            className="h-11 rounded-xl border-[#e2e5ef] bg-white text-[16px] placeholder:text-[#9b9fb3] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 sm:text-[14px]"
          />

          <DialogFooter className="flex-row justify-end gap-2 px-0">
            <Button
              type="submit"
              disabled={submitting}
              className="h-11 min-w-[140px] rounded-xl bg-[#5566f6] text-[15px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
            >
              {submitting ? "Отправляем..." : "Отправить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RadioOption({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <span className="relative inline-flex size-5 items-center justify-center">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="peer size-5 appearance-none rounded-full border-2 border-[#d0d4e6] bg-white outline-none transition-colors checked:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 m-auto size-2.5 rounded-full bg-[#5566f6] transition-opacity",
            checked ? "opacity-100" : "opacity-0"
          )}
        />
      </span>
      <span className="text-[14px] text-[#0b1024]">{label}</span>
    </label>
  );
}
