"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  BookOpenText,
  Ellipsis,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyCleaningAutoFillToConfig,
  CLEANING_DOCUMENT_TEMPLATE_CODE,
  CLEANING_DOCUMENT_TITLE,
  CLEANING_PAGE_TITLE,
  defaultCleaningDocumentConfig,
  getCleaningCreatePeriodBounds,
  getCleaningPeriodLabel,
  normalizeCleaningDocumentConfig,
  type CleaningDocumentConfig,
} from "@/lib/cleaning-document";
import { getUsersForRoleLabel } from "@/lib/user-roles";
import {
  EMPTY_STATE_CREATE_BUTTON_CLASS,
  EmptyDocumentsState,
} from "@/components/journals/document-list-ui";
import { CreateDocumentEmptyState } from "@/components/journals/create-document-empty-state";
import {
  JOURNAL_CARD_LABEL_CLASS,
  JOURNAL_CARD_SECTION_CLASS,
  JOURNAL_CARD_TITLE_CLASS,
  JOURNAL_CARD_VALUE_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  JOURNAL_LIST_ACTIONS_CLASS,
  JOURNAL_LIST_HEADING_CLASS,
  JOURNAL_LIST_STACK_CLASS,
  JOURNAL_TAB_RAIL_CLASS,
  JOURNAL_TAB_VIEWPORT_CLASS,
} from "@/components/journals/journal-responsive";
import { PositionEmployeePicker } from "@/components/shared/position-select";
import { ControlPeriodicityField } from "@/components/journals/control-periodicity-field";
import {
  getDefaultControlPeriodicity,
  readControlPeriodicity,
} from "@/lib/control-periodicity";

type UserItem = {
  id: string;
  name: string;
  role: string;
};

type DocumentItem = {
  id: string;
  title: string;
  status: "active" | "closed";
  dateFrom: string;
  dateTo: string;
  config?: unknown;
};

type CreateState = {
  title: string;
  cleaningRole: string;
  cleaningUserId: string;
  controlRole: string;
  controlUserId: string;
  controlPeriodicity: string;
};

type SettingsState = {
  title: string;
  cleaningRole: string;
  cleaningUserId: string;
  controlRole: string;
  controlUserId: string;
  controlPeriodicity: string;
};

type Props = {
  routeCode: string;
  templateCode: string;
  activeTab: "active" | "closed";
  users: UserItem[];
  documents: DocumentItem[];
};

/** Общий класс триггера селектов в диалогах уборки. */
const CLEANING_TRIGGER_CLASS =
  "h-9 rounded-xl border-[#dfe1ec] bg-[#f1f2f8] px-3.5 text-[13.5px]";

function pickFirstUserId(users: UserItem[], roleLabel: string) {
  return getUsersForRoleLabel(users, roleLabel)[0]?.id || "";
}

function getUserName(users: UserItem[], userId: string) {
  return users.find((user) => user.id === userId)?.name || "";
}

function buildCreateState(users: UserItem[]): CreateState {
  const baseConfig = defaultCleaningDocumentConfig(users);
  const cleaningRole = baseConfig.cleaningResponsibles[0]?.title || "";
  const controlRole = baseConfig.controlResponsibles[0]?.title || "";
  return {
    title: "",
    cleaningRole,
    // Сотрудника пользователь выбирает осознанно — без авто-подстановки.
    cleaningUserId: "",
    controlRole,
    controlUserId: "",
    controlPeriodicity: getDefaultControlPeriodicity(CLEANING_DOCUMENT_TEMPLATE_CODE),
  };
}

function buildSettingsState(document: DocumentItem, users: UserItem[]): SettingsState {
  const config = normalizeCleaningDocumentConfig(document.config, { users });
  return {
    title: document.title || CLEANING_DOCUMENT_TITLE,
    cleaningRole: config.cleaningResponsibles[0]?.title || "",
    cleaningUserId: config.cleaningResponsibles[0]?.userId || "",
    controlRole: config.controlResponsibles[0]?.title || "",
    controlUserId: config.controlResponsibles[0]?.userId || "",
    controlPeriodicity: readControlPeriodicity(
      document.config,
      CLEANING_DOCUMENT_TEMPLATE_CODE
    ),
  };
}

function ConfirmDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  onSubmit: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <div className="flex items-start justify-between gap-6">
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              {props.title}
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="flex justify-end px-6 py-5">
          <Button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await props.onSubmit();
                props.onOpenChange(false);
              } finally {
                setSubmitting(false);
              }
            }}
            className="h-9 rounded-xl bg-[#5563ff] px-3.5 text-[13.5px] text-white hover:bg-[#4554ff]"
          >
            {submitting ? "Сохранение..." : props.submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserItem[];
  onSubmit: (state: CreateState) => Promise<void>;
}) {
  const [state, setState] = useState<CreateState>(buildCreateState(props.users));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setState(buildCreateState(props.users));
  }, [props.open, props.users]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <div className="flex items-center justify-between">
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Создание документа
            </DialogTitle>
          </div>
        </DialogHeader>
        {props.users.length === 0 ? (
          <div className="px-6 py-5">
            <CreateDocumentEmptyState onNavigate={() => props.onOpenChange(false)} />
          </div>
        ) : (
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Введите название документа</Label>
            <Input
              value={state.title}
              onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
              placeholder="Введите название документа"
              className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
            />
          </div>
          <PositionEmployeePicker
            users={props.users}
            value={{ positionTitle: state.cleaningRole, userId: state.cleaningUserId }}
            onChange={(next) =>
              setState((current) => ({
                ...current,
                cleaningRole: next.positionTitle,
                cleaningUserId: next.userId,
              }))
            }
            positionLabel="Должность ответственного за уборку"
            employeeLabel="Сотрудник, ответственный за уборку"
            labelClassName="text-[16px] text-[#73738a]"
            triggerClassName={CLEANING_TRIGGER_CLASS}
          />
          <PositionEmployeePicker
            users={props.users}
            value={{ positionTitle: state.controlRole, userId: state.controlUserId }}
            onChange={(next) =>
              setState((current) => ({
                ...current,
                controlRole: next.positionTitle,
                controlUserId: next.userId,
              }))
            }
            positionLabel="Должность ответственного за контроль"
            employeeLabel="Сотрудник, ответственный за контроль"
            labelClassName="text-[16px] text-[#73738a]"
            triggerClassName={CLEANING_TRIGGER_CLASS}
          />
          <ControlPeriodicityField
            value={state.controlPeriodicity}
            onChange={(value) =>
              setState((current) => ({ ...current, controlPeriodicity: value }))
            }
            labelClassName="text-[16px] text-[#73738a]"
          />
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await props.onSubmit(state);
                  props.onOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="h-9 rounded-xl bg-[#5563ff] px-3.5 text-[13.5px] text-white hover:bg-[#4554ff]"
            >
              {submitting ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserItem[];
  initialState: SettingsState | null;
  onSubmit: (state: SettingsState) => Promise<void>;
}) {
  const [state, setState] = useState<SettingsState | null>(props.initialState);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!props.open) return;
    setState(props.initialState);
  }, [props.initialState, props.open]);

  if (!state) return null;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <div className="flex items-center justify-between">
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Настройки журнала
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Название документа</Label>
            <Input
              value={state.title}
              onChange={(event) => setState((current) => current ? { ...current, title: event.target.value } : current)}
              className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
            />
          </div>
          <PositionEmployeePicker
            users={props.users}
            value={{ positionTitle: state.cleaningRole, userId: state.cleaningUserId }}
            onChange={(next) =>
              setState((current) =>
                current
                  ? {
                      ...current,
                      cleaningRole: next.positionTitle,
                      cleaningUserId: next.userId,
                    }
                  : current
              )
            }
            positionLabel="Должность ответственного за уборку"
            employeeLabel="Сотрудник, ответственный за уборку"
            labelClassName="text-[16px] text-[#73738a]"
            triggerClassName={CLEANING_TRIGGER_CLASS}
          />
          <PositionEmployeePicker
            users={props.users}
            value={{ positionTitle: state.controlRole, userId: state.controlUserId }}
            onChange={(next) =>
              setState((current) =>
                current
                  ? {
                      ...current,
                      controlRole: next.positionTitle,
                      controlUserId: next.userId,
                    }
                  : current
              )
            }
            positionLabel="Должность ответственного за контроль"
            employeeLabel="Сотрудник, ответственный за контроль"
            labelClassName="text-[16px] text-[#73738a]"
            triggerClassName={CLEANING_TRIGGER_CLASS}
          />
          <ControlPeriodicityField
            value={state.controlPeriodicity}
            onChange={(value) =>
              setState((current) =>
                current ? { ...current, controlPeriodicity: value } : current
              )
            }
            labelClassName="text-[16px] text-[#73738a]"
          />
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await props.onSubmit(state);
                  props.onOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="h-9 rounded-xl bg-[#5563ff] px-3.5 text-[13.5px] text-white hover:bg-[#4554ff]"
            >
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CleaningDocumentsClient(props: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsDocument, setSettingsDocument] = useState<DocumentItem | null>(null);
  const [deleteDocument, setDeleteDocument] = useState<DocumentItem | null>(null);
  const [archiveDocument, setArchiveDocument] = useState<DocumentItem | null>(null);

  async function createDocument(state: CreateState) {
    const period = getCleaningCreatePeriodBounds();
    const baseConfig = defaultCleaningDocumentConfig(props.users);
    // Пользователь может выбрать конкретного сотрудника в диалоге;
    // если не выбрал — fallback на первого подходящего по должности.
    const cleaningUserId =
      state.cleaningUserId || pickFirstUserId(props.users, state.cleaningRole);
    const controlUserId =
      state.controlUserId || pickFirstUserId(props.users, state.controlRole);

    const nextConfig: CleaningDocumentConfig = normalizeCleaningDocumentConfig(
      {
        ...baseConfig,
        cleaningResponsibles: [
          {
            ...baseConfig.cleaningResponsibles[0],
            title: state.cleaningRole,
            userId: cleaningUserId,
            userName: getUserName(props.users, cleaningUserId),
          },
        ],
        controlResponsibles: [
          {
            ...baseConfig.controlResponsibles[0],
            title: state.controlRole,
            userId: controlUserId,
            userName: getUserName(props.users, controlUserId),
          },
        ],
      },
      { users: props.users }
    );

    const filledConfig = applyCleaningAutoFillToConfig({
      config: nextConfig,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    });

    const response = await fetch("/api/journal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateCode: CLEANING_DOCUMENT_TEMPLATE_CODE,
        title: state.title.trim() || CLEANING_DOCUMENT_TITLE,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        responsibleTitle: state.controlRole || null,
        responsibleUserId: controlUserId || null,
        config: filledConfig,
        controlPeriodicity: state.controlPeriodicity,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.document?.id) {
      throw new Error(result?.error || "Не удалось создать документ");
    }

    router.push(`/journals/${props.routeCode}/documents/${result.document.id}`);
    router.refresh();
  }

  async function saveSettings(state: SettingsState) {
    if (!settingsDocument) return;

    const config = normalizeCleaningDocumentConfig(settingsDocument.config, {
      users: props.users,
    });

    const nextConfig = normalizeCleaningDocumentConfig(
      {
        ...config,
        cleaningResponsibles: [
          {
            ...(config.cleaningResponsibles[0] || {}),
            id: config.cleaningResponsibles[0]?.id || "cleaning-primary",
            kind: "cleaning",
            title: state.cleaningRole,
            userId: state.cleaningUserId,
            userName: getUserName(props.users, state.cleaningUserId),
            code: "С1",
          },
          ...config.cleaningResponsibles.slice(1),
        ],
        controlResponsibles: [
          {
            ...(config.controlResponsibles[0] || {}),
            id: config.controlResponsibles[0]?.id || "control-primary",
            kind: "control",
            title: state.controlRole,
            userId: state.controlUserId,
            userName: getUserName(props.users, state.controlUserId),
            code: "С1",
          },
          ...config.controlResponsibles.slice(1),
        ],
      },
      { users: props.users }
    );

    const response = await fetch(`/api/journal-documents/${settingsDocument.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: state.title.trim() || CLEANING_DOCUMENT_TITLE,
        responsibleTitle: state.controlRole || null,
        responsibleUserId: state.controlUserId || null,
        config: nextConfig,
        controlPeriodicity: state.controlPeriodicity,
      }),
    });

    if (!response.ok) {
      throw new Error("Не удалось сохранить документ");
    }

    setSettingsDocument(null);
    router.refresh();
  }

  async function deleteCurrentDocument() {
    if (!deleteDocument) return;
    const response = await fetch(`/api/journal-documents/${deleteDocument.id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Не удалось удалить документ");
    }
    setDeleteDocument(null);
    router.refresh();
  }

  async function toggleDocumentStatus() {
    if (!archiveDocument) return;
    const nextStatus = archiveDocument.status === "active" ? "closed" : "active";
    const response = await fetch(`/api/journal-documents/${archiveDocument.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    if (!response.ok) {
      throw new Error("Не удалось изменить статус документа");
    }
    setArchiveDocument(null);
    router.refresh();
  }

  return (
    <>
      <div className={JOURNAL_LIST_STACK_CLASS}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className={JOURNAL_LIST_HEADING_CLASS}>
            {CLEANING_PAGE_TITLE}
          </h1>
          <div className={JOURNAL_LIST_ACTIONS_CLASS}>
            <Button
              variant="outline"
              className="h-9 w-full rounded-lg border-0 bg-[#5566f6]/[0.04] px-3.5 text-[14px] font-semibold text-[#5566f6] shadow-none hover:bg-[#5566f6]/[0.09] sm:w-auto"
              asChild
            >
              <Link href={`/journals/${props.routeCode}/guide`}>
                <BookOpenText className="size-5" />
                Инструкция
              </Link>
            </Button>
            {/* Пока документов нет, единственная точка входа — кнопка
                внутри карточки пустого состояния (эталон). */}
            {props.activeTab === "active" && props.documents.length > 0 ? (
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="h-10 w-full rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4d58f5] sm:w-auto"
              >
                <Plus className="size-6" />
                Создать документ
              </Button>
            ) : null}
          </div>
        </div>

        {/* Вкладки — та же вёрстка и типографика, что у <JournalTabs>
            остальных 12 журналов (14px/600, pb-5, gap-8/sm:gap-12). */}
        <div className="border-b border-[#d9dce8]">
          <div className={JOURNAL_TAB_VIEWPORT_CLASS}>
            <div className={JOURNAL_TAB_RAIL_CLASS}>
              <Link
                href={`/journals/${props.routeCode}`}
                className={`relative pb-5 ${
                  props.activeTab === "active"
                    ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5566f6]"
                    : "text-[#6f7282]"
                }`}
              >
                Активные
              </Link>
              <Link
                href={`/journals/${props.routeCode}?tab=closed`}
                className={`relative pb-5 ${
                  props.activeTab === "closed"
                    ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5566f6]"
                    : "text-[#6f7282]"
                }`}
              >
                Закрытые
              </Link>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {props.documents.length === 0 ? (
            <EmptyDocumentsState
              action={
                <Button
                  type="button"
                  className={EMPTY_STATE_CREATE_BUTTON_CLASS}
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="size-5" strokeWidth={2.5} />
                  Создать документ
                </Button>
              }
            />
          ) : null}

          {props.documents.map((document) => {
            const config = normalizeCleaningDocumentConfig(document.config, {
              users: props.users,
            });
            const cleaningLines = config.cleaningResponsibles
              .filter((item) => item.userName || (item.title && item.title !== "Ответственный за уборку"))
              .map((item) => `${item.title}: ${item.userName || "—"}`);
            if (cleaningLines.length === 0) cleaningLines.push("—");
            const controlLine =
              config.controlResponsibles[0] && (config.controlResponsibles[0].userName || (config.controlResponsibles[0].title && config.controlResponsibles[0].title !== "Ответственный за контроль"))
                ? `${config.controlResponsibles[0].title}: ${config.controlResponsibles[0].userName || "—"}`
                : "—";
            const href = `/journals/${props.routeCode}/documents/${document.id}`;

            return (
              <div
                key={document.id}
                className="grid grid-cols-1 gap-4 rounded-2xl border border-[#ececf4] bg-white px-6 py-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_48px] sm:items-center sm:gap-0 sm:px-6"
              >
                <Link href={href} className={`${JOURNAL_CARD_TITLE_CLASS} min-w-0`}>
                  {document.title || CLEANING_DOCUMENT_TITLE}
                </Link>
                <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                  <div className={JOURNAL_CARD_LABEL_CLASS}>Ответственный за уборку</div>
                  <div className={`${JOURNAL_CARD_VALUE_CLASS} space-y-1`}>
                    {cleaningLines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </Link>
                <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                  <div className={JOURNAL_CARD_LABEL_CLASS}>Ответственный за контроль</div>
                  <div className={JOURNAL_CARD_VALUE_CLASS}>
                    {controlLine}
                  </div>
                </Link>
                <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                  <div className={JOURNAL_CARD_LABEL_CLASS}>Период</div>
                  <div className={JOURNAL_CARD_VALUE_CLASS}>
                    {getCleaningPeriodLabel(document.dateFrom, document.dateTo)}
                  </div>
                </Link>
                <div className="flex justify-start sm:justify-end">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex size-10 items-center justify-center rounded-full text-[#5566f6] hover:bg-[#f5f6ff]"
                      >
                        <Ellipsis className="size-8" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="max-w-[calc(100vw-1rem)] rounded-[28px] border-0 p-5 shadow-xl sm:w-[320px]">
                      <DropdownMenuItem
                        className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                        onSelect={() => setArchiveDocument(document)}
                      >
                        {document.status === "active" ? (
                          <Archive className="mr-4 size-6 text-[#6f7282]" />
                        ) : (
                          <ArchiveRestore className="mr-4 size-6 text-[#6f7282]" />
                        )}
                        {document.status === "active" ? "Закрыть" : "Восстановить"}
                      </DropdownMenuItem>
                      {document.status === "active" ? (
                        <DropdownMenuItem
                          className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                          onSelect={() => setSettingsDocument(document)}
                        >
                          <Pencil className="mr-4 size-6 text-[#6f7282]" />
                          Настройки
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="mb-2 h-9 rounded-xl px-3.5 text-[13.5px]"
                        onSelect={() =>
                          window.open(
                            `/api/journal-documents/${document.id}/pdf`,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <Printer className="mr-4 size-6 text-[#6f7282]" />
                        Печать
                      </DropdownMenuItem>
                      {document.status === "active" ? (
                        <DropdownMenuItem
                          className="h-9 rounded-xl px-3.5 text-[13.5px] text-[#ff3b30] focus:text-[#ff3b30]"
                          onSelect={() => setDeleteDocument(document)}
                        >
                          <Trash2 className="mr-4 size-6 text-[#ff3b30]" />
                          Удалить
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={props.users}
        onSubmit={createDocument}
      />

      <SettingsDialog
        open={!!settingsDocument}
        onOpenChange={(open) => {
          if (!open) setSettingsDocument(null);
        }}
        users={props.users}
        initialState={settingsDocument ? buildSettingsState(settingsDocument, props.users) : null}
        onSubmit={saveSettings}
      />

      <ConfirmDialog
        open={!!archiveDocument}
        onOpenChange={(open) => {
          if (!open) setArchiveDocument(null);
        }}
        title={
          archiveDocument?.status === "active"
            ? `Закрыть документ "${archiveDocument?.title || CLEANING_DOCUMENT_TITLE}"`
            : `Восстановить документ "${archiveDocument?.title || CLEANING_DOCUMENT_TITLE}"`
        }
        submitLabel={archiveDocument?.status === "active" ? "Закрыть" : "Восстановить"}
        onSubmit={toggleDocumentStatus}
      />

      <ConfirmDialog
        open={!!deleteDocument}
        onOpenChange={(open) => {
          if (!open) setDeleteDocument(null);
        }}
        title={`Удаление документа "${deleteDocument?.title || CLEANING_DOCUMENT_TITLE}"`}
        submitLabel="Удалить"
        onSubmit={deleteCurrentDocument}
      />
    </>
  );
}
