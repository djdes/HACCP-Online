"use client";

import type { ReactNode } from "react";
import { DocumentBackLink } from "@/components/journals/document-back-link";

/**
 * Унифицированный toolbar страницы документа в Design v2.
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ ← Назад · Документ #142                                    │
 *   │                                                             │
 *   │ {Title}                            [Печать][Настройки][...]│
 *   └────────────────────────────────────────────────────────────┘
 *
 * Скрыт при печати (`print:hidden`).
 *
 * Использование:
 *
 *   <JournalToolbar
 *     backHref="/journals/cleaning"
 *     documentId={documentId}
 *     title={title}
 *     rightActions={
 *       <>
 *         <PrintButton />
 *         <SettingsButton />
 *         <CloseJournalButton />
 *       </>
 *     }
 *   />
 *
 * Не содержит логики — просто layout. Все handler'ы / data — у parent'а.
 */
export function JournalToolbar({
  backHref,
  documentId,
  title,
  subtitle,
  rightActions,
}: {
  backHref: string;
  documentId: string;
  title: string;
  subtitle?: string;
  rightActions?: ReactNode;
}) {
  return (
    <div className="space-y-3 print:hidden">
      <DocumentBackLink href={backHref} documentId={documentId} className="mb-0" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
            {title}
          </h1>
          {subtitle ? (
            <div className="mt-1 text-[13.5px] text-[#6f7282]">{subtitle}</div>
          ) : null}
        </div>
        {rightActions ? (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {rightActions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
