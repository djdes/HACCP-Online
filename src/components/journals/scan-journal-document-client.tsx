"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentBackLink } from "@/components/journals/document-back-link";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";

type Props = {
  templateCode: string;
  templateName: string;
  documentId: string;
  pageCount: number;
  currentPage: number;
};

export function ScanJournalDocumentClient({
  templateCode,
  templateName,
  documentId,
  pageCount,
  currentPage,
}: Props) {
  const totalPages = pageCount;
  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;
  const imageUrl = `/api/journal-scans/${templateCode}?page=${currentPage}`;

  return (
    <div className="space-y-6">
      <FocusTodayScroller selector="[data-focus-today]" emptyTitle="Записей пока нет" emptyBody="Нажмите «Добавить» в таблице ниже, чтобы создать запись." />
        <DocumentBackLink href={`/journals/${templateCode}`} documentId={documentId} />
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
            {templateName}
          </h1>
          <div className="mt-2 text-sm text-[#7a7d8e]">
            Страница {currentPage} из {totalPages}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          title="Распечатать страницу"
          className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none hover:bg-[#f5f6ff]"
        >
          <Printer className="size-4" />
          Печать
        </Button>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 lg:overflow-visible sm:px-0 print:mx-0 print:overflow-visible print:px-0">
        <div className="min-w-[1100px] sm:min-w-0">
          <div className="overflow-hidden rounded-[16px] border border-[#dbe0f1] bg-white p-2">
            <img
              src={imageUrl}
              alt={`${templateCode} page ${currentPage}`}
              className="h-auto w-full rounded-[12px] bg-white"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {canPrev ? (
          <Button asChild>
            <Link href={`/journals/${templateCode}/documents/${documentId}?page=${currentPage - 1}`}>
              <ChevronLeft className="size-4" />
              Предыдущая
            </Link>
          </Button>
        ) : (
          <div />
        )}

        <div className="text-sm text-[#7a7d8e]">
          {currentPage} / {totalPages}
        </div>

        {canNext ? (
          <Button asChild>
            <Link href={`/journals/${templateCode}/documents/${documentId}?page=${currentPage + 1}`}>
              Следующая
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
