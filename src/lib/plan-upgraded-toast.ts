"use client";

import { toast } from "sonner";

/**
 * Единый toast «вы перешли на платный тариф».
 *
 * Показывается там, где API вернул `planUpgraded: true` — то есть
 * добавление сотрудника перевалило за бесплатные 5 мест. Текст один на
 * все точки входа: смена тарифа не должна выглядеть по-разному в
 * приглашении, массовом импорте и карточке сотрудника.
 */
export function toastPlanUpgraded(): void {
  toast.info("Команда больше 5 человек — вы перешли на платный тариф", {
    description:
      "Пока сайт в тестовом режиме, оплата не требуется.",
    duration: 10000,
    action: {
      label: "Подробнее",
      onClick: () => {
        window.location.href = "/settings/subscription";
      },
    },
  });
}
