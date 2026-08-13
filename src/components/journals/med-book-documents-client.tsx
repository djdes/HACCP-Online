"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
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
import { cn } from "@/lib/utils";
import { FloatingInputField } from "@/components/journals/journal-dialog-field";

import { toast } from "sonner";
import {
  EmptyDocumentsState,
  JournalTabs,
  JournalTopBar,
} from "@/components/journals/document-list-ui";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";
import { getJournalDocumentHeading } from "@/lib/journal-document-helpers";
import {
  JOURNAL_CARD_LABEL_CLASS,
  JOURNAL_CARD_SECTION_CLASS,
  JOURNAL_CARD_TITLE_CLASS,
  JOURNAL_CARD_VALUE_CLASS,
  JOURNAL_DIALOG_ACTIONS_CLASS,
  JOURNAL_DIALOG_BODY_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_FIELDS_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_SUBMIT_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  JOURNAL_LIST_CARD_CLASS,
  JOURNAL_LIST_CARDS_CLASS,
  JOURNAL_LIST_STACK_CLASS,
} from "@/components/journals/journal-responsive";

/**
 * Список документов журнала медкнижек.
 *
 * ЖИВОЙ эталон (lk.haccp-online.ru, med_books-1-list.png) держит у
 * медкнижек ОБЫЧНУЮ документную модель: H1 «Медицинские книжки»,
 * «Инструкция» + «Создать документ», вкладки «Активные/Закрытые» и
 * карточки документов с меню «···». Бездокументная переделка (фаза N7)
 * была основана на старом скриншоте и откатана — этот файл восстановлен
 * из истории и переведён на актуальные токены списка (P1) и диалогов (P2).
 */

type MedBookListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  /** `YYYY-MM-DD`, показывается мета-колонкой карточки. */
  dateFrom: string;
};

type Props = {
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  documents: MedBookListDocument[];
};

/** `YYYY-MM-DD` → `ДД-ММ-ГГГГ`, как в остальных списках журналов. */
function formatRuDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}-${month}-${year}` : value;
}

/**
 * «Настройки» документа из меню карточки — переименование.
 * Геометрия окна и валидация пустого названия — общие токены P2.
 */
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
  const [titleError, setTitleError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(document?.title ?? "");
    setTitleError("");
    setSaving(false);
  }, [document, open]);

  async function handleSave() {
    if (!document) return;
    if (!title.trim()) {
      setTitleError("Поле не заполнено");
      return;
    }

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
      toast.error(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить название документа",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            Настройки журнала
          </DialogTitle>
        </DialogHeader>
        <div className={cn(JOURNAL_DIALOG_BODY_CLASS, JOURNAL_DIALOG_FIELDS_CLASS)}>
          <FloatingInputField
            id="med-book-settings-title"
            label="Название документа"
            placeholder="Введите название документа"
            value={title}
            onChange={(value) => {
              setTitle(value);
              if (titleError) setTitleError("");
            }}
            error={titleError || undefined}
          />
          <div className={JOURNAL_DIALOG_ACTIONS_CLASS}>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={JOURNAL_DIALOG_SUBMIT_CLASS}
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

  async function handleDelete(document: MedBookListDocument) {
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title}» будет удалён безвозвратно.`,
      bullets: [
        { label: "Удалятся медкнижки всех сотрудников этого документа", tone: "warn" },
        {
          label: "Даты осмотров, исследований и прививок восстановить будет нельзя",
          tone: "warn",
        },
        { label: "Печатная форма документа перестанет существовать", tone: "info" },
      ],
      successMessage: `Документ «${document.title}» удалён`,
      errorMessage: "Не удалось удалить документ",
    });
  }

  return (
    <div className={JOURNAL_LIST_STACK_CLASS}>
      <JournalTopBar
        heading={getJournalDocumentHeading(templateCode, activeTab === "closed")}
        activeTab={activeTab}
        templateCode={templateCode}
        templateName={templateName}
        users={users}
        documentCount={documents.length}
        createSlot={
          <CreateDocumentDialog
            templateCode={templateCode}
            templateName={templateName}
            users={users}
            triggerLabel="Создать документ"
            triggerIcon={<Plus className="size-5" strokeWidth={2.5} />}
            triggerClassName="h-11 w-full gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[#4a5bf0] sm:w-auto"
          />
        }
      />

      <JournalTabs activeTab={activeTab} templateCode={templateCode} />

      {documents.length === 0 ? (
        <EmptyDocumentsState
          templateCode={templateCode}
          templateName={templateName}
          users={users}
        />
      ) : (
        <div className={JOURNAL_LIST_CARDS_CLASS}>
          {documents.map((document) => {
            const isBusy = isDeleting || isChangingStatus;
            const href = `/journals/${templateCode}/documents/${document.id}`;

            return (
              <div key={document.id} className={JOURNAL_LIST_CARD_CLASS}>
                <Link href={href} className={JOURNAL_CARD_TITLE_CLASS}>
                  {document.title}
                </Link>
                <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                  <div className={JOURNAL_CARD_LABEL_CLASS}>Дата начала</div>
                  <div className={JOURNAL_CARD_VALUE_CLASS}>
                    {formatRuDate(document.dateFrom)}
                  </div>
                </Link>
                <div className="justify-self-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={isBusy}
                        className="flex size-9 items-center justify-center rounded-full text-[#5566f6] transition-colors hover:bg-[#f5f6ff]"
                      >
                        <Ellipsis className="size-6" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-[280px] rounded-[24px] border-0 p-4 shadow-xl"
                    >
                      <DropdownMenuItem
                        className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                        onSelect={() => router.push(href)}
                      >
                        <ExternalLink className="mr-3 size-5 text-[#6f7282]" />
                        Открыть
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                        onSelect={() => setSettingsDoc(document)}
                      >
                        <Settings2 className="mr-3 size-5 text-[#6f7282]" />
                        Настройки
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                        onSelect={() => openPdf({ documentId: document.id })}
                      >
                        <Printer className="mr-3 size-5 text-[#6f7282]" />
                        Печать
                      </DropdownMenuItem>
                      {document.status === "active" ? (
                        <DropdownMenuItem
                          className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                          onSelect={() => {
                            void setStatus("closed", { documentId: document.id });
                          }}
                        >
                          <Archive className="mr-3 size-5 text-[#6f7282]" />
                          Закрыть
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                          onSelect={() => {
                            void setStatus("active", { documentId: document.id });
                          }}
                        >
                          <RotateCcw className="mr-3 size-5 text-[#6f7282]" />
                          Вернуть в активные
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="h-9 rounded-xl px-3.5 text-[13.5px] text-[#ff3b30] focus:text-[#ff3b30]"
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
