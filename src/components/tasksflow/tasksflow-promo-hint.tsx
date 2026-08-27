"use client";

import { ExternalLink, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  TASKSFLOW_PROMO_BENEFIT,
  TASKSFLOW_PROMO_CODE,
  tasksflowPromoUrl,
} from "@/lib/tasksflow-promo";

/**
 * Промо-подсказка «подключите TasksFlow» под полем телефона.
 *
 * Показывается там, где пользователь вводит номер: именно номер —
 * ключ автосвязки аккаунтов, поэтому объяснение выгоды уместно ровно
 * в этот момент. Если интеграция уже подключена (`hasIntegration`),
 * рекламировать нечего — остаётся только строка про автосвязку.
 */
export function TasksFlowPromoHint({
  campaign,
  hasIntegration = false,
  autolinkNote = "Если у сотрудника уже есть TasksFlow с этим номером — свяжем аккаунты автоматически.",
}: {
  /** Точка входа для utm_campaign: `staff_add`, `register_nudge`, ... */
  campaign: string;
  hasIntegration?: boolean;
  autolinkNote?: string;
}) {
  if (hasIntegration) {
    return (
      <p className="mt-1 text-[11px] leading-snug text-[#6f7282]">
        {autolinkNote}
      </p>
    );
  }

  async function copyPromo() {
    try {
      await navigator.clipboard.writeText(TASKSFLOW_PROMO_CODE);
      toast.success("Промокод скопирован");
    } catch {
      toast.error("Не удалось скопировать — выделите код вручную");
    }
  }

  return (
    <div className="mt-2 rounded-xl bg-[#f5f6ff] p-3 text-[12px] leading-[1.5] text-[#3c4053]">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-[#eef1ff] text-[#5566f6]">
          <Zap className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[#0b1024]">
            Подключите сервис TasksFlow.ru
          </p>
          <p className="mt-0.5">
            Чтобы ставить производственные задачи и связывать их с журналами.
          </p>
          <p className="mt-1.5">
            Промокод{" "}
            <button
              type="button"
              onClick={copyPromo}
              title="Скопировать промокод"
              className="rounded-full bg-white px-2 py-0.5 font-semibold tracking-[0.04em] text-[#3848c7] ring-1 ring-[#dcdfed] transition-colors hover:bg-[#eef1ff] hover:ring-[#5566f6]/40"
            >
              {TASKSFLOW_PROMO_CODE}
            </button>{" "}
            даёт {TASKSFLOW_PROMO_BENEFIT}
          </p>
          <a
            href={tasksflowPromoUrl(campaign)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-medium text-[#5566f6] transition-colors hover:text-[#3848c7]"
          >
            Перейти с промокодом
            <ExternalLink className="size-3" />
          </a>
          <p className="mt-2 text-[#6f7282]">{autolinkNote}</p>
        </div>
      </div>
    </div>
  );
}
