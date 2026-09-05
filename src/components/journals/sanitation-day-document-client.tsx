"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Pencil,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildStaffOptionLabel } from "@/lib/journal-staff-binding";
import {
  getDistinctRoleLabels,
  getUsersForRoleLabel,
} from "@/lib/user-roles";
import {
  SANITATION_MONTHS,
  applyRoomDirectoryToSanitationConfig,
  createEmptySanitationRow,
  getSanitationApproveLabel,
  listSanitationRoomsNotInDocument,
  normalizeSanitationDayConfig,
  suggestDirectoryRoomForSanitationRow,
  type SanitationDayConfig,
  type SanitationMonthKey,
  type SanitationRoomRow,
} from "@/lib/sanitation-day-document";
import {
  RoomEditorDialog,
  type RoomEditorInitial,
} from "@/components/cleaning/room-editor-dialog";
import { RoomDirectoryPickerDialog } from "@/components/cleaning/room-directory-picker-dialog";
import { directoryRoomToEditorInitial } from "@/components/cleaning/room-editor-initial";
import type { DirectoryBuilding, DirectoryRoom } from "@/lib/room-directory";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_BODY_STACK_CLASS,
  DOC_TITLE_ROW_NO_STRIP_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_HEADING_CLASS,
  DOC_PAPER_CANVAS_CLASS,
  DOC_PAPER_HEADER_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  MobileViewToggle,
  MobileViewTableWrapper,
} from "@/components/journals/mobile-view-toggle";
import {
  RecordCardsView,
  type RecordCardItem,
} from "@/components/journals/record-cards-view";

import { toast } from "sonner";
import { confirmAsync } from "@/components/ui/confirm-async";
import {
  PositionSelectItems,
  usePositionEmployeeCascade,
} from "@/components/shared/position-select";
import {
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_SERVICE_LABEL_CLASS,
  GRID_VIEWPORT_CLASS,
} from "@/components/journals/journal-grid";
import { JournalPaperHeaderRows } from "@/components/journals/journal-document-header";
import { localDayKey } from "@/lib/entry-defaults";

/**
 * Screen ↔ print duality tokens (тот же приём, что в
 * `cleaning-document-client.tsx` / `hygiene-document-client.tsx`).
 */

type UserItem = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  /**
   * «Периодичность контроля» — вторая строка бумажной шапки документа
   * (`config.controlPeriodicity`, дефолт — из реестра шаблонов).
   * Пустая строка ⇒ строка в шапке не рендерится.
   */
  controlPeriodicity?: string;
  status: string;
  users: UserItem[];
  /**
   * 2026-09-04: единый справочник помещений (/settings/buildings).
   * Строки с `roomId` берут название из него; карточка помещения
   * открывается прямо из журнала.
   */
  buildings?: DirectoryBuilding[];
  config: unknown;
  /** Design v2 toggle. */
  useV2?: boolean;
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

type RoomDialogState = {
  id: string | null;
  name: string;
  plan: Record<SanitationMonthKey, string>;
};

const MONTH_FIELD_LABELS: Record<SanitationMonthKey, string> = {
  jan: "Январь",
  feb: "Февраль",
  mar: "Март",
  apr: "Апрель",
  may: "Май",
  jun: "Июнь",
  jul: "Июль",
  aug: "Август",
  sep: "Сентябрь",
  oct: "Октябрь",
  nov: "Ноябрь",
  dec: "Декабрь",
};

function roleOptionsFromUsers(users: UserItem[]) {
  return getDistinctRoleLabels(users);
}

function usersForRole(users: UserItem[], roleLabel: string) {
  return getUsersForRoleLabel(users, roleLabel);
}

function toIsoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return localDayKey();
  return date.toISOString().slice(0, 10);
}

function toViewDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  if (!year || !month || !day) return dateKey;
  // `toLocaleDateString({ month: "long" })` без дня даёт именительный
  // падеж («январь»), а бланк требует родительный («января»). Просим
  // локаль отформатировать дату целиком с днём — тогда падеж верный —
  // и забираем из результата только название месяца.
  const monthName = new Date(`${year}-${month}-${day}T00:00:00`)
    .toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    .replace(/^\d+\s+/, "");
  return `« ${day} » ${monthName} ${year} г.`;
}

function displayMonthValue(value: string) {
  return value.trim() || "-";
}

