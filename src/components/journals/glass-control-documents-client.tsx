"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, Ellipsis, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
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
  GLASS_CONTROL_DEFAULT_FREQUENCY,
  GLASS_CONTROL_DOCUMENT_TITLE,
  GLASS_CONTROL_PAGE_TITLE,
  formatRuDateDash,
  getDefaultGlassControlConfig,
  getGlassControlResponsibleOptions,
  normalizeGlassControlConfig,
  toIsoDate,
} from "@/lib/glass-control-document";
import { getUsersForRoleLabel } from "@/lib/user-roles";

import { toast } from "sonner";
import { confirmAsync } from "@/components/ui/confirm-async";
import { EmptyDocumentsState } from "@/components/journals/document-list-ui";
import {
  JOURNAL_CARD_LABEL_CLASS,
  JOURNAL_CARD_SECTION_CLASS,
  JOURNAL_CARD_TITLE_CLASS,
  JOURNAL_CARD_VALUE_CLASS,
  JOURNAL_LIST_ACTIONS_CLASS,
  JOURNAL_LIST_HEADING_CLASS,
  JOURNAL_LIST_CARD_CLASS,
  JOURNAL_LIST_CARDS_CLASS,
} from "@/components/journals/journal-responsive";
type UserItem = {
  id: string;
  name: string;
  role: string;
};

type DocumentItem = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  responsibleUserId?: string | null;
  dateFrom: string;
  config?: unknown;
};

type Props = {
  activeTab: "active" | "closed";
  routeCode?: string;
  templateCode: string;
  templateName: string;
  users: UserItem[];
  documents: DocumentItem[];
};

type FormState = {
  title: string;
  dateFrom: string;
  controlFrequency: string;
  responsibleTitle: string;
  responsibleUserId: string;
};

function buildDefaultState(users: UserItem[]): FormState {
  const options = getGlassControlResponsibleOptions(users);
  const fallbackUser = options.management[0] || users[0];

  return {
    title: GLASS_CONTROL_DOCUMENT_TITLE,
    dateFrom: toIsoDate(new Date()),
    controlFrequency: GLASS_CONTROL_DEFAULT_FREQUENCY,
    responsibleTitle: "Управляющий",
    responsibleUserId: fallbackUser?.id || "",
  };
}

function GlassControlFormDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  users: UserItem[];
  initialState: FormState;
  submitLabel: string;
  onSubmit: (state: FormState) => Promise<void>;
}) {
  const [state, setState] = useState<FormState>(props.initialState);
  const [submitting, setSubmitting] = useState(false);
  const options = useMemo(
    () => getGlassControlResponsibleOptions(props.users),
    [props.users]
  );

  useEffect(() => {
    if (!props.open) return;
    setState(props.initialState);
  }, [props.initialState, props.open]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-1rem)] rounded-[24px] border-0 p-0 sm:max-w-[560px]">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-7 py-5">
          <DialogTitle className="text-[22px] font-semibold tracking-[-0.03em] text-black">
            {props.title}
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
              value={state.title}
              onChange={(event) =>
                setState((prev) => ({ ...prev, title: event.target.value }))
              }
              className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Дата начала</Label>
            <Input
              type="date"
              value={state.dateFrom}
              onChange={(event) =>
                setState((prev) => ({ ...prev, dateFrom: event.target.value }))
              }
              className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Частота контроля</Label>
            <Input
              value={state.controlFrequency}
              onChange={(event) =>
                setState((prev) => ({
                  ...prev,
                  controlFrequency: event.target.value,
                }))
              }
              className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Должность ответственного</Label>
            <Select
              value={state.responsibleTitle}
              onValueChange={(value) =>
                setState((prev) => ({ ...prev, responsibleTitle: value, responsibleUserId: "" }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dfe1ec] bg-[#f3f4fb] px-3.5 text-[13.5px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                {options.titles.map((title) => (
                  <SelectItem key={title} value={title}>
                    {title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Сотрудник</Label>
            <Select
              value={state.responsibleUserId}
              onValueChange={(value) =>
                setState((prev) => ({ ...prev, responsibleUserId: value }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dfe1ec] bg-[#f3f4fb] px-3.5 text-[13.5px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                {(state.responsibleTitle
                  ? getUsersForRoleLabel(props.users, state.responsibleTitle, {
                      keepUserId: state.responsibleUserId,
                    })
                  : props.users
                ).map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-1">
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
              className="h-9 rounded-xl bg-[#5863f8] px-3.5 text-[13.5px] font-medium text-white hover:bg-[#4b57f3]"
            >
              {submitting ? "Сохранение..." : props.submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GlassControlDocumentsClient(props: Props) {
  const router = useRouter();
  const routeCode = props.routeCode || props.templateCode;
  const [creating, setCreating] = useState(false);
  const [editingDocument, setEditingDocument] = useState<DocumentItem | null>(null);
  const defaultState = useMemo(() => buildDefaultState(props.users), [props.users]);

  async function createDocument(state: FormState) {
    const config = {
      ...getDefaultGlassControlConfig(),
      documentName: state.title.trim() || GLASS_CONTROL_DOCUMENT_TITLE,
      controlFrequency:
        state.controlFrequency.trim() || GLASS_CONTROL_DEFAULT_FREQUENCY,
    };

    const response = await fetch("/api/journal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateCode: props.templateCode,
        title: config.documentName,
        dateFrom: state.dateFrom,
        dateTo: state.dateFrom,
        responsibleTitle: state.responsibleTitle || null,
        responsibleUserId: state.responsibleUserId || null,
        config,
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось создать документ");
      throw new Error("create_failed");
    }

    router.refresh();
  }

  async function saveSettings(state: FormState) {
    if (!editingDocument) return;

    const response = await fetch(`/api/journal-documents/${editingDocument.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: state.title.trim() || GLASS_CONTROL_DOCUMENT_TITLE,
        dateFrom: state.dateFrom,
        responsibleTitle: state.responsibleTitle || null,
        responsibleUserId: state.responsibleUserId || null,
        config: {
          ...normalizeGlassControlConfig(editingDocument.config),
          documentName: state.title.trim() || GLASS_CONTROL_DOCUMENT_TITLE,
          controlFrequency:
            state.controlFrequency.trim() || GLASS_CONTROL_DEFAULT_FREQUENCY,
        },
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось сохранить настройки документа");
      throw new Error("save_failed");
    }

    setEditingDocument(null);
    router.refresh();
  }

  async function handleDelete(documentId: string, title: string) {
    if (!(await confirmAsync({ title: "Удалить документ?", description: `Документ «${title}» и все его записи будут удалены безвозвратно.`, variant: "danger", confirmLabel: "Удалить" }))) return;

    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      toast.error("Не удалось удалить документ");
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={JOURNAL_LIST_HEADING_CLASS}>
          {GLASS_CONTROL_PAGE_TITLE}
        </h1>
        <div className={JOURNAL_LIST_ACTIONS_CLASS}>
          <Button
            variant="outline"
            className="h-10 w-full rounded-lg border-0 bg-[#5566f6]/[0.04] px-4 text-[14px] font-semibold text-[#5566f6] shadow-none hover:bg-[#5566f6]/[0.09] sm:w-auto"
            asChild
          >
            <Link href="/sanpin">
              <BookOpenText className="size-4" />
              Инструкция
            </Link>
          </Button>
          {props.activeTab === "active" && (
            <Button
              type="button"
              onClick={() => setCreating(true)}
              className="h-12 w-full rounded-xl bg-[#5566f6] px-5 text-[14px] font-medium text-white hover:bg-[#4a5bf0] sm:w-auto"
            >
              <Plus className="size-4" />
              Создать документ
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-[#d9dce8]">
        <div className="flex gap-9 text-[15px]">
          <Link
            href={`/journals/${routeCode}`}
            className={`relative pb-4 ${
              props.activeTab === "active"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#5566f6]"
                : "text-[#6f7282]"
            }`}
          >
            Активные
          </Link>
          <Link
            href={`/journals/${routeCode}?tab=closed`}
            className={`relative pb-4 ${
              props.activeTab === "closed"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#5566f6]"
                : "text-[#6f7282]"
            }`}
          >
            Закрытые
          </Link>
        </div>
      </div>

      <div className={JOURNAL_LIST_CARDS_CLASS}>
        {props.documents.length === 0 && (
          <EmptyDocumentsState />
        )}

        {props.documents.map((document) => {
          const href = `/journals/${routeCode}/documents/${document.id}`;
          const config = normalizeGlassControlConfig(document.config);
          const responsibleName = document.responsibleUserId
            ? props.users.find((user) => user.id === document.responsibleUserId)?.name || ""
            : "";

          return (
            <div
              key={document.id}
              className={JOURNAL_LIST_CARD_CLASS}
            >
              <Link href={href} className={JOURNAL_CARD_TITLE_CLASS}>
                {config.documentName || document.title || props.templateName}
              </Link>

              <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                <div className={JOURNAL_CARD_LABEL_CLASS}>Ответственный</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {document.responsibleTitle
                    ? `${document.responsibleTitle}${responsibleName ? `: ${responsibleName}` : ""}`
                    : "—"}
                </div>
              </Link>

              <Link href={href} className={JOURNAL_CARD_SECTION_CLASS}>
                <div className={JOURNAL_CARD_LABEL_CLASS}>Дата начала</div>
                <div className={JOURNAL_CARD_VALUE_CLASS}>
                  {formatRuDateDash(document.dateFrom)}
                </div>
              </Link>

              <div className="flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full text-[#5566f6] hover:bg-[#f5f6ff]"
                    >
                      <Ellipsis className="size-6" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[240px] rounded-[24px] border-0 p-3 shadow-xl"
                  >
                    {document.status === "active" && (
                      <DropdownMenuItem
                        className="mb-1 h-9 rounded-xl px-3.5 text-[13.5px]"
                        onSelect={() => setEditingDocument(document)}
                      >
                        <Pencil className="mr-3 size-5 text-[#6f7282]" />
                        Настройки
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="mb-1 h-9 rounded-xl px-3.5 text-[13.5px]"
                      onSelect={() =>
                        window.open(`/api/journal-documents/${document.id}/pdf`, "_blank")
                      }
                    >
                      <Printer className="mr-3 size-5 text-[#6f7282]" />
                      Печать
                    </DropdownMenuItem>
                    {document.status === "active" && (
                      <DropdownMenuItem
                        className="h-9 rounded-xl px-3.5 text-[13.5px] text-[#ff3b30] focus:text-[#ff3b30]"
                        onSelect={() =>
                          handleDelete(
                            document.id,
                            config.documentName || document.title || props.templateName
                          )
                        }
                      >
                        <Trash2 className="mr-3 size-5 text-[#ff3b30]" />
                        Удалить
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <GlassControlFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Создание документа"
        users={props.users}
        initialState={defaultState}
        submitLabel="Создать"
        onSubmit={createDocument}
      />

      <GlassControlFormDialog
        open={!!editingDocument}
        onOpenChange={(open) => !open && setEditingDocument(null)}
        title="Настройки документа"
        users={props.users}
        initialState={
          editingDocument
            ? {
                title:
                  normalizeGlassControlConfig(editingDocument.config).documentName ||
                  editingDocument.title ||
                  GLASS_CONTROL_DOCUMENT_TITLE,
                dateFrom: editingDocument.dateFrom,
                controlFrequency:
                  normalizeGlassControlConfig(editingDocument.config).controlFrequency,
                responsibleTitle: editingDocument.responsibleTitle || "Управляющий",
                responsibleUserId:
                  editingDocument.responsibleUserId || defaultState.responsibleUserId,
              }
            : defaultState
        }
        submitLabel="Сохранить"
        onSubmit={saveSettings}
      />
    </div>
  );
}
