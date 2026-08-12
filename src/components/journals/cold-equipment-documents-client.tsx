"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import { getHygienePositionLabel } from "@/lib/hygiene-document";

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
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  JOURNAL_LIST_CARD_CLASS,
  JOURNAL_LIST_STACK_CLASS,
} from "@/components/journals/journal-responsive";
import { PositionSelectItems } from "@/components/shared/position-select";
import { getUsersForRoleLabel } from "@/lib/user-roles";
type UserItem = {
  id: string;
  name: string;
  role: string;
};

type JournalListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  responsibleUserName: string | null;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
};

type Props = {
  activeTab: "active" | "closed";
  routeCode: string;
  templateCode: string;
  templateName: string;
  users: UserItem[];
  documents: JournalListDocument[];
};

function EditDocumentDialog({
  open,
  onOpenChange,
  document,
  users,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: JournalListDocument | null;
  users: UserItem[];
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [responsibleTitle, setResponsibleTitle] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleOptions = useMemo(
    () => [...new Set(users.map((user) => getHygienePositionLabel(user.role)))],
    [users]
  );

  useEffect(() => {
    if (!open || !document) return;
    setTitle(document.title);
    setResponsibleTitle(document.responsibleTitle || titleOptions[0] || "");
    setResponsibleUserId(document.responsibleUserId || "");
  }, [document, open, titleOptions, users]);

  async function handleSave() {
    if (!document) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/journal-documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          responsibleTitle: responsibleTitle || null,
          responsibleUserId: responsibleUserId || null,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Не удалось сохранить настройки документа");
      }

      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить настройки документа"
      );
    } finally {
      setIsSubmitting(false);
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

        <div className="space-y-10 px-6 py-5">
          <div className="space-y-3">
            <Label htmlFor="cold-document-title" className="text-[13px] font-medium text-[#3c4053]">
              Название документа
            </Label>
            <Input
              id="cold-document-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">
              Должность ответственного за снятие показателей
            </Label>
            <Select
              value={responsibleTitle}
              onValueChange={(value) => {
                setResponsibleTitle(value);
                setResponsibleUserId("");
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="Выберите должность" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={users} />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
            <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {(responsibleTitle ? getUsersForRoleLabel(users, responsibleTitle, { keepUserId: responsibleUserId }) : users).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || title.trim() === ""}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white transition-colors hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ColdEquipmentDocumentsClient({
  activeTab,
  routeCode,
  templateCode,
  templateName,
  users,
  documents,
}: Props) {
  const router = useRouter();
  const [editingDocument, setEditingDocument] = useState<JournalListDocument | null>(null);
  const { deleteDocument, openPdf } = useJournalDocumentActions();

  async function handleDelete(document: JournalListDocument) {
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title}» будет удалён безвозвратно.`,
      bullets: [
        { label: `Период документа: ${document.periodLabel}`, tone: "info" },
        { label: "Удалятся все показания холодильного оборудования за этот период", tone: "warn" },
      ],
      successMessage: `Документ «${document.title}» удалён`,
      errorMessage: "Не удалось удалить документ",
    });
  }

  return (
    <>
      <div className={JOURNAL_LIST_STACK_CLASS}>
        <JournalTopBar
        routeCode={routeCode}
          heading={templateName}
          activeTab={activeTab}
          templateCode={templateCode}
          templateName={templateName}
          users={users}
        />

        <JournalTabs activeTab={activeTab} templateCode={routeCode} />

        <div className="space-y-5">
          {documents.length === 0 ? <EmptyDocumentsState /> : null}

          {documents.map((document) => {
            const href = `/journals/${routeCode}/documents/${document.id}`;

            return (
              <div key={document.id} className={JOURNAL_LIST_CARD_CLASS}>
                <Link href={href} className={JOURNAL_CARD_TITLE_CLASS}>
                  {document.title}
                </Link>

                <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                  <div className={JOURNAL_CARD_LABEL_CLASS}>Ответственный</div>
                  <div className={JOURNAL_CARD_VALUE_CLASS}>
                    {document.responsibleTitle && document.responsibleUserName
                      ? `${document.responsibleTitle}: ${document.responsibleUserName}`
                      : document.responsibleTitle || document.responsibleUserName || "Не назначен"}
                  </div>
                </Link>

                <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                  <div className={JOURNAL_CARD_LABEL_CLASS}>Период</div>
                  <div className={JOURNAL_CARD_VALUE_CLASS}>
                    {document.periodLabel}
                  </div>
                </Link>

                <div className="flex items-center justify-center text-[#5566f6]">
                  <DocumentActionsMenu
                    onEdit={document.status === "active" ? () => setEditingDocument(document) : undefined}
                    onPrint={() => openPdf({ documentId: document.id })}
                    onDelete={document.status === "active" ? () => handleDelete(document) : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <EditDocumentDialog
        open={!!editingDocument}
        onOpenChange={(open) => {
          if (!open) setEditingDocument(null);
        }}
        document={editingDocument}
        users={users}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
