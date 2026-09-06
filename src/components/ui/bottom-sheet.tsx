"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { lockBodyScroll, unlockBodyScroll } from "@/lib/use-body-scroll-lock";
import {
  MODAL_BODY_CLASS,
  MODAL_CARD_HEIGHT_CLASS,
} from "@/components/ui/modal-tokens";

/**
 * Лист снизу — мобильный формат меню, как в приложениях.
 *
 * Зачем: выпадающее меню профиля на телефоне открывалось «облаком» у
 * правого края, второй уровень (подменю «Тема») уезжал за экран, а
 * пункты были мелкими. Лист снизу решает всё сразу: он во всю ширину,
 * пункты крупные, закрывается крестиком, свайпом по фону или Esc.
 *
 * Портал в `document.body` обязателен: полотно дашборда обёрнуто в блок
 * с `translate: -50%`, и `position: fixed` внутри считался бы от него
 * (см. `modal-tokens.ts`).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-end justify-center"
    >
      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="absolute inset-0 bg-[#0b1024]/40 backdrop-blur-sm"
      />

      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-t-3xl border border-[#ececf4] bg-white shadow-[0_-20px_60px_-30px_rgba(11,16,36,0.5)] animate-in slide-in-from-bottom-6 duration-200 ${MODAL_CARD_HEIGHT_CLASS}`}
      >
        <div className="shrink-0 px-4 pb-3 pt-3">
          {/* Полоска-«ручка»: узнаваемый признак листа снизу. */}
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#e6e8f2]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold leading-tight text-[#0b1024]">
                {title}
              </div>
              {subtitle ? (
                <div className="mt-0.5 truncate text-[12.5px] text-[#6f7282]">
                  {subtitle}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f5f6ff] text-[#6f7282] transition-colors hover:bg-[#eef1ff] hover:text-[#0b1024]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className={`${MODAL_BODY_CLASS} border-t border-[#f0f1f7] px-3 py-2`}>
          {children}
        </div>

        {footer ? (
          <div className="shrink-0 border-t border-[#f0f1f7] bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : (
          <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />
        )}
      </div>
    </div>,
    document.body
  );
}

/** Строка листа — крупная, как в мобильных приложениях. */
export const SHEET_ROW_CLASS =
  "flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left text-[15px] text-[#0b1024] transition-colors hover:bg-[#f5f6ff] active:bg-[#eef1ff]";

/** Подпись группы строк. */
export const SHEET_GROUP_LABEL_CLASS =
  "px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]";
