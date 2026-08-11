"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  CalendarDays,
  Copy,
  Ellipsis,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SANITATION_DAY_DOCUMENT_TITLE,
  SANITATION_DAY_HEADING,
  createEmptySanitationRow,
  getSanitationApproveLabel,
  getSanitationDayDefaultConfig,
  getSanitationDocumentDateLabel,
  getSanitationYearLabel,
  normalizeSanitationDayConfig,
  type SanitationDayConfig,
} from "@/lib/sanitation-day-document";

import { toast } from "sonner";
import {
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
import { PositionEmployeePicker } from "@/components/shared/position-select";
type UserItem = {
  id: string;
  name: string;
  role: string;
};

type SanitationDocumentItem = {
  id: string;
  title: string;
  status: "active" | "closed";
  dateFrom: string;
  dateTo: string;
  config: unknown;
};

type Props = {
  routeCode: string;
  templateCode: string;
  activeTab: "active" | "closed";
  users: UserItem[];
  documents: SanitationDocumentItem[];
};

type SettingsState = {
  title: string;
  documentDate: string;
  year: string;
  approveRole: string;
  approveEmployeeId: string;
  approveEmployee: string;
  responsibleRole: string;
  responsibleEmployeeId: string;
  responsibleEmployee: string;
};

/** Общий класс триггера селектов в диалоге настроек санитарного дня. */
const SANITATION_TRIGGER_CLASS =
  "h-9 rounded-xl border-[#dcdfed] bg-[#fafbff] px-5 text-[16px]";

function toIsoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function toUiState(document: SanitationDocumentItem): SettingsState {
  const normalized = normalizeSanitationDayConfig(document.config);
  return {
    title: document.title || SANITATION_DAY_DOCUMENT_TITLE,
    documentDate: normalized.documentDate,
    year: String(normalized.year),
    approveRole: normalized.approveRole,
    approveEmployeeId: normalized.approveEmployeeId || "",
    approveEmployee: normalized.approveEmployee,
    responsibleRole: normalized.responsibleRole,
    responsibleEmployeeId: normalized.responsibleEmployeeId || "",
    responsibleEmployee: normalized.responsibleEmployee,
  };
}

function SettingsDialog(props: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  users: UserItem[];
  initial: SettingsState | null;
  onSubmit: (value: SettingsState) => Promise<void>;
  submitText: string;
  title: string;
}) {
  const [state, setState] = useState<SettingsState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const activeState = state || props.initial;

  async function handleSubmit() {
    if (!activeState) return;
    setSubmitting(true);
    try {
      await props.onSubmit(activeState);
      props.onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(value) => {
        if (value) setState(props.initial);
        props.onOpenChange(value);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b px-5 py-6 sm:px-10 sm:py-8">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[22px] font-semibold tracking-[-0.03em] text-black">
              {props.title}
            </DialogTitle>
            <button
              type="button"
              className="rounded-xl p-2 text-[#0b1024]"
              onClick={() => props.onOpenChange(false)}
            >
              <X className="size-8" />
            </button>
          </div>
        </DialogHeader>

        {activeState ? (
          <div className="space-y-5 px-5 py-6 sm:px-10 sm:py-8">
            <div className="space-y-2">
              <Label className="text-[15px] text-[#6f7282]">
                Название документа
              </Label>
              <Input
                value={activeState.title}
                onChange={(event) =>
                  setState({ ...activeState, title: event.target.value })
                }
                className="h-9 rounded-xl border-[#dcdfed] px-5 text-[16px] tracking-[-0.02em]"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[15px] text-[#6f7282]">
                Дата документа
              </Label>
              <div className="relative">
                <Input
                  type="date"
                  value={activeState.documentDate}
                  onChange={(event) =>
                    setState({
                      ...activeState,
                      documentDate: toIsoDate(event.target.value),
                    })
                  }
                  className="h-9 rounded-xl border-[#dcdfed] px-5 pr-12 text-[16px] tracking-[-0.02em]"
                />
                <CalendarDays className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-[#6f7282] sm:right-6 sm:size-8" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[15px] text-[#6f7282]">Год</Label>
              <Select
                value={activeState.year}
                onValueChange={(value) =>
                  setState({ ...activeState, year: value })
                }
              >
                <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-5 text-[16px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const year = String(new Date().getFullYear() - 2 + idx);
                    return (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <PositionEmployeePicker
              users={props.users}
              value={{
                positionTitle: activeState.approveRole,
                userId: activeState.approveEmployeeId,
              }}
              onChange={(next) =>
                setState({
                  ...activeState,
                  approveRole: next.positionTitle,
                  approveEmployeeId: next.userId,
                  approveEmployee:
                    props.users.find((item) => item.id === next.userId)?.name || "",
                })
              }
              positionLabel={'Должность «Утверждаю»'}
              employeeLabel={'Сотрудник «Утверждаю»'}
              labelClassName="text-[15px] text-[#6f7282]"
              triggerClassName={SANITATION_TRIGGER_CLASS}
            />

            <PositionEmployeePicker
              users={props.users}
              value={{
                positionTitle: activeState.responsibleRole,
                userId: activeState.responsibleEmployeeId,
              }}
              onChange={(next) =>
                setState({
                  ...activeState,
                  responsibleRole: next.positionTitle,
                  responsibleEmployeeId: next.userId,
                  responsibleEmployee:
                    props.users.find((item) => item.id === next.userId)?.name || "",
                })
              }
              positionLabel="Должность ответственного"
              employeeLabel="Ответственный сотрудник"
              labelClassName="text-[15px] text-[#6f7282]"
              triggerClassName={SANITATION_TRIGGER_CLASS}
            />

            <div className="flex justify-end pt-3">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white transition-colors hover:bg-[#4a5bf0]"
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

export function SanitationDayDocumentsClient({
  routeCode,
  templateCode,
  activeTab,
  users,
  documents,
}: Props) {
  const router = useRouter();
  const [settingsTarget, setSettingsTarget] =
    useState<SanitationDocumentItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { deleteDocument, setStatus, openPdf } = useJournalDocumentActions();

  async function createDocument(payload: SettingsState) {
    const config = {
      ...getSanitationDayDefaultConfig(
        new Date(`${payload.year}-01-01T00:00:00Z`),
      ),
      year: Number(payload.year),
      documentDate: payload.documentDate,
      approveRole: payload.approveRole,
      approveEmployeeId: payload.approveEmployeeId || null,
      approveEmployee: payload.approveEmployee,
      responsibleRole: payload.responsibleRole,
      responsibleEmployeeId: payload.responsibleEmployeeId || null,
      responsibleEmployee: payload.responsibleEmployee,
      rows: [createEmptySanitationRow("Производство 1 этаж")],
    } as SanitationDayConfig;

    const response = await fetch("/api/journal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateCode,
        title: payload.title.trim() || SANITATION_DAY_DOCUMENT_TITLE,
        dateFrom: payload.documentDate,
        dateTo: payload.documentDate,
        responsibleTitle: payload.responsibleRole,
        config,
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

    const currentConfig = normalizeSanitationDayConfig(current.config);
    const config: SanitationDayConfig = {
      ...currentConfig,
      year: Number(payload.year),
      documentDate: payload.documentDate,
      approveRole: payload.approveRole,
      approveEmployeeId: payload.approveEmployeeId || null,
      approveEmployee: payload.approveEmployee,
      responsibleRole: payload.responsibleRole,
      responsibleEmployeeId: payload.responsibleEmployeeId || null,
      responsibleEmployee: payload.responsibleEmployee,
    };

    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title.trim() || SANITATION_DAY_DOCUMENT_TITLE,
        dateFrom: payload.documentDate,
        dateTo: payload.documentDate,
        responsibleTitle: payload.responsibleRole,
        config,
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось сохранить настройки");
      return;
    }

    router.refresh();
  }

  async function handleDelete(document: SanitationDocumentItem) {
    const cfg = normalizeSanitationDayConfig(document.config);
    await deleteDocument({
      documentId: document.id,
      description: `Документ «${document.title || SANITATION_DAY_DOCUMENT_TITLE}» будет удалён безвозвратно.`,
      bullets: [
        { label: `Дата документа: ${getSanitationDocumentDateLabel(cfg.documentDate)}`, tone: "info" },
        { label: "Удалятся все строки и отметки санитарного дня", tone: "warn" },
      ],
      successMessage: `Документ «${document.title || SANITATION_DAY_DOCUMENT_TITLE}» удалён`,
      errorMessage: "Не удалось удалить документ",
    });
  }

  async function cloneDocument(documentId: string) {
    const current = documents.find((item) => item.id === documentId);
    if (!current) return;

    const cfg = normalizeSanitationDayConfig(current.config);
    const response = await fetch("/api/journal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateCode,
        title: current.title,
        dateFrom: cfg.documentDate,
        dateTo: cfg.documentDate,
        responsibleTitle: cfg.responsibleRole,
        config: cfg,
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось сделать копию");
      return;
    }

    router.refresh();
  }

  const defaultCreateState = useMemo<SettingsState>(() => {
    const cfg = getSanitationDayDefaultConfig();
    return {
      title: SANITATION_DAY_DOCUMENT_TITLE,
      documentDate: cfg.documentDate,
      year: String(cfg.year),
      approveRole: cfg.approveRole,
      approveEmployeeId: cfg.approveEmployeeId || "",
      approveEmployee: cfg.approveEmployee,
      responsibleRole: cfg.responsibleRole,
      responsibleEmployeeId: cfg.responsibleEmployeeId || "",
      responsibleEmployee: cfg.responsibleEmployee,
    };
  }, []);

  return (
    <div className="space-y-8 sm:space-y-14">
      <JournalTopBar
        routeCode={routeCode}
        heading={`${SANITATION_DAY_HEADING}${activeTab === "closed" ? " (закрытые)" : ""}`}
        activeTab={activeTab}
        templateCode={templateCode}
        templateName={SANITATION_DAY_HEADING}
        users={users}
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
          <EmptyDocumentsState />
        ) : null}

        {documents.map((document) => {
          const cfg = normalizeSanitationDayConfig(document.config);
          const href = `/journals/${routeCode}/documents/${document.id}`;

          return (
            <div
              key={document.id}
              className="grid grid-cols-1 gap-4 rounded-2xl border border-[#ececf4] bg-white px-6 py-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:grid-cols-[minmax(0,1.8fr)_120px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_48px] sm:items-center sm:gap-0 sm:px-6"
            >
              <Link
                href={href}
                className={JOURNAL_CARD_TITLE_CLASS}
              >
                {document.title || SANITATION_DAY_DOCUMENT_TITLE}
              </Link>

              <Link
                href={href}
                className={JOURNAL_CARD_SECTION_CLASS}
              >
                <div className={JOURNAL_CARD_LABEL_CLASS}>Год</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {getSanitationYearLabel(cfg.year)}
                </div>
              </Link>

              <Link
                href={href}
                className={JOURNAL_CARD_SECTION_CLASS}
              >
                <div className={JOURNAL_CARD_LABEL_CLASS}>
                  Должность &quot;Утверждаю&quot;
                </div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {getSanitationApproveLabel(
                    cfg.approveRole,
                    cfg.approveEmployee,
                  )}
                </div>
              </Link>

              <Link
                href={href}
                className={JOURNAL_CARD_SECTION_CLASS}
              >
                <div className={JOURNAL_CARD_LABEL_CLASS}>Ответственный</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {getSanitationApproveLabel(
                    cfg.responsibleRole,
                    cfg.responsibleEmployee,
                  )}
                </div>
              </Link>

              <Link
                href={href}
                className={JOURNAL_CARD_SECTION_CLASS}
              >
                <div className={JOURNAL_CARD_LABEL_CLASS}>Дата документа</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {getSanitationDocumentDateLabel(cfg.documentDate)}
                </div>
              </Link>

              <div className="flex items-center justify-start text-[#5566f6] sm:justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full hover:bg-[#f5f6ff]"
                    >
                      <Ellipsis className="size-8" />
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="end"
                    className="w-[320px] rounded-[28px] border-0 p-5 shadow-xl"
                  >
                    {document.status === "active" ? (
                      <>
                        <DropdownMenuItem
                          className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                          onSelect={() => setSettingsTarget(document)}
                        >
                          <Pencil className="mr-3 size-6 text-[#6f7282]" />
                          Настройки
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                          onSelect={() => cloneDocument(document.id)}
                        >
                          <Copy className="mr-3 size-6 text-[#6f7282]" />
                          Сделать копию
                        </DropdownMenuItem>
                      </>
                    ) : null}

                    <DropdownMenuItem
                      className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                      onSelect={() => openPdf({ documentId: document.id })}
                    >
                      <Printer className="mr-3 size-6 text-[#6f7282]" />
                      Печать
                    </DropdownMenuItem>

                    {document.status === "closed" ? (
                      <DropdownMenuItem
                        className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                        onSelect={() => setStatus("active", { documentId: document.id })}
                      >
                        <BookOpenText className="mr-3 size-6 text-[#6f7282]" />
                        Отправить в активные
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem
                          className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                          onSelect={() => setStatus("closed", { documentId: document.id })}
                        >
                          <BookOpenText className="mr-3 size-6 text-[#6f7282]" />
                          Отправить в закрытые
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="h-9 rounded-xl px-3.5 text-[13.5px] text-[#ff3b30] focus:text-[#ff3b30]"
                          onSelect={() => handleDelete(document)}
                        >
                          <Trash2 className="mr-3 size-6 text-[#ff3b30]" />
                          Удалить
                        </DropdownMenuItem>
                      </>
                    )}
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
        users={users}
        initial={defaultCreateState}
        onSubmit={createDocument}
        submitText="Создать"
        title="Создание документа"
      />

      <SettingsDialog
        open={!!settingsTarget}
        onOpenChange={(value) => {
          if (!value) setSettingsTarget(null);
        }}
        users={users}
        initial={settingsTarget ? toUiState(settingsTarget) : null}
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
