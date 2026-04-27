"use client";

/**
 * D5 — Haptic feedback в Mini App. Telegram Mini App API даёт
 * `WebApp.HapticFeedback.notificationOccurred("success" | "warning" | "error")`
 * и `.impactOccurred("light" | "medium" | "heavy")`.
 *
 * Используется в кнопках submit/cancel/error чтобы UI чувствовался
 * native-mobile. Без этого Mini App кажется «плоским».
 *
 * Если WebApp недоступен (открыто в браузере для тестов) — silent no-op.
 */
type HapticType = "success" | "warning" | "error" | "light" | "medium" | "heavy";

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
  if (!h) return;
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
