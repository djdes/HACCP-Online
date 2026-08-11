"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DocumentActionsMenu,
  EmptyDocumentsState,
  JournalTabs,
  JournalTopBar,
} from "@/components/journals/document-list-ui";
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
import {
  getStaffJournalResponsibleTitleOptions,
  HYGIENE_PERIODICITY_TEXT,
} from "@/lib/hygiene-document";
import {
  getJournalDocumentHeading,
  isStaffDocumentTemplate,
} from "@/lib/journal-document-helpers";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";

import { toast } from "sonner";
import {
  JOURNAL_CARD_LABEL_CLASS,
  JOURNAL_CARD_SECTION_CLASS,
  JOURNAL_CARD_TITLE_CLASS,
  JOURNAL_CARD_VALUE_CLASS,
  JOURNAL_LIST_CARD_CLASS,
} from "@/components/journals/journal-responsive";
import { PositionSelectItems } from "@/components/shared/position-select";
import { getUsersForRoleLabel } from "@/lib/user-roles";
type JournalListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  periodLabel: string;
};

type UserProp = {
  id: string;
  name: string;
  role: string;
  positionTitle?: string | null;
  jobPosition?: { name: string; categoryKey: string } | null;
};

type Props = {
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: UserProp[];
  documents: JournalListDocument[];
};

function EditDocumentDialog({
  open,
  onOpenChange,
  document,
  users,
  responsibleOptions,
  templateCode,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  document: JournalListDocument | null;
  users: UserProp[];
  responsibleOptions: string[];
  templateCode: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [responsibleTitle, setResponsibleTitle] = useState("");
  const [responsibleUserId, setResponsibleUserId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!document || !open) return;
    setTitle(document.title);
    setResponsibleTitle(document.responsibleTitle || responsibleOptions[0] || "");
    setResponsibleUserId(document.responsibleUserId || "");
  }, [document, open, responsibleOptions]);

  async function handleSave() {
    if (!document) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/journal-documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          responsibleTitle,
          responsibleUserId: responsibleUserId || null,
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error || "Не удалось сохранить настройки документа");
      }

      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки документа");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[32px] border-0 p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b px-5 py-6 sm:px-10 sm:py-8">
          <DialogTitle className="text-[22px] font-medium text-black">Настройки журнала</DialogTitle>
        </DialogHeader>

        <div className="space-y-8 px-10 py-8">
          <div className="space-y-3">
            <Label htmlFor="edit-doc-title" className="sr-only">
              Название документа
            </Label>
            <Input
              id="edit-doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите название документа"
              className="h-9 rounded-xl border-[#dcdfed] px-5 text-[16px] focus-visible:border-[#5566f6] focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[14px] text-[#6f7282]">Должность ответственного</Label>
            <Select
              value={responsibleTitle}
              onValueChange={(value) => {
                setResponsibleTitle(value);
                setResponsibleUserId("");
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-5 text-[16px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={users} />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-[14px] text-[#6f7282]">Сотрудник</Label>
            <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-5 text-[16px]">
                <SelectValue placeholder="- Выберите значение -" />
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

          {isStaffDocumentTemplate(templateCode) && templateCode !== "health_check" && (
            <div className="space-y-2 rounded-3xl border border-[#ececf4] px-6 py-5">
              <div className="text-[14px] text-[#6f7282]">Периодичность контроля</div>
              <div className="text-[15px] leading-[1.35] text-black">{HYGIENE_PERIODICITY_TEXT}</div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleSave}
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

function DocumentRow({
  templateCode,
  document,
  canManage,
  onEdit,
  onPrint,
  onDelete,
}: {
  templateCode: string;
  document: JournalListDocument;
  canManage: boolean;
  onEdit: (document: JournalListDocument) => void;
  onPrint: (document: JournalListDocument) => void;
  onDelete: (document: JournalListDocument) => void;
}) {
  const href = `/journals/${templateCode}/documents/${document.id}`;

  return (
    <div className={JOURNAL_LIST_CARD_CLASS}>
      <Link href={href} className={JOURNAL_CARD_TITLE_CLASS}>
        {document.title}
      </Link>
      <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
        <div className={JOURNAL_CARD_LABEL_CLASS}>Должность ответственного</div>
        <div className={JOURNAL_CARD_VALUE_CLASS}>{document.responsibleTitle || ""}</div>
      </Link>
      <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
        <div className={JOURNAL_CARD_LABEL_CLASS}>Период</div>
        <div className={JOURNAL_CARD_VALUE_CLASS}>{document.periodLabel}</div>
      </Link>
      <div className="flex items-center justify-center text-[#5566f6]">
        <DocumentActionsMenu
          onEdit={canManage ? () => onEdit(document) : undefined}
          onPrint={() => onPrint(document)}
          onDelete={canManage ? () => onDelete(document) : undefined}
        />
      </div>
    </div>
  );
}

export function HygieneDocumentsClient({
  activeTab,
  templateCode,
  templateName,
  users,
  documents,
}: Props) {
  const [editingDocument, setEditingDocument] = useState<JournalListDocument | null>(null);
  const responsibleOptions = getStaffJournalResponsibleTitleOptions(users);
  // Единый источник delete / status / pdf для журнальных документов.
  // documentId передаём в каждом вызове — на списке их много.
  const { deleteDocument, openPdf } = useJournalDocumentActions();

  async function handleDelete(document: JournalListDocument) {
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title}» будет удалён безвозвратно.`,
      bullets: [
        { label: `Период документа: ${document.periodLabel}`, tone: "info" },
        {
          label: "Удалятся все отметки сотрудников за этот период",
          tone: "warn",
        },
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
          heading={getJournalDocumentHeading(templateCode, activeTab === "closed")}
          activeTab={activeTab}
          templateCode={templateCode}
          templateName={templateName}
          users={users}
        />

        <JournalTabs activeTab={activeTab} templateCode={templateCode} />

        <div className="space-y-5">
          {documents.length === 0 && <EmptyDocumentsState />}
          {documents.map((document) => (
            <DocumentRow
              key={document.id}
              templateCode={templateCode}
              document={document}
              canManage={document.status === "active"}
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
        users={users}
        responsibleOptions={responsibleOptions}
        templateCode={templateCode}
      />
    </>
  );
}
