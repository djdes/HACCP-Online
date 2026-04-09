"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenText, Ellipsis, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDocumentDialog } from "@/components/journals/create-document-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type JournalListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  periodLabel: string;
  metaLabel: string;
  metaValue: string;
};

type Props = {
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  heading: string;
  users: { id: string; name: string; role: string }[];
  documents: JournalListDocument[];
};

export function TrackedDocumentsClient({
  activeTab,
  templateCode,
  templateName,
  heading,
  users,
  documents,
}: Props) {
  const router = useRouter();

  async function handleDelete(documentId: string, title: string) {
    if (!window.confirm(`Удалить документ "${title}"?`)) return;

    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      window.alert("Не удалось удалить документ");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-[56px] font-semibold tracking-[-0.04em] text-black">{heading}</h1>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            className="h-16 rounded-2xl border-[#eef0fb] px-7 text-[18px] text-[#5464ff] shadow-none hover:bg-[#f8f9ff]"
            asChild
          >
            <Link href="/sanpin">
              <BookOpenText className="size-6" />
              Инструкция
            </Link>
          </Button>
          {activeTab === "active" && (
            <CreateDocumentDialog
              templateCode={templateCode}
              templateName={templateName}
              users={users}
              triggerClassName="h-16 rounded-2xl bg-[#5b66ff] px-8 text-[18px] font-medium text-white hover:bg-[#4c58ff]"
              triggerLabel="Создать документ"
              triggerIcon={<Plus className="size-7" />}
            />
          )}
        </div>
      </div>

      <div className="border-b border-[#d9d9e4]">
        <div className="flex gap-12 text-[18px]">
          <Link
            href={`/journals/${templateCode}`}
            className={`relative pb-5 ${
              activeTab === "active"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5b66ff]"
                : "text-[#7c7c93]"
            }`}
          >
            Активные
          </Link>
          <Link
            href={`/journals/${templateCode}?tab=closed`}
            className={`relative pb-5 ${
              activeTab === "closed"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5b66ff]"
                : "text-[#7c7c93]"
            }`}
          >
            Закрытые
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {documents.map((document) => {
          const href = `/journals/${templateCode}/documents/${document.id}`;

          return (
            <div
              key={document.id}
              className="grid grid-cols-[1.8fr_300px_240px_48px] items-center rounded-2xl border border-[#ececf4] bg-white px-6 py-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
            >
              <Link href={href} className="text-[20px] font-semibold tracking-[-0.02em] text-black">
                {document.title}
              </Link>
              <Link href={href} className="border-l border-[#e6e6f0] px-10">
                <div className="text-[14px] text-[#84849a]">Ответственный</div>
                <div className="mt-2 text-[18px] font-semibold text-black">{document.responsibleTitle || ""}</div>
              </Link>
              <Link href={href} className="border-l border-[#e6e6f0] px-10">
                <div className="text-[14px] text-[#84849a]">{document.metaLabel}</div>
                <div className="mt-2 text-[18px] font-semibold text-black">{document.metaValue}</div>
              </Link>
              <div className="flex items-center justify-center text-[#5b66ff]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full hover:bg-[#f5f6ff]"
                    >
                      <Ellipsis className="size-8" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[320px] rounded-[28px] border-0 p-6 shadow-xl">
                    <DropdownMenuItem
                      className="mb-3 h-16 rounded-2xl px-4 text-[20px]"
                      onSelect={() => router.push(href)}
                    >
                      <Pencil className="mr-4 size-7 text-[#6f7282]" />
                      Настройки
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="mb-3 h-16 rounded-2xl px-4 text-[20px]"
                      onSelect={() => window.open(`/api/journal-documents/${document.id}/pdf`, "_blank")}
                    >
                      <Printer className="mr-4 size-7 text-[#6f7282]" />
                      Печать
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-16 rounded-2xl px-4 text-[20px] text-[#ff3b30] focus:text-[#ff3b30]"
                      onSelect={() => handleDelete(document.id, document.title)}
                    >
                      <Trash2 className="mr-4 size-7 text-[#ff3b30]" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
