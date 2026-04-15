"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocumentBackLinkProps = {
  href: string;
  label?: string;
  className?: string;
  /**
   * When provided, renders a "Печать" button aligned to the right that opens
   * the existing session-gated PDF endpoint in a new tab. Keeps the old
   * single-button usage working — callers that don't need print just omit
   * this prop.
   */
  documentId?: string;
};

export function DocumentBackLink({
  href,
  label = "Назад",
  className,
  documentId,
}: DocumentBackLinkProps) {
  const showPrint = Boolean(documentId);
  return (
    <div
      className={
        className ??
        (showPrint
          ? "mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden"
          : "mb-6")
      }
    >
      <Button
        asChild
        variant="ghost"
        className="h-11 rounded-[14px] px-3 text-[15px] text-[#5566f6] hover:bg-[#eef1ff]"
      >
        <Link href={href}>
          <ArrowLeft className="size-5" />
          {label}
        </Link>
      </Button>
      {showPrint ? (
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
    </div>
  );
}
