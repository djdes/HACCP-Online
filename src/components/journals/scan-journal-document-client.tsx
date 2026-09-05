"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { JournalDocumentShell } from "@/components/journals/journal-document-shell";

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
    <div className="space-y-5">
      <FocusTodayScroller selector="[data-focus-today]" emptyTitle="Записей пока нет" emptyBody="Нажмите «Добавить» в таблице ниже, чтобы создать запись." />
      <JournalDocumentShell
        title={templateName}
        subtitle={`Страница ${currentPage} из ${totalPages}`}
        documentId={documentId}
        backHref={`/journals/${templateCode}`}
      >
        <div className="overflow-hidden rounded-[16px] border border-[#dbe0f1] bg-white p-2">
          <img
            src={imageUrl}
            alt={`${templateCode} page ${currentPage}`}
            className="h-auto w-full rounded-[12px] bg-white"
          />
        </div>
      </JournalDocumentShell>

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
