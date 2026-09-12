"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { toast } from "sonner";

import { haptic } from "./use-haptic";

/**
 * Кнопка «Поделиться» — системное меню телефона.
 *
 * Сценарий: инспектор стоит на кухне и просит журнал за месяц. Сейчас
 * единственный путь — скачать файл и потом искать, чем его открыть и как
 * отправить. Системное меню решает это за два касания: AirDrop, почта,
 * мессенджер — тем, чем человек и так пользуется.
 *
 * Где не поддерживается — кнопки просто нет, а не «есть и не работает».
 * Проверяем на клиенте после монтирования: на сервере `navigator` нет, и
 * рендер разошёлся бы с гидратацией.
 */
export function ShareButton({
  title,
  text,
  url,
  className,
}: {
  title: string;
  text?: string;
  /** Относительный путь или полный адрес; относительный дополняем сами. */
  url: string;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      className={
        className ??
        "mini-press inline-flex h-10 items-center gap-2 rounded-2xl px-4 text-[13.5px] font-medium"
      }
      style={
        className
          ? undefined
          : { background: "var(--mini-surface-2)", color: "var(--mini-text)" }
      }
      onClick={async () => {
        haptic("light");
        try {
          await navigator.share({
            title,
            text,
            url: url.startsWith("http") ? url : `${window.location.origin}${url}`,
          });
        } catch (error) {
          // Отмена в системном меню — это не ошибка: человек передумал.
          // Ругаться на неё значит приучить не доверять сообщениям.
          if ((error as Error)?.name === "AbortError") return;
          toast.error("Не удалось поделиться");
        }
      }}
    >
      <Share2 className="size-4" />
      Поделиться
    </button>
  );
}
