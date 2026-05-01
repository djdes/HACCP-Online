import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  ListChecks,
  Package,
  ScrollText,
} from "lucide-react";
import { getFillingGuide } from "@/lib/journal-filling-guides";
import { getJournalSpec } from "@/lib/journal-specs";

type Props = {
  journalCode: string;
  /// Если true — рендер сразу раскрытым (для standalone-страницы).
  /// Если false (default) — внутри <details> для inline-collapsible.
  expanded?: boolean;
};

/**
 * Гайд «Как правильно заполнить журнал» — для нового сотрудника.
 * Server-component (нет client-state). Используется:
 *   • inline в DynamicForm (collapsible сверху формы)
 *   • standalone /journals/<code>/guide (всегда открыто)
 */
export function JournalGuide({ journalCode, expanded = false }: Props) {
  const guide = getFillingGuide(journalCode);
  const spec = getJournalSpec(journalCode);
  if (!guide) {
    // Fallback — хоть что-то показать.
    return (
      <div className="rounded-2xl border border-[#5566f6]/15 bg-[#f5f6ff]/50 p-3 text-[12.5px] leading-snug text-[#3848c7]">
        <strong>{spec.shortDescription}</strong>
        <div className="mt-1 text-[11.5px] text-[#6f7282]">
          {spec.regulation}
        </div>
      </div>
    );
  }

  const body = (
    <div className="space-y-4 p-4 sm:p-5">
      <div>
        <div className="flex items-start gap-2 text-[13px] leading-snug text-[#3c4053]">
          <BookOpenText className="mt-0.5 size-4 shrink-0 text-[#5566f6]" />
          <span>{guide.summary}</span>
        </div>
      </div>

      {guide.materials.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3848c7]">
            <Package className="size-3.5" />
            Что взять
          </div>
          <ul className="space-y-1 text-[12.5px] text-[#3c4053]">
            {guide.materials.map((m, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 inline-block size-1.5 shrink-0 rounded-full bg-[#5566f6]" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#3848c7]">
          <ListChecks className="size-3.5" />
          Шаги — по порядку
        </div>
        <ol className="space-y-2.5">
          {guide.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#5566f6] text-[11px] font-semibold text-white">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold leading-tight text-[#0b1024]">
                  {step.title}
                </div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-[#3c4053]">
                  {step.detail}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <div className="flex items-start gap-2 text-[12.5px]">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
          <div>
            <div className="font-semibold text-emerald-800">
              Когда задача считается выполненной
            </div>
            <div className="mt-0.5 text-emerald-900/80">
              {guide.completionCriteria}
            </div>
          </div>
        </div>
      </div>

      {guide.commonMistakes.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2 text-[12.5px]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <div className="font-semibold text-amber-800">
                Типичные ошибки новичков — НЕ делай так
              </div>
              <ul className="mt-1 space-y-1 text-amber-900/80">
                {guide.commonMistakes.map((m, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-amber-600" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl bg-[#fafbff] p-3 text-[11.5px] text-[#6f7282]">
        <div className="flex items-start gap-1.5">
          <ScrollText className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <div className="font-semibold text-[#3c4053]">Норматив</div>
            <div className="mt-0.5">{guide.regulationRef}</div>
          </div>
        </div>
      </div>
    </div>
  );

  if (expanded) {
    return (
      <div className="overflow-hidden rounded-3xl border border-[#5566f6]/30 bg-white shadow-[0_0_0_1px_rgba(85,102,246,0.1)]">
        <div className="border-b border-[#ececf4] bg-gradient-to-br from-[#f5f6ff] to-white p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <BookOpenText className="size-5 text-[#5566f6]" />
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              Как правильно заполнить
            </h2>
          </div>
        </div>
        {body}
      </div>
    );
  }

  return (
    <details className="group overflow-hidden rounded-2xl border border-[#5566f6]/20 bg-gradient-to-br from-[#f5f6ff]/50 to-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 transition-colors hover:bg-[#f5f6ff]/80 sm:p-4">
        <div className="flex items-center gap-2">
          <BookOpenText className="size-4 text-[#5566f6]" />
          <span className="text-[13px] font-semibold text-[#3848c7]">
            📖 Как правильно заполнить — открой если первый раз
          </span>
        </div>
        <span className="text-[11px] text-[#9b9fb3] group-open:hidden">
          раскрыть ↓
        </span>
        <span className="hidden text-[11px] text-[#9b9fb3] group-open:inline">
          свернуть ↑
        </span>
      </summary>
      <div className="border-t border-[#ececf4]">{body}</div>
    </details>
  );
}
