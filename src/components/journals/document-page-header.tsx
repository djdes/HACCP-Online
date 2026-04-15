"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentBackLink } from "@/components/journals/document-back-link";

type DocumentPageHeaderProps = {
  backHref: string;
  backLabel?: string;
  documentId?: string;
  showPrint?: boolean;
  className?: string;
  rightActions?: React.ReactNode;
};

/**
 * Shared top bar for every journal document page.
 * Renders a back-button on the left and a consistent action row on the right
 * (print + whatever the host page passes in, like "Настройки"/"Закончить").
 *
 * NOTE: the print URL calls the existing session-gated PDF endpoint,
 * so it works for admins/managers browsing the UI.
 */
export function DocumentPageHeader({
  backHref,
  backLabel,
  documentId,
  showPrint = true,
  className,
  rightActions,
}: DocumentPageHeaderProps) {
  const hasPrint = Boolean(showPrint && documentId);
  const hasActions = hasPrint || Boolean(rightActions);

  return (
    <div
      className={
        className ??
        "mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden"
      }
    >
      <DocumentBackLink href={backHref} label={backLabel} className="mb-0" />
      {hasActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {hasPrint ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                window.open(
                  `/api/journal-documents/${documentId}/pdf`,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
              className="h-11 rounded-2xl border-[#dfe1ec] px-4 text-[15px]"
            >
              <Printer className="size-4" />
              Печать
            </Button>
          ) : null}
          {rightActions}
        </div>
      ) : null}
    </div>
  );
}
