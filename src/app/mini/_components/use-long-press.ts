"use client";

import { useCallback, useEffect, useRef } from "react";

import {
  LONG_PRESS_MS,
  isLongPressCancelled,
  type PressPoint,
} from "@/lib/long-press";

import { haptic } from "./use-haptic";

/**
 * Обработчики долгого нажатия для карточки списка.
 *
 * Возвращает готовый набор для `<div>`/`<a>`. Ссылку не отменяем: если
 * человек отпустил раньше времени, это обычный тап и он должен
 * сработать как раньше. Отменяем только когда жест УЖЕ сработал —
 * иначе после меню ещё и произойдёт переход.
 *
 * На iOS долгое удержание поднимает системное меню выделения. Гасим
 * его через `-webkit-touch-callout: none` на самой карточке (класс
 * `.mini-press` в `mini-theme.css` это уже делает) — тело карточки при
 * этом остаётся выделяемым там, где текст нужен целиком.
 */
export function useLongPress(onLongPress: (() => void) | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<PressPoint | null>(null);
  const fired = useRef(false);
  const handler = useRef(onLongPress);

  useEffect(() => {
    handler.current = onLongPress;
  }, [onLongPress]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  if (!onLongPress) return {};

  return {
    onTouchStart: (event: React.TouchEvent) => {
      if (event.touches.length !== 1) return clear();
      fired.current = false;
      start.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
      timer.current = setTimeout(() => {
        fired.current = true;
        // Отклик обязателен: иначе непонятно, сработало ли, и палец
        // держат «на всякий случай» ещё секунду.
        haptic("medium");
        handler.current?.();
      }, LONG_PRESS_MS);
    },
    onTouchMove: (event: React.TouchEvent) => {
      const from = start.current;
      if (!from) return;
      const touch = event.touches[0];
      if (!touch) return clear();
      if (isLongPressCancelled(from, { x: touch.clientX, y: touch.clientY })) {
        clear();
      }
    },
    onTouchEnd: (event: React.TouchEvent) => {
      clear();
      // Жест уже сработал — переход по ссылке был бы вторым действием
      // на одно движение.
      if (fired.current) event.preventDefault();
    },
    onTouchCancel: clear,
    onContextMenu: (event: React.MouseEvent) => {
      // Контекстное меню браузера поверх нашего листа — на телефоне
      // это просто два меню сразу.
      event.preventDefault();
    },
  };
}
