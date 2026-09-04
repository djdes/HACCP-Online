"use client";

import { TOUR } from "@/lib/tour-anchors";

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
import { cn } from "@/lib/utils";
import { FloatingInputField } from "@/components/journals/journal-dialog-field";
import {
  getStaffJournalResponsibleTitleOptions,
} from "@/lib/hygiene-document";
import { ControlPeriodicityField } from "@/components/journals/control-periodicity-field";
import { getDefaultControlPeriodicity } from "@/lib/control-periodicity";
import {
  getJournalDocumentHeading,
} from "@/lib/journal-document-helpers";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";

import { toast } from "sonner";
import {
  JOURNAL_CARD_LABEL_CLASS,
  JOURNAL_CARD_SECTION_CLASS,
  JOURNAL_CARD_TITLE_CLASS,
  JOURNAL_CARD_VALUE_CLASS,
  JOURNAL_DIALOG_ACTIONS_CLASS,
  JOURNAL_DIALOG_BODY_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_FIELDS_CLASS,
  JOURNAL_DIALOG_FOOTER_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_SUBMIT_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  JOURNAL_LIST_CARD_CLASS,
  JOURNAL_LIST_STACK_CLASS,
  JOURNAL_LIST_CARDS_CLASS,
} from "@/components/journals/journal-responsive";
import { PositionEmployeePicker } from "@/components/shared/position-select";
import { PageGuide } from "@/components/ui/page-guide";
import { AUTOMATION_ENABLE_BULLETS } from "@/lib/journal-automation";
type JournalListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  periodLabel: string;
  /** Текст «Периодичность контроля» документа (config.controlPeriodicity). */
  controlPeriodicity?: string;
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
  /**
   * Тумблер «журнал ведётся сам». Передаётся только для журналов,
   * которые автоматика умеет обслуживать (hygiene / health_check) —
   * этот же клиент рендерит десяток других журналов.
   */
  automation?: {
    code: string;
    enabled: boolean;
    canManage: boolean;
    noticeSeen: boolean;
  };
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
  const [periodicity, setPeriodicity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!document || !open) return;
    setTitle(document.title);
    setResponsibleTitle(document.responsibleTitle || responsibleOptions[0] || "");
    setResponsibleUserId(document.responsibleUserId || "");
    setPeriodicity(
      document.controlPeriodicity ?? getDefaultControlPeriodicity(templateCode)
    );
  }, [document, open, responsibleOptions, templateCode]);

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
          controlPeriodicity: periodicity,
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
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>Настройки журнала</DialogTitle>
        </DialogHeader>

        <div className={cn(JOURNAL_DIALOG_BODY_CLASS, JOURNAL_DIALOG_FIELDS_CLASS)}>
          <FloatingInputField
            id="edit-doc-title"
            label="Название документа"
            value={title}
            onChange={setTitle}
          />

          <PositionEmployeePicker
            users={users}
            value={{ positionTitle: responsibleTitle, userId: responsibleUserId }}
            onChange={(n) => {
              setResponsibleTitle(n.positionTitle);
              setResponsibleUserId(n.userId);
            }}
            positionLabel="Должность ответственного"
            employeeLabel="Ответственный"
            variant="floating"
            autoPick="first"
          />

          <ControlPeriodicityField
            value={periodicity}
            onChange={setPeriodicity}
          />
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
    <div className={JOURNAL_LIST_CARD_CLASS} data-tour={TOUR.documentCard}>
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

export function HygieneDocumentsClient(props: Props) {
  const { activeTab, templateCode, templateName, users, documents } = props;
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
      <div className={JOURNAL_LIST_STACK_CLASS}>
        <JournalTopBar
          heading={getJournalDocumentHeading(templateCode, activeTab === "closed")}
          activeTab={activeTab}
          templateCode={templateCode}
          templateName={templateName}
          users={users}
          documentCount={documents.length}
          firstDocumentId={activeTab === "active" ? documents[0]?.id : undefined}
        />

        <JournalTabs activeTab={activeTab} templateCode={templateCode} />

        {props.automation ? (
          <>
            <PageGuide
              title="Как журнал ведётся сам"
              storageKey="journal-automation-staff-v1"
              bullets={[...AUTOMATION_ENABLE_BULLETS]}
              qa={[
                {
                  q: "А если у сотрудника температура?",
                  a: "Откройте журнал в тот же день и поменяйте отметку. Прошлые дни закрыты — задним числом журнал править нельзя.",
                },
                {
                  q: "Нужно ли создавать документ вручную?",
                  a: "Нет. Каждый день в 06:00 документ на текущий период создаётся сам. Вручную — только если нужен документ на другой период.",
                },
                {
                  q: "Как выключить?",
                  a: "Автосоздание — тумблер на этой странице, ежедневное заполнение — в самом документе. Уже заполненное останется на месте.",
                },
              ]}
            />
          </>
        ) : null}


        <div className={JOURNAL_LIST_CARDS_CLASS}>
          {documents.length === 0 && (
            <EmptyDocumentsState
              templateCode={templateCode}
              templateName={templateName}
              users={users}
            />
          )}
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
