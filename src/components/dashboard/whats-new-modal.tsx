"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const STORAGE_KEY = "wesetup.last-seen-build-sha";

type Props = {
  buildSha: string;
  /** Заметки на текущую версию. Меняются вместе с buildSha. */
  notes: string[];
};

/**
 * При первом заходе после новой сборки показываем modal со списком
 * новинок. Юзер видит изменения в lifecycle'е.
 *
 * Логика:
 *   1. На сервере рендерится с props.buildSha (eb52b71 etc).
 *   2. На клиенте useEffect читает localStorage[STORAGE_KEY].
 *   3. Если != currentSha → показываем modal.
 *   4. Закрытие → пишем currentSha в localStorage.
 */
export function WhatsNewModal({ buildSha, notes }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Первый визит вообще — не показываем (нет «новинок» для нового
        // юзера). Просто записываем текущий sha.
        window.localStorage.setItem(STORAGE_KEY, buildSha);
        return;
      }
      if (seen !== buildSha) {
        setOpen(true);
      }
    } catch {
      /* localStorage недоступен — skip */
    }
  }, [buildSha]);

  function dismiss() {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, buildSha);
    } catch {
      /* ignore */
    }
  }

  if (!open || notes.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_30px_80px_-20px_rgba(11,16,36,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <Sparkles className="size-6" />
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1.5 text-[#9b9fb3] hover:bg-[#fafbff] hover:text-[#0b1024]"
            aria-label="Закрыть"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Что нового в WeSetup
        </h2>
        <p className="mt-1 text-[13px] text-[#6f7282]">
          Сборка <span className="font-mono text-[#3848c7]">{buildSha}</span> ·{" "}
          {new Date().toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
        <ul className="mt-5 space-y-2">
          {notes.map((note, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-3 py-2 text-[13px] text-[#3c4053]"
            >
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#5566f6]" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={dismiss}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0]"
        >
          Спасибо, понял
        </button>
      </div>
    </div>
  );
}
