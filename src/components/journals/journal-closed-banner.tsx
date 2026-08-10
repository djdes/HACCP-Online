import { Lock } from "lucide-react";

/**
 * Баннер «журнал закрыт — только просмотр».
 *
 * Раньше закрытый документ просто молча отключал контролы, и
 * пользователь не понимал, почему ничего не нажимается (принцип UX №2 —
 * «каждый раз должно быть абсолютно понятно»). Показываем янтарную
 * карточку с замком над таблицей.
 *
 * `print:hidden` — в бумажной версии баннер не нужен: инспектор смотрит
 * на данные, а не на состояние UI.
 *
 * Использование:
 *   {status !== "active" ? <JournalClosedBanner /> : null}
 */
export function JournalClosedBanner({
  /** Чем именно нельзя управлять — уточнение во второй строке. */
  hint = "Откройте журнал заново, чтобы редактировать отметки и записи.",
  className = "",
}: {
  hint?: string;
  className?: string;
} = {}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border border-[#ffe9b0] bg-[#fff8eb] px-4 py-3 print:hidden ${className}`}
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[#b25f00]">
        <Lock className="size-4" />
      </span>
      <div className="text-[13px] leading-[1.55] text-[#7a4a00]">
        <div className="text-[14px] font-semibold text-[#5c3800]">
          Журнал закрыт — только просмотр
        </div>
        {hint}
      </div>
    </div>
  );
}
