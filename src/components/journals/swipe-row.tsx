"use client";

import { useRef, useState, type ReactNode } from "react";

import { haptic } from "@/app/mini/_components/use-haptic";
import {
  canStartSwipe,
  decideSwipe,
  swipeOffset,
} from "@/components/journals/swipe-gesture";

export type SwipeAction = {
  label: string;
  icon?: ReactNode;
  /** Фон подсказки, выезжающей из-под строки. */
  tone: "ok" | "neutral";
  onRun: () => void;
};

/**
 * Строка журнала, которую можно смахнуть.
 *
 * Вправо — поставить обычное значение («Зд.», «выполнено»), влево —
 * открыть выбор. Смена на девяти сотрудниках закрывается девятью
 * движениями, без прицеливания в кнопку 44 px мокрым пальцем.
 *
 * Жест ставит запись в журнал, поэтому:
 *   • распознавание вынесено в `swipe-gesture.ts` под тест — случайное
 *     движение не должно подписать смену;
 *   • у левого края мёртвая зона: там системный «назад» на iOS;
 *   • `touch-action: pan-y` оставляет вертикальную прокрутку системе,
 *     мы разбираем только горизонталь;
 *   • вызывающий ОБЯЗАН дать отмену — см. `useJournalUndo`.
 *
 * Обычное нажатие внутри строки не ломается: пока порог не пройден, мы
 * ничего не перехватываем и клик уходит кнопке как раньше.
 */
export function SwipeRow({
  children,
  right,
  left,
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  right?: SwipeAction;
  left?: SwipeAction;
  disabled?: boolean;
  className?: string;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  // `armed` рисуется (подпись подсказки появляется только когда порог
  // пройден), поэтому это состояние, а не ref.
  const [armed, setArmed] = useState<"left" | "right" | null>(null);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  const enabled = !disabled && (Boolean(right) || Boolean(left));

  function reset() {
    start.current = null;
    setArmed(null);
    setSettling(true);
    setOffset(0);
    // Возврат строки на место анимируем, а сам жест — нет: во время
    // движения строка обязана идти за пальцем без задержки.
    window.setTimeout(() => setSettling(false), 180);
  }

  function onPointerDown(event: React.PointerEvent) {
    if (!enabled || event.pointerType === "mouse") return;
    const point = { x: event.clientX, y: event.clientY };
    if (!canStartSwipe(point)) return;
    start.current = point;
    setArmed(null);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!start.current) return;
    const decision = decideSwipe(start.current, {
      x: event.clientX,
      y: event.clientY,
    });

    if (decision.kind === "scroll") {
      // Это прокрутка списка — отпускаем и больше не мешаем.
      start.current = null;
      setArmed(null);
      setOffset(0);
      return;
    }

    const dx = event.clientX - start.current.x;
    // Показываем сдвиг только в ту сторону, где есть действие: тянуть
    // строку туда, где ничего не произойдёт, — обман.
    if ((dx > 0 && !right) || (dx < 0 && !left)) return;

    setOffset(swipeOffset(dx));
    setArmed(
      decision.kind === "left" || decision.kind === "right"
        ? decision.kind
        : null,
    );
  }

  function onPointerUp() {
    if (!start.current) return;
    const action = armed === "right" ? right : armed === "left" ? left : null;
    if (action) {
      haptic("success");
      action.onRun();
    }
    reset();
  }

  const revealed = armed !== null;
  const hint = offset > 0 ? right : offset < 0 ? left : null;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {hint ? (
        <div
          aria-hidden
          className={`absolute inset-y-0 flex items-center gap-2 px-4 text-[13px] font-semibold ${
            offset > 0 ? "left-0 justify-start" : "right-0 justify-end"
          } ${
            hint.tone === "ok"
              ? "text-[#116b2a]"
              : "text-[#3848c7]"
          }`}
          style={{
            background: hint.tone === "ok" ? "#ecfdf5" : "#eef1ff",
            width: `${Math.abs(offset) + 24}px`,
            opacity: revealed ? 1 : 0.65,
          }}
        >
          {hint.icon}
          {revealed ? hint.label : null}
        </div>
      ) : null}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={reset}
        style={{
          transform: `translateX(${offset}px)`,
          transition: settling ? "transform 180ms ease-out" : undefined,
          // Вертикаль оставляем системе — иначе список перестанет
          // прокручиваться пальцем по строкам.
          touchAction: enabled ? "pan-y" : undefined,
        }}
        className="relative"
      >
        {children}
      </div>
    </div>
  );
}
