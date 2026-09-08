"use client";

/**
 * D5 — Haptic feedback в Mini App. Telegram Mini App API даёт
 * `WebApp.HapticFeedback.notificationOccurred("success" | "warning" | "error")`
 * и `.impactOccurred("light" | "medium" | "heavy")`.
 *
 * Используется в кнопках submit/cancel/error чтобы UI чувствовался
 * native-mobile. Без этого Mini App кажется «плоским».
 *
 * Вне Telegram (браузер, установленное приложение) `HapticFeedback`
 * нет — там откатываемся на `navigator.vibrate`. Это не то же самое:
 * Taptic Engine даёт щелчок, вибромотор — гудение, поэтому длительности
 * взяты короткие. На iOS `vibrate` не поддерживается вовсе, и это
 * осознанно оставлено без обходного пути: подделывать отклик там нечем.
 */
type HapticType = "success" | "warning" | "error" | "light" | "medium" | "heavy";

/** Длительности подобраны так, чтобы отличать «принято» от «ошибка». */
const VIBRATE_PATTERN: Record<HapticType, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  success: 16,
  warning: [14, 60, 14],
  error: [22, 60, 22],
};

function vibrateFallback(type: HapticType): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(VIBRATE_PATTERN[type]);
  } catch {
    /* политика браузера может запрещать вибрацию без жеста */
  }
}

type TgHaptic = {
  notificationOccurred?: (type: "success" | "warning" | "error") => void;
  impactOccurred?: (style: "light" | "medium" | "heavy") => void;
};

function getHaptic(): TgHaptic | null {
  if (typeof window === "undefined") return null;
  const tg = (window as unknown as {
    Telegram?: { WebApp?: { HapticFeedback?: TgHaptic } };
  }).Telegram?.WebApp?.HapticFeedback;
  return tg ?? null;
}

export function haptic(type: HapticType): void {
  const h = getHaptic();
  if (!h) {
    vibrateFallback(type);
    return;
  }
  try {
    if (type === "success" || type === "warning" || type === "error") {
      h.notificationOccurred?.(type);
    } else {
      h.impactOccurred?.(type);
    }
  } catch {
    /* old Telegram client — silent */
  }
}

/**
 * Hook-форма для удобного использования в коде. Возвращает функцию
 * `triggerHaptic(type)` — её можно вызвать в onClick / onSubmit.
 *
 * Пример:
 *   const trigger = useHaptic();
 *   <button onClick={() => { doSubmit(); trigger("success"); }} />
 */
export function useHaptic() {
  return haptic;
}