function RoomDialog(props: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  submitText: string;
  initial: RoomDialogState;
  includePlanFields: boolean;
  /** Помещения справочника, с которыми можно связать legacy-строку. */
  linkOptions?: Array<{ id: string; name: string }>;
  onSubmit: (value: RoomDialogState, linkRoomId?: string | null) => Promise<void>;
}) {
  const [state, setState] = useState<RoomDialogState>(props.initial);
  const [linkRoomId, setLinkRoomId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(value) => {
        if (value) {
          setState(props.initial);
          setLinkRoomId("");
        }
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

        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">
              Название помещения
            </Label>
            <Input
              value={state.name}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Введите название помещения"
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>

          {props.initial.id && (props.linkOptions?.length ?? 0) > 0 ? (
            <div className="space-y-2 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-3">
              <Label className="text-[13px] font-medium text-[#3c4053]">
                Связать с помещением из справочника
              </Label>
              <select
                value={linkRoomId}
                onChange={(event) => setLinkRoomId(event.target.value)}
                className="h-10 w-full rounded-2xl border border-[#dcdfed] bg-white px-3.5 text-[13.5px] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
              >
                <option value="">— не связывать —</option>
                {props.linkOptions?.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <p className="text-[11.5px] leading-[1.5] text-[#6f7282]">
                После связи название и ответственные берутся из карточки помещения («Настройки → Помещения»); план по месяцам сохраняется.
              </p>
            </div>
          ) : null}

          {props.includePlanFields ? (
            <>
              {SANITATION_MONTHS.map((month) => (
                <div key={month.key} className="space-y-2">
                  <Label className="text-[13px] font-medium text-[#3c4053]">
                    {MONTH_FIELD_LABELS[month.key]}
                  </Label>
                  <Select
                    value={state.plan[month.key] || "__empty__"}
                    onValueChange={(value) =>
                      setState((current) => ({
                        ...current,
                        plan: {
                          ...current.plan,
                          [month.key]: value === "__empty__" ? "" : value,
                        },
                      }))
                    }
                  >
                    <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                      <SelectValue placeholder="--" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__empty__">--</SelectItem>
                      {Array.from({ length: 31 }).map((_, index) => {
                        const value = String(index + 1).padStart(2, "0");
                        return (
                          <SelectItem key={value} value={value}>
                            {value}
                          </SelectItem>
                        );
                      })}
                      <SelectItem value="-">-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </>
          ) : null}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={submitting}
              onClick={async () => {
                if (!state.name.trim()) {
                  toast.error("Введите название помещения");
                  return;
                }
                setSubmitting(true);
                try {
                  await props.onSubmit({ ...state, name: state.name.trim() }, linkRoomId || null);
                  props.onOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
            >
              {submitting ? "Сохранение..." : props.submitText}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DocumentSettingsDialog(props: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  users: UserItem[];
  initial: SettingsState;
  onSubmit: (value: SettingsState) => Promise<void>;
  useV2?: boolean;
}) {
  const [state, setState] = useState<SettingsState>(props.initial);
  const [submitting, setSubmitting] = useState(false);
  const roles = useMemo(() => roleOptionsFromUsers(props.users), [props.users]);
  const resolveRoleCandidates = (roleLabel: string) =>
    usersForRole(props.users, roleLabel);

  const approveCascade = usePositionEmployeeCascade({
    users: props.users,
    positionTitle: state.approveRole,
    userId: state.approveEmployeeId,
    onChange: (next) =>
      setState((current) => {
        const user = props.users.find((item) => item.id === next.userId);
        return {
          ...current,
          approveRole: next.positionTitle,
          approveEmployeeId: next.userId,
          approveEmployee: user
            ? user.name
            : next.positionTitle !== current.approveRole
              ? current.approveEmployee
              : "",
        };
      }),
    resolveCandidates: resolveRoleCandidates,
    autoPick: "first",
  });

  const responsibleCascade = usePositionEmployeeCascade({
    users: props.users,
    positionTitle: state.responsibleRole,
    userId: state.responsibleEmployeeId,
    onChange: (next) =>
      setState((current) => {
        const user = props.users.find((item) => item.id === next.userId);
        return {
          ...current,
          responsibleRole: next.positionTitle,
          responsibleEmployeeId: next.userId,
          responsibleEmployee: user
            ? user.name
            : next.positionTitle !== current.responsibleRole
              ? current.responsibleEmployee
              : "",
        };
      }),
    resolveCandidates: resolveRoleCandidates,
    autoPick: "first",
  });

  async function handleSave() {
    setSubmitting(true);
    try {
      await props.onSubmit(state);
      props.onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (props.useV2) {
    return (
      <JournalSettingsModal
        open={props.open}
        onOpenChange={(value) => {
          if (value) setState(props.initial);
          props.onOpenChange(value);
        }}
        title="Настройки журнала"
        description="Название журнала, дата, год и две роли: утверждающий и ответственный."
        size="md"
        isSaving={submitting}
        onSave={handleSave}
        onCancel={() => props.onOpenChange(false)}
      >
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Название документа
          </Label>
          <Input
            value={state.title}
            onChange={(event) =>
              setState((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Название документа"
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Дата документа
            </Label>
            <Input
              type="date"
              value={state.documentDate}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  documentDate: toIsoDate(event.target.value),
                }))
              }
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Год
            </Label>
            <Select
              value={state.year}
              onValueChange={(value) =>
                setState((current) => ({ ...current, year: value }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
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
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            {/* G6: у эталона кавычки прямые, не «ёлочки». */}
            Должность &quot;Утверждаю&quot;
          </Label>
          <Select
            value={state.approveRole}
            onValueChange={approveCascade.handlePositionChange}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              <PositionSelectItems users={props.users} />
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Сотрудник (утверждает)
          </Label>
          <Select
            value={state.approveEmployeeId || "__empty__"}
            onValueChange={approveCascade.handleEmployeeChange}
            open={approveCascade.employeeOpen}
            onOpenChange={approveCascade.setEmployeeOpen}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">— не выбран —</SelectItem>
              {approveCascade.candidates.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {buildStaffOptionLabel(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Должность ответственного
          </Label>
          <Select
            value={state.responsibleRole}
            onValueChange={responsibleCascade.handlePositionChange}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              <PositionSelectItems users={props.users} />
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Сотрудник (ответственный)
          </Label>
          <Select
            value={state.responsibleEmployeeId || "__empty__"}
            onValueChange={responsibleCascade.handleEmployeeChange}
            open={responsibleCascade.employeeOpen}
            onOpenChange={responsibleCascade.setEmployeeOpen}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">— не выбран —</SelectItem>
              {responsibleCascade.candidates.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {buildStaffOptionLabel(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </JournalSettingsModal>
    );
  }

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
              Настройки журнала
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-6 py-5">
          <Input
            value={state.title}
            onChange={(event) =>
              setState((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Название документа"
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
          />

          <div className="relative">
            <Input
              type="date"
              value={state.documentDate}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  documentDate: toIsoDate(event.target.value),
                }))
              }
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 pr-14 text-[13.5px]"
            />
            <CalendarDays className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-[#6f7282]" />
          </div>

          <Select
            value={state.year}
            onValueChange={(value) =>
              setState((current) => ({ ...current, year: value }))
            }
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
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

          <Select
            value={state.approveRole}
            onValueChange={approveCascade.handlePositionChange}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
              <SelectValue placeholder='Должность "Утверждаю"' />
            </SelectTrigger>
            <SelectContent>
              <PositionSelectItems users={props.users} />
            </SelectContent>
          </Select>

          <Select
            value={state.approveEmployeeId || "__empty__"}
            onValueChange={approveCascade.handleEmployeeChange}
            open={approveCascade.employeeOpen}
            onOpenChange={approveCascade.setEmployeeOpen}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
              <SelectValue placeholder="Сотрудник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">- Выберите значение -</SelectItem>
              {approveCascade.candidates.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {buildStaffOptionLabel(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={state.responsibleRole}
            onValueChange={responsibleCascade.handlePositionChange}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
              <SelectValue placeholder="Должность ответственного" />
            </SelectTrigger>
            <SelectContent>
              <PositionSelectItems users={props.users} />
            </SelectContent>
          </Select>

          <Select
            value={state.responsibleEmployeeId || "__empty__"}
            onValueChange={responsibleCascade.handleEmployeeChange}
            open={responsibleCascade.employeeOpen}
            onOpenChange={responsibleCascade.setEmployeeOpen}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
              <SelectValue placeholder="Сотрудник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">- Выберите значение -</SelectItem>
              {responsibleCascade.candidates.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {buildStaffOptionLabel(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
            >
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SanitationDayDocumentClient({
  documentId,
  title,
  organizationName,
  controlPeriodicity = "",
  status,
  users,
  buildings = [],
  config,
  useV2 = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [roomDialogState, setRoomDialogState] = useState<RoomDialogState>({
    id: null,
    name: "",
    plan: {
      jan: "-",
      feb: "-",
      mar: "-",
      apr: "-",
      may: "-",
      jun: "-",
      jul: "-",
      aug: "-",
      sep: "-",
      oct: "-",
      nov: "-",
      dec: "-",
    },
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [roomEditor, setRoomEditor] = useState<RoomEditorInitial | null>(null);
  // Справочник помещений: название строк с roomId — из Room.
  const directoryRooms = useMemo(
    () => buildings.flatMap((b) => b.rooms),
    [buildings],
  );
  const normalized = applyRoomDirectoryToSanitationConfig(
    normalizeSanitationDayConfig(config),
    directoryRooms,
  );
  const userNameById = useMemo(
    () => new Map(users.map((u) => [u.id, u.name])),
    [users],
  );
  const readOnly = status === "closed";
  const { mobileView, switchMobileView } = useMobileView("general_cleaning");

  const allSelected =
    normalized.rows.length > 0 &&
    selectedRowIds.length === normalized.rows.length;
  const selectedRows = normalized.rows.filter((row) =>
    selectedRowIds.includes(row.id),
  );
  const journalHref = pathname
    ? pathname.split("/documents/")[0]
    : "/journals/general_cleaning";

  const settingsState: SettingsState = {
    title,
    documentDate: normalized.documentDate,
    year: String(normalized.year),
    approveRole: normalized.approveRole,
    approveEmployeeId: normalized.approveEmployeeId || "",
    approveEmployee: normalized.approveEmployee,
    responsibleRole: normalized.responsibleRole,
    responsibleEmployeeId: normalized.responsibleEmployeeId || "",
    responsibleEmployee: normalized.responsibleEmployee,
  };

  async function patchConfig(
    nextConfig: SanitationDayConfig,
    nextTitle = title,
  ) {
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: nextTitle,
        dateFrom: nextConfig.documentDate,
        dateTo: nextConfig.documentDate,
        responsibleTitle: nextConfig.responsibleRole,
        config: nextConfig,
      }),
    });

    if (!response.ok) {
      toast.error("Не удалось сохранить документ");
      return;
    }

    setSelectedRowIds([]);
    router.refresh();
  }

  async function saveMonthValue(
    rowId: string,
    month: SanitationMonthKey,
    value: string,
    mode: "plan" | "fact",
  ) {
    const nextRows = normalized.rows.map((row) => {
      if (row.id !== rowId) return row;
      return {
        ...row,
        [mode]: {
          ...row[mode],
          [month]: value,
        },
      };
    });
    await patchConfig({ ...normalized, rows: nextRows });
  }

  /** Кто убирает / проверяет помещение строки — из справочника. */
  function roomPeople(row: SanitationRoomRow): { cleaners: string[]; verifiers: string[] } {
    const dbRoom = row.roomId ? directoryRooms.find((r) => r.id === row.roomId) : undefined;
    if (!dbRoom) return { cleaners: [], verifiers: [] };
    const nameOf = (id: string) => userNameById.get(id) ?? "—";
    return {
      cleaners: dbRoom.cleanerUserIds.map(nameOf),
      verifiers: dbRoom.verifierUserIds.map(nameOf),
    };
  }

  /** Клик по помещению: со связью — карточка помещения, без — legacy-диалог. */
  function openRowEditor(row: SanitationRoomRow) {
    const dbRoom = row.roomId ? directoryRooms.find((r) => r.id === row.roomId) : undefined;
    if (dbRoom) {
      setRoomEditor(directoryRoomToEditorInitial(dbRoom));
      return;
    }
    setRoomDialogState({ id: row.id, name: row.roomName, plan: { ...row.plan } });
    setRoomDialogOpen(true);
  }

  /** Помещение из справочника → строка графика (id стабильный `row-room-<Room.id>`). */
  async function addRoomFromDirectory(room: DirectoryRoom) {
    if (normalized.rows.some((r) => r.roomId === room.id)) {
      toast.error("Это помещение уже есть в графике");
      return;
    }
    await patchConfig({
      ...normalized,
      rows: [...normalized.rows, createEmptySanitationRow(room.name, room.id)],
    });
  }

  /** «Связать» legacy-строку с помещением: id строки не меняем (линки TF живы). */
  async function linkRow(rowId: string, room: { id: string; name: string }) {
    await patchConfig({
      ...normalized,
      rows: normalized.rows.map((r) =>
        r.id === rowId ? { ...r, roomId: room.id, roomName: room.name } : r,
      ),
    });
  }

  async function saveRoomDialog(value: RoomDialogState, linkRoomId?: string | null) {
    if (value.id && linkRoomId) {
      const room = directoryRooms.find((r) => r.id === linkRoomId);
      if (room) {
        await linkRow(value.id, room);
        return;
      }
    }
    if (!value.id) {
      const nextRow = createEmptySanitationRow(value.name);
      nextRow.plan = value.plan;
      await patchConfig({
        ...normalized,
        rows: [...normalized.rows, nextRow],
      });
      return;
    }

    await patchConfig({
      ...normalized,
      rows: normalized.rows.map((row) =>
        row.id === value.id ? { ...row, roomName: value.name } : row,
      ),
    });
  }

  async function deleteSelectedRows() {
    const count = selectedRowIds.length;
    const confirmed = await confirmAsync({
      title: count > 1 ? `Удалить ${count} строк?` : "Удалить строку?",
      description: "Строки помещений и их отметки по месяцам будут удалены безвозвратно.",
      variant: "danger",
      confirmLabel: "Удалить",
    });
    if (!confirmed) return;

    const rowIdSet = new Set(selectedRowIds);
    await patchConfig({
      ...normalized,
      rows: normalized.rows.filter((row) => !rowIdSet.has(row.id)),
    });
  }

  return (
    <div className="space-y-5">
      <FocusTodayScroller selector="[data-focus-today]" emptyTitle="Записей пока нет" emptyBody="Нажмите «Добавить» в таблице ниже, чтобы создать запись." />
      <DocumentActionsBar
        className={DOC_TITLE_ROW_NO_STRIP_CLASS}
        backHref={journalHref}
        documentId={documentId}
        heading={<h1 className={DOC_HEADING_CLASS}>{title}</h1>}
        onSettings={!readOnly ? () => setSettingsOpen(true) : undefined}
      />

      {readOnly ? (
        <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать план и факт уборок." />
      ) : null}

      {/* R1: бумажное полотно — во всю ширину контентной колонки. */}
      {/* P8: карточки-обёртки вокруг бланка больше НЕТ (как у чек-листа
          вентиляции в P5). `rounded-[18px] border p-8 overflow-hidden`
          съедал 2×32px паддинга и клипал содержимое: полотно сжималось
          до ~1083px вместо 1150, и правая рамка служебной строки уходила
          под клип. Бланк лежит прямо на фоне страницы. */}
        <div className="mb-4 sm:hidden print:hidden">
          <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
        </div>

      <section className={`${DOC_BODY_STACK_CLASS} ${DOC_PAPER_CANVAS_CLASS}`}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 lg:overflow-visible sm:px-0">
        <table className="w-full min-w-[560px] border-collapse text-[13px] sm:min-w-0">
          <tbody>
            <JournalPaperHeaderRows
              orgName={organizationName}
              title="ГРАФИК И УЧЕТ ГЕНЕРАЛЬНЫХ УБОРОК"
              startedAt={normalized.documentDate}
              finishedAt={readOnly ? normalized.documentDate : null}
              controlPeriodicity={controlPeriodicity}
              orgCellClass="w-[18%]"
              sideCellClass="w-[22%]"
            />
          </tbody>
        </table>
        </div>

        <div className={`${DOC_PAPER_HEADER_CLASS} flex justify-end`}>
          <div className="w-full max-w-[320px] pr-2 text-right text-[13px] leading-snug">
            <div className="font-semibold">УТВЕРЖДАЮ</div>
            <div>{normalized.approveRole}</div>
            {/* G2: линия подписи и ФИО стоят В ОДНУ строку
                («_________ Борисов Борис Борисович»), как на эталоне
                (general_cleaning-2-doc.png). Раньше подчёркнутым был сам
                текст ФИО, а места под подпись не оставалось вовсе. */}
            <div className="flex items-end justify-end gap-2 pt-1">
              <span aria-hidden className="h-[1em] w-[150px] border-b border-black" />
              <span>{normalized.approveEmployee}</span>
            </div>
            <div className="pt-1">
              {toViewDateLabel(normalized.documentDate)}
            </div>
          </div>
        </div>

        <h2 className={`${DOC_CAPS_TITLE_CLASS} text-center text-[15px] font-bold`}>
          График и учет генеральных уборок на предприятии в {normalized.year} г.
        </h2>

        {!readOnly ? (
          <>
          <div className={`${DOC_ADD_ROW_CLASS} justify-between`}>
            <Button
              type="button"
              onClick={() => {
                setPickerOpen(true);
              }}
              className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white hover:bg-[#4a5bf0]"
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Добавить помещение
            </Button>

          </div>

          <JournalSelectionBar
            count={selectedRowIds.length}
            onClear={() => setSelectedRowIds([])}
            onDelete={() => {
              deleteSelectedRows().catch((error) =>
                toast.error(error instanceof Error ? error.message : "Не удалось удалить строки")
              );
            }}
            hint="Помещения будут удалены вместе с планом генеральных уборок"
          >
            <Button
              type="button"
              variant="outline"
              disabled={selectedRowIds.length !== 1}
              title="Выберите ровно одно помещение, чтобы изменить его план"
              onClick={() => {
                const target = selectedRows[0];
                if (!target) return;
                openRowEditor(target);
              }}
              className="h-10 gap-1.5 rounded-xl border-[#dcdfed] px-3.5 text-[14px] font-semibold text-[#5566f6] shadow-none transition-colors duration-150 hover:bg-[#f3f4fe] hover:text-[#5566f6]"
            >
              <Pencil className="size-4" />
              Редактировать
            </Button>
          </JournalSelectionBar>
          </>
        ) : null}

        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">

          {mobileView === "cards" ? (
            <RecordCardsView
              items={normalized.rows.map((row, index) => {
                const planSummary = SANITATION_MONTHS.map((m) => {
                  const v = row.plan[m.key];
                  return v ? `${MONTH_FIELD_LABELS[m.key]}:${v}` : null;
                }).filter(Boolean).join(" · ");
                const factSummary = SANITATION_MONTHS.map((m) => {
                  const v = row.fact[m.key];
                  return v ? `${MONTH_FIELD_LABELS[m.key]}:${v}` : null;
                }).filter(Boolean).join(" · ");
                return {
                  id: row.id,
                  title: `№${index + 1} · ${row.roomName || "—"}`,
                  leading: !readOnly ? (
                    <Checkbox
                      checked={selectedRowIds.includes(row.id)}
                      onCheckedChange={(checked) =>
                        setSelectedRowIds((current) =>
                          checked
                            ? [...new Set([...current, row.id])]
                            : current.filter((id) => id !== row.id),
                        )
                      }
                      className="size-5"
                    />
                  ) : null,
                  fields: [
                    { label: "Убирает", value: roomPeople(row).cleaners.join(", "), hideIfEmpty: true },
                    { label: "Проверяет", value: roomPeople(row).verifiers.join(", "), hideIfEmpty: true },
                    { label: "План по месяцам", value: planSummary, hideIfEmpty: true },
                    { label: "Факт по месяцам", value: factSummary, hideIfEmpty: true },
                  ],
                };
              })}
              emptyLabel="Помещений пока не внесено."
            />
          ) : null}

          <MobileViewTableWrapper mobileView={mobileView} className={GRID_VIEWPORT_CLASS}>
          <table className={`min-w-full border-collapse ${GRID_CELL_CLASS} bg-white text-[13px] leading-tight`}>
            <thead>
              <tr>
                <th
                  rowSpan={2}
                  className={`${GRID_HEAD_CELL_CLASS} w-[54px] px-2 py-1.5 leading-tight print:hidden`}
                >
                  {!readOnly ? (
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          setSelectedRowIds(
                            checked ? normalized.rows.map((row) => row.id) : [],
                          )
                        }
                      />
                    </div>
                  ) : null}
                </th>
                <th
                  rowSpan={2}
                  className={`${GRID_HEAD_CELL_CLASS} w-[240px] px-3 py-1.5 leading-tight`}
                >
                  Помещение
                </th>
                <th
                  rowSpan={2}
                  className={`${GRID_HEAD_CELL_CLASS} w-[90px] px-2 py-1.5 leading-tight`}
                >
                  Вид
                </th>
                <th colSpan={12} className={`${GRID_HEAD_CELL_CLASS} px-3 py-1.5 leading-tight`}>
                  График
                </th>
              </tr>
              <tr>
                {SANITATION_MONTHS.map((month) => (
                  <th
                    key={month.key}
                    className={`${GRID_HEAD_CELL_CLASS} w-[60px] px-1 py-1.5 leading-tight`}
                  >
                    {month.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalized.rows.map((row) => (
                <Fragment key={row.id}>
                  <tr>
                    <td
                      rowSpan={2}
                      className={`${GRID_CELL_CLASS} px-2 py-1 align-middle leading-tight print:hidden`}
                    >
                      {!readOnly ? (
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={selectedRowIds.includes(row.id)}
                            onCheckedChange={(checked) =>
                              setSelectedRowIds((current) =>
                                checked
                                  ? [...new Set([...current, row.id])]
                                  : current.filter((id) => id !== row.id),
                              )
                            }
                          />
                        </div>
                      ) : null}
                    </td>
                    <td
                      rowSpan={2}
                      className={`${GRID_CELL_CLASS} px-3 py-1 text-center align-middle ${readOnly ? "" : "cursor-pointer hover:bg-[#f5f6ff]"} leading-tight`}
                      onClick={() => {
                        if (readOnly) return;
                        openRowEditor(row);
                      }}
                    >
                      <div>{row.roomName}</div>
                      {/* Кто убирает / проверяет — из карточки помещения. */}
                      {roomPeople(row).cleaners.length > 0 ? (
                        <div className="text-[11px] font-normal text-[#3848c7] print:hidden">
                          Убирает: {roomPeople(row).cleaners.join(", ")}
                        </div>
                      ) : null}
                      {roomPeople(row).verifiers.length > 0 ? (
                        <div className="text-[11px] font-normal text-[#3848c7] print:hidden">
                          Проверяет: {roomPeople(row).verifiers.join(", ")}
                        </div>
                      ) : null}
                      {!readOnly && !row.roomId && suggestDirectoryRoomForSanitationRow(row, directoryRooms) ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const match = suggestDirectoryRoomForSanitationRow(row, directoryRooms);
                            if (match) void linkRow(row.id, match);
                          }}
                          title="В справочнике есть помещение с таким же названием — связать, чтобы название и ответственные брались из карточки помещения"
                          className="mt-0.5 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] font-medium text-[#3848c7] transition-colors duration-150 hover:bg-[#eef1ff] print:hidden"
                        >
                          Связать
                        </button>
                      ) : null}
                    </td>
                    <td className={`${GRID_CELL_CLASS} px-3 py-1 text-center leading-tight`}>
                      План
                    </td>
                    {SANITATION_MONTHS.map((month) => (
                      <td
                        key={`${row.id}-plan-${month.key}`}
                        className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`}
                      >
                        {readOnly ? (
                          displayMonthValue(row.plan[month.key])
                        ) : (
                          <Input
                            defaultValue={row.plan[month.key] || ""}
                            aria-label={`${MONTH_FIELD_LABELS[month.key]} план`}
                            onBlur={(event) => {
                              const next = event.target.value;
                              if (next === (row.plan[month.key] || "")) return;
                              void saveMonthValue(
                                row.id,
                                month.key,
                                next,
                                "plan",
                              );
                            }}
                            className="h-7 rounded-lg border-0 bg-transparent px-1 text-center text-[13px]"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className={`${GRID_CELL_CLASS} px-3 py-1 text-center leading-tight`}>
                      Факт
                    </td>
                    {SANITATION_MONTHS.map((month) => (
                      <td
                        key={`${row.id}-fact-${month.key}`}
                        className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`}
                      >
                        {readOnly ? (
                          displayMonthValue(row.fact[month.key])
                        ) : (
                          <Input
                            defaultValue={row.fact[month.key] || ""}
                            aria-label={`${MONTH_FIELD_LABELS[month.key]} факт`}
                            onBlur={(event) => {
                              const next = event.target.value;
                              if (next === (row.fact[month.key] || "")) return;
                              void saveMonthValue(
                                row.id,
                                month.key,
                                next,
                                "fact",
                              );
                            }}
                            className="h-7 rounded-lg border-0 bg-transparent px-1 text-center text-[13px]"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
              <tr>
                {/* A5 аудита: раньше здесь стоял один `colSpan={3}`,
                    перекрывавший ещё и колонку чекбоксов. Колонка
                    чекбоксов `print:hidden` — на бумаге строка
                    «Ответственный» оказывалась на КОЛОНКУ ШИРЕ шапки, и
                    справа от таблицы печаталась пустая безымянная
                    полоса. Служебная ячейка теперь отдельная и тоже
                    `print:hidden`, а подпись занимает ровно
                    «Помещение» + «Вид». */}
                {/* R5-14: служебная строка «Ответственный: …» держит тот
                    же вертикальный ритм, что и строки данных.
                    У ячейки-заглушки не было НИ padding'а, ни
                    выравнивания, а у подписи стоял `py-1` против `py-2`
                    у данных — строка выходила ниже соседних, и подпись
                    прижималась к нижней рамке. */}
                <td className={`${GRID_CELL_CLASS} px-3 py-2 print:hidden`} />
                <td
                  colSpan={2}
                  className={`${GRID_CELL_CLASS} px-3 py-2 text-center align-middle leading-tight`}
                >
                  <span className={GRID_SERVICE_LABEL_CLASS}>
                    Ответственный:{" "}
                    {getSanitationApproveLabel(
                      normalized.responsibleRole,
                      normalized.responsibleEmployee,
                      ", ",
                    )}
                  </span>
                </td>
                {/* G1: на эталоне (general_cleaning-2-doc.png) служебная
                    строка «Ответственный: …» продолжается ДВЕНАДЦАТЬЮ
                    пустыми ячейками месяцев — сетка не рвётся, колонки
                    остаются на месте. Мы вместо них рисовали пояснение
                    «Отметки по месяцам указаны в таблице выше», которое
                    съедало 12 колонок в один colSpan. Ячейки намеренно
                    некликабельны: это подвал строки, а не данные. */}
                {SANITATION_MONTHS.map((month) => (
                  <td
                    key={`responsible-${month.key}`}
                    className={`${GRID_CELL_CLASS} px-3 py-2 leading-tight`}
                  />
                ))}
              </tr>
            </tbody>
          </table>
          </MobileViewTableWrapper>
        </div>
      </section>

      <RoomDialog
        open={roomDialogOpen}
        onOpenChange={setRoomDialogOpen}
        initial={roomDialogState}
        title={
          roomDialogState.id
            ? "Редактирование строки"
            : "Добавление новой строки"
        }
        submitText={roomDialogState.id ? "Сохранить" : "Создать"}
        includePlanFields={!roomDialogState.id}
        linkOptions={listSanitationRoomsNotInDocument(normalized, directoryRooms)}
        onSubmit={saveRoomDialog}
      />

      {/* Единый справочник помещений: добавить из /settings/buildings или
          создать новое — и сразу открыть его карточку. */}
      <RoomDirectoryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        buildings={buildings}
        excludeRoomIds={normalized.rows.map((r) => r.roomId).filter((id): id is string => Boolean(id))}
        hint="Помещения общие для всех журналов. Состав генеральной уборки, уборщики и проверяющие — в карточке помещения."
        onPick={addRoomFromDirectory}
        onCreated={async (room) => {
          await addRoomFromDirectory(room);
          setRoomEditor(directoryRoomToEditorInitial(room));
        }}
      />

      <RoomEditorDialog
        open={roomEditor !== null}
        onOpenChange={(open) => {
          if (!open) setRoomEditor(null);
        }}
        initial={roomEditor}
        focus="cleaning"
        users={users}
        onSaved={() => router.refresh()}
      />

      <DocumentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        users={users}
        initial={settingsState}
        onSubmit={async (value) => {
          const next = normalizeSanitationDayConfig({
            ...normalized,
            year: Number(value.year),
            documentDate: value.documentDate,
            approveRole: value.approveRole,
            approveEmployeeId: value.approveEmployeeId || null,
            approveEmployee: value.approveEmployee,
            responsibleRole: value.responsibleRole,
            responsibleEmployeeId: value.responsibleEmployeeId || null,
            responsibleEmployee: value.responsibleEmployee,
          });
          await patchConfig(next, value.title.trim() || title);
        }}
        useV2={useV2}
      />
    </div>
  );
}
