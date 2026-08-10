"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FRYER_OIL_PAGE_TITLE } from "@/lib/fryer-oil-document";
import { openDocumentPdf } from "@/lib/open-document-pdf";

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
} from "@/components/journals/journal-responsive";
type DocumentItem = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  dateFrom: string;
};

type Props = {
  activeTab: "active" | "closed";
  routeCode?: string;
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  documents: DocumentItem[];
};

type EditingState = {
  id: string;
  title: string;
  dateFrom: string;
};

function formatDateDash(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU").replaceAll(".", "-");
}

function FryerOilSettingsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EditingState | null;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  useEffect(() => {
    if (!props.editing) return;
    setTitle(props.editing.title);
    setDateFrom(props.editing.dateFrom);
  }, [props.editing]);

  async function handleSave() {
    if (!props.editing) return;
    setSubmitting(true);

    try {
      const response = await fetch(`/api/journal-documents/${props.editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || props.editing.title,
          dateFrom,
        }),
      });

      if (!response.ok) {
        throw new Error("save_failed");
      }

      props.onOpenChange(false);
      props.onSaved();
    } catch {
      toast.error("Не удалось сохранить настройки документа");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(open) => {
        if (open && props.editing) {
          setTitle(props.editing.title);
          setDateFrom(props.editing.dateFrom);
        }
        props.onOpenChange(open);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-7 py-5">
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.03em] text-black sm:text-[40px]">
            Настройки документа
          </DialogTitle>
          <button
            type="button"
            className="rounded-md p-1 text-black/80 hover:bg-black/5"
            onClick={() => props.onOpenChange(false)}
          >
            <X className="size-6" />
          </button>
        </DialogHeader>

        <div className="space-y-4 px-7 py-6">
          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Название документа</Label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-2xl border-[#dfe1ec] px-4 text-[15px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Дата начала</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="h-11 rounded-2xl border-[#dfe1ec] px-4 text-[15px]"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="h-11 rounded-2xl bg-[#5863f8] px-4 text-[15px] font-medium text-white hover:bg-[#4b57f3]"
            >
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function FryerOilDocumentsClient(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const routeCode = props.routeCode || props.templateCode;
  const pageTitle =
    props.activeTab === "closed"
      ? `${FRYER_OIL_PAGE_TITLE} (закрытые)`
      : FRYER_OIL_PAGE_TITLE;

  // Единый источник delete / status / pdf для журнальных документов.
  const { deleteDocument } = useJournalDocumentActions();

  async function handleDelete(document: DocumentItem) {
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title}» будет удалён безвозвратно.`,
      bullets: [
        { label: "Удалятся все записи об использовании фритюрных жиров", tone: "warn" },
        { label: `Журнал начат: ${formatDateDash(document.dateFrom)}`, tone: "info" },
        { label: "Печатную форму документа восстановить будет нельзя", tone: "warn" },
      ],
      successMessage: `Документ «${document.title}» удалён`,
      errorMessage: "Не удалось удалить документ",
    });
  }

  return (
    <div className="space-y-8">
      <JournalTopBar
        heading={pageTitle}
        activeTab={props.activeTab}
        templateCode={props.templateCode}
        templateName={props.templateName}
        users={props.users}
      />

      <JournalTabs activeTab={props.activeTab} templateCode={routeCode} />

      <div className="space-y-3">
        {props.documents.length === 0 && (
          <EmptyDocumentsState />
        )}

        {props.documents.map((document) => {
          const href = `/journals/${routeCode}/documents/${document.id}`;

          return (
            <div
              key={document.id}
              className="grid grid-cols-1 gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_48px] sm:items-center sm:gap-0 sm:px-6 sm:py-5"
            >
              <Link href={href} className={JOURNAL_CARD_TITLE_CLASS}>
                {document.title}
              </Link>

              <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                <div className={JOURNAL_CARD_LABEL_CLASS}>Дата начала</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {formatDateDash(document.dateFrom)}
                </div>
              </Link>

              <div className="flex justify-center">
                <DocumentActionsMenu
                  size="sm"
                  onEdit={
                    document.status === "active"
                      ? () =>
                          setEditing({
                            id: document.id,
                            title: document.title,
                            dateFrom: document.dateFrom,
                          })
                      : undefined
                  }
                  onPrint={() => {
                    void openDocumentPdf(document.id).catch((error) =>
                      toast.error(
                        error instanceof Error ? error.message : "Не удалось открыть PDF"
                      )
                    );
                  }}
                  onDelete={
                    document.status === "active"
                      ? () => void handleDelete(document)
                      : undefined
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <FryerOilSettingsDialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        editing={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
