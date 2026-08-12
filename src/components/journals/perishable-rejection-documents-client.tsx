"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DocumentActionsMenu,
  EmptyDocumentsState,
  JournalTabs,
  JournalTopBar,
} from "@/components/journals/document-list-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { toast } from "sonner";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";
import { normalizePerishableRejectionConfig } from "@/lib/perishable-rejection-document";
import { getJournalDocumentHeading } from "@/lib/journal-document-helpers";
import {
  JOURNAL_CARD_LABEL_CLASS,
  JOURNAL_CARD_SECTION_CLASS,
  JOURNAL_CARD_TITLE_CLASS,
  JOURNAL_CARD_VALUE_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  JOURNAL_LIST_STACK_CLASS,
} from "@/components/journals/journal-responsive";
type JournalListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  startedAtLabel: string;
  dateFrom: string;
  config?: unknown;
};

type Props = {
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  documents: JournalListDocument[];
};

export function PerishableRejectionDocumentsClient({
  activeTab,
  templateCode,
  templateName,
  users,
  documents,
}: Props) {
  const router = useRouter();
  const [editingDocument, setEditingDocument] = useState<JournalListDocument | null>(null);
  const [title, setTitle] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!editingDocument) return;
    setTitle(editingDocument.title);
    setDateFrom(editingDocument.dateFrom);
  }, [editingDocument]);

  // Единый источник delete / pdf для журнальных документов.
  const { deleteDocument, openPdf } = useJournalDocumentActions();

  async function handleDelete(document: JournalListDocument) {
    const cfg = normalizePerishableRejectionConfig(document.config);
    const catalogSize =
      cfg.productLists.reduce((sum, list) => sum + list.items.length, 0) +
      cfg.manufacturers.length +
      cfg.suppliers.length;
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title}» будет удалён безвозвратно.`,
      bullets: [
        { label: `Записей бракеража: ${cfg.rows.length}`, tone: "warn" },
        { label: `Позиций в справочниках документа: ${catalogSize}`, tone: "info" },
        { label: `Журнал начат: ${document.startedAtLabel}`, tone: "info" },
      ],
      successMessage: `Документ «${document.title}» удалён`,
      errorMessage: "Не удалось удалить документ",
    });
  }

  async function saveSettings() {
    if (!editingDocument) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/journal-documents/${editingDocument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, dateFrom }),
      });
      if (!response.ok) throw new Error();
      setEditingDocument(null);
      router.refresh();
    } catch {
      toast.error("Не удалось сохранить настройки");
    } finally {
      setIsSaving(false);
    }
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
      />
      <JournalTabs activeTab={activeTab} templateCode={templateCode} />
      <div className="space-y-4">
        {documents.length === 0 && (
          <EmptyDocumentsState
            templateCode={templateCode}
            templateName={templateName}
            users={users}
          />
        )}
        {documents.map((document) => (
          <div
            key={document.id}
            className="grid grid-cols-1 gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_48px] sm:items-center sm:gap-0 sm:px-6 sm:py-5"
          >
            <Link href={`/journals/${templateCode}/documents/${document.id}`} className="min-w-0">
              <div className={JOURNAL_CARD_TITLE_CLASS}>{document.title}</div>
            </Link>
            <Link href={`/journals/${templateCode}/documents/${document.id}`} className={`${JOURNAL_CARD_SECTION_CLASS} justify-self-end`}>
              <div className={JOURNAL_CARD_LABEL_CLASS}>Дата начала</div>
              <div className={JOURNAL_CARD_VALUE_CLASS}>{document.startedAtLabel}</div>
            </Link>
            <DocumentActionsMenu
              size="sm"
              onEdit={() => setEditingDocument(document)}
              onPrint={() => openPdf({ documentId: document.id })}
              onDelete={() => void handleDelete(document)}
            />
          </div>
        ))}
      </div>

      <Dialog open={!!editingDocument} onOpenChange={(open) => !open && setEditingDocument(null)}>
        <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
          <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>Настройки журнала</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Название документа</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[#3c4053]">Дата начала</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={saveSettings}
                disabled={isSaving}
                className="h-10 rounded-xl bg-[#5566f6] px-6 text-[13.5px] font-medium text-white transition-colors hover:bg-[#4a5bf0]"
              >
                {isSaving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
