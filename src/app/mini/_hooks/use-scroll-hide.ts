"use client";

import { useEffect, useRef, useState } from "react";

import {
  INITIAL_SCROLL_HIDE_STATE,
  nextScrollHideState,
  type ScrollHideState,
} from "../_lib/scroll-direction";

/**
 * `true`, когда главное действие пора убрать с экрана.
 *
 * Решение о видимости принимает чистая функция (`scroll-direction.ts`) —
 * здесь остаётся только подписка. Слушатель пассивный и разбирается
 * через `requestAnimationFrame`: обработчик скролла, который считает на
 * каждом событии, сам же скролл и тормозит.
 *
 * Навигацию этим прятать нельзя — человек потеряет выход. Только
 * кнопку действия.
 */
export function useScrollHide(enabled = true): boolean {
  const [hidden, setHidden] = useState(false);
  const stateRef = useRef<ScrollHideState>(INITIAL_SCROLL_HIDE_STATE);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const next = nextScrollHideState(stateRef.current, window.scrollY);
        if (next === stateRef.current) return;
        stateRef.current = next;
        setHidden(next.hidden);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [enabled]);

  // При выключенном хуке отвечаем «видно» сразу, а не гасим состояние
  // в эффекте: иначе короткий список успевал мигнуть спрятанной
  // кнопкой на один кадр.
  return enabled ? hidden : false;
}
