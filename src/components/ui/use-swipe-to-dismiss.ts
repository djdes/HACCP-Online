"use client";

import { useRef, useState, type CSSProperties, type PointerEvent } from "react";

/**
 * Свайп вниз закрывает лист — привычный жест мобильных приложений.
 *
 * Возвращает обработчики для карточки листа и стиль сдвига. Тянуть можно
 * за шапку и за тело, но тело — только когда прокручено в самый верх:
 * иначе жест внутри длинного списка утаскивал бы весь лист вместо
 * прокрутки.
 *
 * Смещение живёт и в ref, и в state: state перерисовывает карточку, ref
 * нужен решению «закрыть или вернуть» — оно не должно зависеть от того,
 * успел ли React перерисоваться между move и up.
 */
export function useSwipeToDismiss(
  onClose: () => void,
  options: { scrollRef?: { current: HTMLElement | null } } = {}
): {
  dragProps: {
    onPointerDown: (event: PointerEvent) => void;
    onPointerMove: (event: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  };
  dragStyle: CSSProperties | undefined;
  dragging: boolean;
} {
  const start = useRef<{ y: number; time: number } | null>(null);
  const offset = useRef(0);
  const [dragY, setDragY] = useState(0);

  function onPointerDown(event: PointerEvent) {
    // Мышью лист не таскают — там есть крестик и клик по фону.
    if (event.pointerType === "mouse") return;
    const scroller = options.scrollRef?.current;
    const target = event.target as HTMLElement;
    if (scroller && scroller.contains(target) && scroller.scrollTop > 0) return;
    start.current = { y: event.clientY, time: Date.now() };
  }

  function onPointerMove(event: PointerEvent) {
    if (!start.current) return;
    const delta = event.clientY - start.current.y;
    offset.current = delta > 0 ? delta : 0;
    setDragY(offset.current);
  }

  function end() {
    const began = start.current;
    const moved = offset.current;
    start.current = null;
    offset.current = 0;
    setDragY(0);
    if (!began) return;
    // Быстрый короткий флик закрывает так же, как медленное долгое
    // перетаскивание.
    const fast = Date.now() - began.time < 300 && moved > 60;
    if (moved > 120 || fast) onClose();
  }

  return {
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
    dragStyle:
      dragY > 0
        ? { transform: `translateY(${dragY}px)`, transition: "none" }
        : undefined,
    dragging: dragY > 0,
  };
}
