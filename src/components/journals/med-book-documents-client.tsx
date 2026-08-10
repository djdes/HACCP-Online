"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Archive,
  BookOpenText,
  Ellipsis,
  ExternalLink,
  Plus,
  Printer,
  RotateCcw,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDocumentDialog } from "@/components/journals/create-document-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import {
  EmptyDocumentsState,
  JournalTabs,
  JournalTopBar,
} from "@/components/journals/document-list-ui";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";
import { getJournalDocumentHeading } from "@/lib/journal-document-helpers";
import { JOURNAL_CARD_TITLE_CLASS } from "@/components/journals/journal-responsive";

type MedBookListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
};

type Props = {
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  documents: MedBookListDocument[];
};

function SettingsDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  document: MedBookListDocument | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpen(nextOpen: boolean) {
    if (nextOpen && document) setTitle(document.title);
    onOpenChange(nextOpen);
  }

  async function handleSave() {
    if (!document || !title.trim()) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/journal-documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Не удалось сохранить название документа");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить название документа");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-[#ececf4] px-8 py-6">
          <DialogTitle className="text-[20px] font-medium text-black">
            Настройки журнала
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-8 py-6">
          <div className="space-y-3">
            <Label htmlFor="settings-title" className="text-[14px] text-[#6f7282]">
              Название документа
            </Label>
            <Input
              id="settings-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="h-11 rounded-2xl bg-[#5566f6] px-6 text-[15px] font-medium text-white transition-colors hover:bg-[#4a5bf0]"
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MedBookDocumentsClient({
  activeTab,
  templateCode,
  templateName,
  users,
  documents,
}: Props) {
  const router = useRouter();
  const [settingsDoc, setSettingsDoc] = useState<MedBookListDocument | null>(null);
  // Единый источник delete / status / pdf для журнальных документов.
  const { deleteDocument, setStatus, openPdf, isDeleting, isChangingStatus } =
    useJournalDocumentActions();

  const firstDocumentLink = useMemo(() => {
    if (documents.length === 0) return `/journals/${templateCode}`;
    return `/journals/${templateCode}/documents/${documents[0].id}#med-book-reference`;
  }, [documents, templateCode]);

  async function handleDelete(document: MedBookListDocument) {
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title}» будет удалён безвозвратно.`,
      bullets: [
        { label: "Удалятся медкнижки всех сотрудников этого документа", tone: "warn" },
        { label: "Даты осмотров, исследований и прививок восстановить будет нельзя", tone: "warn" },
        { label: "Печатная форма документа перестанет существовать", tone: "info" },
      ],
      successMessage: `Документ «${document.title}» удалён`,
      errorMessage: "Не удалось удалить документ",
    });
  }

  return (
    <div className="space-y-8 sm:space-y-14">
      <JournalTopBar
        heading={getJournalDocumentHeading(templateCode, activeTab === "closed")}
        activeTab={activeTab}
        templateCode={templateCode}
        templateName={templateName}
        users={users}
        createSlot={
          <>
            <Button
              asChild
              type="button"
              variant="outline"
              className="h-11 w-full rounded-2xl border-[#dcdfed] px-4 text-[15px] text-[#3848c7] shadow-none transition-colors hover:bg-[#f5f6ff] sm:w-auto"
            >
              <Link href={firstDocumentLink}>
                <BookOpenText className="size-4" />
                Справочник осмотров
              </Link>
            </Button>
            <CreateDocumentDialog
              templateCode={templateCode}
              templateName={templateName}
              users={users}
              triggerLabel="Создать документ"
              triggerIcon={<Plus className="size-4" />}
              triggerClassName="h-11 w-full rounded-2xl bg-[#5566f6] px-4 text-[15px] font-medium text-white transition-colors hover:bg-[#4a5bf0] sm:w-auto"
            />
          </>
        }
      />

      <JournalTabs activeTab={activeTab} templateCode={templateCode} />

      {documents.length === 0 ? (
        <EmptyDocumentsState />
      ) : (
        <div className="space-y-4">
          {documents.map((document) => {
            const isBusy = isDeleting || isChangingStatus;

            return (
              <div
                key={document.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-[#ececf4] bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-colors hover:border-[#5566f6]/30 sm:px-6 sm:py-5"
              >
                <Link
                  href={`/journals/${templateCode}/documents/${document.id}`}
                  className={`${JOURNAL_CARD_TITLE_CLASS} min-w-0 flex-1 truncate transition-colors hover:text-[#5566f6]`}
                >
                  {document.title}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      className="size-11 rounded-full text-[#5566f6] transition-colors hover:bg-[#f5f6ff] hover:text-[#5566f6]"
                    >
                      <Ellipsis className="size-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[280px] rounded-[24px] border-0 p-4 shadow-xl">
                    <DropdownMenuItem
                      className="mb-2 h-11 rounded-2xl px-4 text-[15px]"
                      onSelect={() => router.push(`/journals/${templateCode}/documents/${document.id}`)}
                    >
                      <ExternalLink className="mr-3 size-5 text-[#6f7282]" />
                      Открыть
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="mb-2 h-11 rounded-2xl px-4 text-[15px]"
                      onSelect={() => setSettingsDoc(document)}
                    >
                      <Settings2 className="mr-3 size-5 text-[#6f7282]" />
                      Настройки
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="mb-2 h-11 rounded-2xl px-4 text-[15px]"
                      onSelect={() => openPdf({ documentId: document.id })}
                    >
                      <Printer className="mr-3 size-5 text-[#6f7282]" />
                      Печать
                    </DropdownMenuItem>
                    {document.status === "active" ? (
                      <DropdownMenuItem
                        className="mb-2 h-11 rounded-2xl px-4 text-[15px]"
                        onSelect={() => {
                          void setStatus("closed", { documentId: document.id });
                        }}
                      >
                        <Archive className="mr-3 size-5 text-[#6f7282]" />
                        Закрыть
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        className="mb-2 h-11 rounded-2xl px-4 text-[15px]"
                        onSelect={() => {
                          void setStatus("active", { documentId: document.id });
                        }}
                      >
                        <RotateCcw className="mr-3 size-5 text-[#6f7282]" />
                        Вернуть в активные
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="h-11 rounded-2xl px-4 text-[15px] text-[#ff3b30] focus:text-[#ff3b30]"
                      onSelect={() => {
                        void handleDelete(document);
                      }}
                    >
                      <Trash2 className="mr-3 size-5 text-[#ff3b30]" />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      <SettingsDialog
        open={Boolean(settingsDoc)}
        onOpenChange={(value) => {
          if (!value) setSettingsDoc(null);
        }}
        document={settingsDoc}
      />
    </div>
  );
}
