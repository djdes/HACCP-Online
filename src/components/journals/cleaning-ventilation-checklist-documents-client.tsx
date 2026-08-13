"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Ellipsis,
  Plus,
  Printer,
  Settings2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import {
  CLEANING_VENTILATION_CHECKLIST_TITLE,
  getDefaultCleaningVentilationConfig,
} from "@/lib/cleaning-ventilation-checklist-document";

import { toast } from "sonner";
import {
  EMPTY_STATE_CREATE_BUTTON_CLASS,
  EmptyDocumentsState,
  JournalTabs,
  JournalTopBar,
} from "@/components/journals/document-list-ui";
import { useJournalDocumentActions } from "@/components/journals/use-journal-document-actions";
import {
  DateField,
  FloatingInputField,
} from "@/components/journals/journal-dialog-field";
import { ControlPeriodicityField } from "@/components/journals/control-periodicity-field";
import {
  getDefaultControlPeriodicity,
  readControlPeriodicity,
} from "@/lib/control-periodicity";
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
} from "@/components/journals/journal-responsive";
type DocumentItem = {
  id: string;
  title: string;
  status: "active" | "closed";
  dateFrom: string;
  config?: Record<string, unknown> | null;
};

type UserItem = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  activeTab: "active" | "closed";
  routeCode: string;
  templateCode: string;
  users: UserItem[];
  documents: DocumentItem[];
};

type SettingsState = {
  title: string;
  dateFrom: string;
  controlPeriodicity: string;
};

function getDefaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateLabel(isoDate: string) {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("ru-RU");
}

