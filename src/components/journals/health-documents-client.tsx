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
import { cn } from "@/lib/utils";
import {
  FloatingInputField,
  FloatingLabelField,
} from "@/components/journals/journal-dialog-field";
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
  JOURNAL_DIALOG_ACTIONS_CLASS,
  JOURNAL_DIALOG_BODY_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_FIELD_TRIGGER_CLASS,
  JOURNAL_DIALOG_FIELDS_CLASS,
  JOURNAL_DIALOG_FOOTER_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_SUBMIT_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  JOURNAL_LIST_CARD_CLASS,
  JOURNAL_LIST_STACK_CLASS,
  JOURNAL_LIST_CARDS_CLASS,
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
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            Настройки журнала
          </DialogTitle>
        </DialogHeader>

        <div className={cn(JOURNAL_DIALOG_BODY_CLASS, JOURNAL_DIALOG_FIELDS_CLASS)}>
          <FloatingInputField
            id="edit-health-doc-title"
            label="Название документа"
            value={title}
            onChange={setTitle}
          />

          <FloatingLabelField label="Добавлять пустых строк при печати">
            <Select value={emptyRows} onValueChange={setEmptyRows}>
              <SelectTrigger className={JOURNAL_DIALOG_FIELD_TRIGGER_CLASS}>
                {/* P8: то же, что в диалоге создания — значение рендерим
                    явными children, иначе «0» не показывается вовсе. */}
                <SelectValue placeholder="0">{emptyRows}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {EMPTY_ROWS_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FloatingLabelField>
        </div>

        <div className={JOURNAL_DIALOG_FOOTER_CLASS}>
          <div className={JOURNAL_DIALOG_ACTIONS_CLASS}>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleSave}
              className={JOURNAL_DIALOG_SUBMIT_CLASS}
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
      {/* Пустая мета-колонка БЕЗ делителя: раньше здесь стоял
          `JOURNAL_CARD_SECTION_CLASS`, и карточка рисовала вертикальную
          линию, за которой ничего не было. */}
      <div />
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
      <div className={JOURNAL_LIST_STACK_CLASS}>
        <JournalTopBar
          heading={heading}
          activeTab={props.activeTab}
          templateCode={props.templateCode}
          templateName={props.templateName}
          users={props.users}
          documentCount={props.documents.length}
        />

        <JournalTabs activeTab={props.activeTab} templateCode={props.templateCode} />

        <div className={JOURNAL_LIST_CARDS_CLASS}>
          {props.documents.length === 0 && (
            <EmptyDocumentsState
              templateCode={props.templateCode}
              templateName={props.templateName}
              users={props.users}
            />
          )}
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
