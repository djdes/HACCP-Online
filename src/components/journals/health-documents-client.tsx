"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { toast } from "sonner";
import {
  DocumentActionsMenu,
  EmptyDocumentsState,
  JournalTabs,
  JournalTopBar,
} from "@/components/journals/document-list-ui";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";
import {
  JOURNAL_CARD_LABEL_CLASS,
  JOURNAL_CARD_SECTION_CLASS,
  JOURNAL_CARD_TITLE_CLASS,
  JOURNAL_CARD_VALUE_CLASS,
  JOURNAL_LIST_CARD_CLASS,
} from "@/components/journals/journal-responsive";

type HealthListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  periodLabel: string;
  printEmptyRows?: number;
};

type Props = {
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  documents: HealthListDocument[];
};

const EMPTY_ROWS_OPTIONS = [0, 1, 2, 3, 4, 5, 10, 15, 20];

function EditDocumentDialog(props: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  document: HealthListDocument | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [emptyRows, setEmptyRows] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!props.document || !props.open) return;
    setTitle(props.document.title);
    setEmptyRows(String(props.document.printEmptyRows ?? 0));
  }, [props.document, props.open]);

  async function handleSave() {
    if (!props.document) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/journal-documents/${props.document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Журнал здоровья",
          config: {
            printEmptyRows: Math.max(0, Number(emptyRows) || 0),
          },
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "Не удалось сохранить настройки документа");
      }

      props.onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить настройки документа"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[22px] font-medium text-black">
            Настройки журнала
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-6 py-5">
          <div className="space-y-3">
            <Label htmlFor="edit-health-doc-title">Название документа</Label>
            <Input
              id="edit-health-doc-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Введите название документа"
              className="h-11 rounded-2xl border-[#dcdfed] px-4 text-[15px]"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[14px] text-[#6f7282]">Добавлять пустых строк при печати</Label>
            <Select value={emptyRows} onValueChange={setEmptyRows}>
              <SelectTrigger className="h-11 w-full rounded-2xl border-[#dcdfed] bg-[#fafbff] px-5 text-[16px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPTY_ROWS_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleSave}
              className="h-11 rounded-2xl bg-[#5566f6] px-6 text-[15px] text-white transition-colors hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HealthDocumentRow(props: {
  document: HealthListDocument;
  templateCode: string;
  onEdit: (document: HealthListDocument) => void;
  onPrint: (document: HealthListDocument) => void;
  onDelete: (document: HealthListDocument) => void;
}) {
  const href = `/journals/${props.templateCode}/documents/${props.document.id}`;
  const canManage = props.document.status === "active";

  return (
    <div className={JOURNAL_LIST_CARD_CLASS}>
      <Link href={href} className={JOURNAL_CARD_TITLE_CLASS}>
        {props.document.title}
      </Link>
      <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
        <div className={JOURNAL_CARD_LABEL_CLASS}>Период</div>
        <div className={JOURNAL_CARD_VALUE_CLASS}>{props.document.periodLabel}</div>
      </Link>
      <div className={JOURNAL_CARD_SECTION_CLASS} />
      <div className="flex items-center justify-center text-[#5566f6]">
        <DocumentActionsMenu
          onEdit={canManage ? () => props.onEdit(props.document) : undefined}
          onPrint={() => props.onPrint(props.document)}
          onDelete={canManage ? () => props.onDelete(props.document) : undefined}
        />
      </div>
    </div>
  );
}

export function HealthDocumentsClient(props: Props) {
  const [editingDocument, setEditingDocument] = useState<HealthListDocument | null>(null);
  const heading = props.activeTab === "closed" ? "Журнал здоровья (закрытые)" : "Журнал здоровья";
  const { deleteDocument, openPdf } = useJournalDocumentActions();

  async function handleDelete(document: HealthListDocument) {
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title}» будет удалён безвозвратно.`,
      bullets: [
        { label: `Период документа: ${document.periodLabel}`, tone: "info" },
        { label: "Удалятся все отметки сотрудников за этот период", tone: "warn" },
        { label: "Печатную форму этого документа восстановить будет нельзя", tone: "warn" },
      ],
      successMessage: `Документ «${document.title}» удалён`,
      errorMessage: "Ошибка удаления документа",
    });
  }

  return (
    <>
      <div className="space-y-8 sm:space-y-14">
        <JournalTopBar
          heading={heading}
          activeTab={props.activeTab}
          templateCode={props.templateCode}
          templateName={props.templateName}
          users={props.users}
        />

        <JournalTabs activeTab={props.activeTab} templateCode={props.templateCode} />

        <div className="space-y-6">
          {props.documents.length === 0 && <EmptyDocumentsState />}
          {props.documents.map((document) => (
            <HealthDocumentRow
              key={document.id}
              document={document}
              templateCode={props.templateCode}
              onEdit={setEditingDocument}
              onPrint={(doc) => openPdf({ documentId: doc.id })}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      <EditDocumentDialog
        open={!!editingDocument}
        onOpenChange={(value) => {
          if (!value) setEditingDocument(null);
        }}
        document={editingDocument}
      />
    </>
  );
}