function SettingsDialog(props: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initial: SettingsState | null;
  onSubmit: (value: SettingsState) => Promise<void>;
  submitText: string;
  title: string;
}) {
  const [state, setState] = useState<SettingsState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const activeState = state || props.initial;

  return (
    <Dialog
      open={props.open}
      onOpenChange={(value) => {
        if (value) setState(props.initial);
        props.onOpenChange(value);
      }}
    >
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <div className="flex items-center justify-between">
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              {props.title}
            </DialogTitle>
          </div>
        </DialogHeader>
        {activeState ? (
          <div className={cn(JOURNAL_DIALOG_BODY_CLASS, JOURNAL_DIALOG_FIELDS_CLASS)}>
            <FloatingInputField
              label="Название документа"
              value={activeState.title}
              onChange={(value) => setState({ ...activeState, title: value })}
            />
            {/* Чек-лист вентиляции — одиночный документ на день, поэтому
                подпись «Дата проведения», а не «Дата начала». Контрол —
                общий DateField (ДД.ММ.ГГГГ + русский календарь). */}
            <DateField
              label="Дата проведения"
              value={activeState.dateFrom}
              onChange={(value) => setState({ ...activeState, dateFrom: value })}
            />
            <ControlPeriodicityField
              value={activeState.controlPeriodicity}
              onChange={(value) =>
                setState({ ...activeState, controlPeriodicity: value })
              }
            />
          </div>
        ) : null}
        {activeState ? (
          <div className={JOURNAL_DIALOG_FOOTER_CLASS}>
            <div className={JOURNAL_DIALOG_ACTIONS_CLASS}>
              <Button
                type="button"
                onClick={async () => {
                  if (!activeState) return;
                  setSubmitting(true);
                  try {
                    await props.onSubmit(activeState);
                    props.onOpenChange(false);
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className={JOURNAL_DIALOG_SUBMIT_CLASS}
              >
                {submitting ? "Сохранение..." : props.submitText}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function CleaningVentilationChecklistDocumentsClient({
  routeCode,
  templateCode,
  activeTab,
  users,
  documents,
}: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<DocumentItem | null>(null);
  const { deleteDocument, setStatus, openPdf } = useJournalDocumentActions();

  const createInitial = useMemo<SettingsState>(
    () => ({
      title: CLEANING_VENTILATION_CHECKLIST_TITLE,
      dateFrom: getDefaultDate(),
      controlPeriodicity: getDefaultControlPeriodicity(templateCode),
    }),
    [templateCode]
  );

  async function createDocument(payload: SettingsState) {
    const config = getDefaultCleaningVentilationConfig(users);
    const response = await fetch("/api/journal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateCode,
        title: payload.title.trim() || CLEANING_VENTILATION_CHECKLIST_TITLE,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateFrom,
        config,
        controlPeriodicity: payload.controlPeriodicity,
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось создать документ");
      return;
    }

    const data = (await response.json()) as { document: { id: string } };
    router.push(`/journals/${routeCode}/documents/${data.document.id}`);
    router.refresh();
  }

  async function saveSettings(documentId: string, payload: SettingsState) {
    const current = documents.find((item) => item.id === documentId);
    if (!current) return;

    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title.trim() || CLEANING_VENTILATION_CHECKLIST_TITLE,
        dateFrom: payload.dateFrom,
        dateTo: payload.dateFrom,
        config: current.config ?? getDefaultCleaningVentilationConfig(users),
        controlPeriodicity: payload.controlPeriodicity,
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось сохранить настройки");
      return;
    }

    router.refresh();
  }

  async function handleDelete(document: DocumentItem) {
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title || CLEANING_VENTILATION_CHECKLIST_TITLE}» будет удалён безвозвратно.`,
      bullets: [
        { label: `Дата начала: ${formatDateLabel(document.dateFrom)}`, tone: "info" },
        { label: "Удалятся все отметки чек-листа за этот документ", tone: "warn" },
      ],
      successMessage: `Документ «${document.title || CLEANING_VENTILATION_CHECKLIST_TITLE}» удалён`,
      errorMessage: "Не удалось удалить документ",
    });
  }

  return (
    <div className={JOURNAL_LIST_STACK_CLASS}>
      <JournalTopBar
        routeCode={routeCode}
        heading={`${CLEANING_VENTILATION_CHECKLIST_TITLE}${activeTab === "closed" ? " (закрытые)" : ""}`}
        activeTab={activeTab}
        templateCode={templateCode}
        templateName={CLEANING_VENTILATION_CHECKLIST_TITLE}
        users={users}
        documentCount={documents.length}
        createSlot={
          <Button
            className="h-10 w-full rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#4a5bf0] sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" />
            Создать документ
          </Button>
        }
      />

      <JournalTabs activeTab={activeTab} templateCode={routeCode} />

      <div className="space-y-5">
        {documents.length === 0 ? (
          <EmptyDocumentsState
            action={<Button
              type="button"
              className={EMPTY_STATE_CREATE_BUTTON_CLASS}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Создать документ
            </Button>}
          />
        ) : null}

        {documents.map((document) => {
          const href = `/journals/${routeCode}/documents/${document.id}`;
          return (
            <div key={document.id} className={JOURNAL_LIST_CARD_CLASS}>
              <Link href={href} className={JOURNAL_CARD_TITLE_CLASS}>
                {document.title || CLEANING_VENTILATION_CHECKLIST_TITLE}
              </Link>

              <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                <div className={JOURNAL_CARD_LABEL_CLASS}>Дата начала</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {formatDateLabel(document.dateFrom)}
                </div>
              </Link>

              <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                <div className={JOURNAL_CARD_LABEL_CLASS}>Статус</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {document.status === "active" ? "Активный" : "Закрытый"}
                </div>
              </Link>

              <div className="flex items-center justify-center text-[#5566f6]">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full hover:bg-[#f5f6ff]"
                    >
                      <Ellipsis className="size-8" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-5 shadow-xl sm:w-[320px]">
                    <DropdownMenuItem
                      className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                      onSelect={() => setSettingsTarget(document)}
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
                    <DropdownMenuItem
                      className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                      onSelect={() =>
                        setStatus(document.status === "active" ? "closed" : "active", {
                          documentId: document.id,
                        })
                      }
                    >
                      <CalendarDays className="mr-3 size-5 text-[#6f7282]" />
                      {document.status === "active" ? "Закрыть" : "Вернуть в активные"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="h-9 rounded-xl px-3.5 text-[13.5px] text-[#ff3b30] focus:text-[#ff3b30]"
                      onSelect={() => handleDelete(document)}
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

      <SettingsDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initial={createInitial}
        onSubmit={createDocument}
        submitText="Создать"
        title="Создание документа"
      />

      <SettingsDialog
        open={Boolean(settingsTarget)}
        onOpenChange={(value) => {
          if (!value) setSettingsTarget(null);
        }}
        initial={
          settingsTarget
            ? {
                title: settingsTarget.title || CLEANING_VENTILATION_CHECKLIST_TITLE,
                dateFrom: settingsTarget.dateFrom || getDefaultDate(),
                controlPeriodicity: readControlPeriodicity(
                  settingsTarget.config,
                  templateCode
                ),
              }
            : null
        }
        onSubmit={async (value) => {
          if (!settingsTarget) return;
          await saveSettings(settingsTarget.id, value);
        }}
        submitText="Сохранить"
        title="Настройки журнала"
      />
    </div>
  );
}
