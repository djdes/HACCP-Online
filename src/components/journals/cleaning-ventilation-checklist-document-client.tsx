"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
import {
  CLEANING_VENTILATION_CHECKLIST_TITLE,
  buildChecklistDateKeys,
  getCleaningVentilationDescriptionLines,
  getCleaningVentilationPeriodicityLines,
  getMonthBoundsFromDate,
  normalizeCleaningVentilationConfig,
  normalizeCleaningVentilationEntryData,
  type CleaningVentilationChecklistConfig,
  type CleaningVentilationChecklistEntryData,
  type CleaningVentilationResponsible,
} from "@/lib/cleaning-ventilation-checklist-document";
import { toDateKey } from "@/lib/hygiene-document";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import {
  DOC_ADD_ROW_CLASS,
  DOC_HEADING_CLASS,
  JOURNAL_DIALOG_CONTENT_WIDE_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { JournalPaperHeaderRows } from "@/components/journals/journal-document-header";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { useCopyYesterdayAction } from "@/components/journals/copy-yesterday-button";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import { isManagementRole } from "@/lib/user-roles";
import { useMobileView } from "@/lib/use-mobile-view";
import {
  MobileViewToggle,
  MobileViewTableWrapper,
} from "@/components/journals/mobile-view-toggle";
import {
  RecordCardsView,
  type RecordCardItem,
} from "@/components/journals/record-cards-view";

/**
 * The Должность select for this journal is a hardcoded "Управляющий / Сотрудник"
 * bucket, so the Сотрудник list is filtered by that bucket rather than by a
 * concrete role label.
 */
function filterUsersByBucket<T extends { role?: string | null }>(
  users: T[],
  bucket: string
): T[] {
  if (bucket === "Управляющий") return users.filter((u) => isManagementRole(u.role));
  if (bucket === "Сотрудник") return users.filter((u) => !isManagementRole(u.role));
  return users;
}

import { toast } from "sonner";
import { PositionSelectItems } from "@/components/shared/position-select";
type UserItem = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  documentId: string;
  routeCode: string;
  title: string;
  organizationName: string;
  /**
   * «Периодичность контроля» — вторая строка бумажной шапки документа
   * (`config.controlPeriodicity`, дефолт — из реестра шаблонов).
   * Пустая строка ⇒ строка в шапке не рендерится.
   */
  controlPeriodicity?: string;
  status: string;
  dateFrom: string;
  users: UserItem[];
  config: CleaningVentilationChecklistConfig;
  initialEntries: { id: string; date: string; data: CleaningVentilationChecklistEntryData }[];
  /** Design v2 toggle. */
  useV2?: boolean;
};

type SettingsState = {
  title: string;
  dateFrom: string;
  ventilationEnabled: boolean;
  mainResponsibleTitle: string;
  mainResponsibleUserId: string;
};

type RowProcedure = {
  id: "disinfection" | "ventilation" | "wet_cleaning";
  label: string;
  times: string[];
  responsibleUserId: string;
};

const HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0")
);
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

/**
 * Кнопка-ячейка внутри таблицы («+ Добавить периодичность» /
 * «+ Добавить ответственного»). На эталоне это широкая синяя ячейка во всю
 * ширину своей колонки, а не мелкая ссылка сбоку — попасть по ней можно
 * не целясь. Наши токены: заливка #eef0ff, текст #5566f6.
 */
const CHECKLIST_ADD_CELL_CLASS =
  "flex w-full items-center justify-center gap-2 border-t border-[#333] bg-[#eef0ff] px-4 py-3 text-[15px] font-semibold text-[#5566f6] transition-colors duration-150 hover:bg-[#e2e6ff] print:hidden";

/**
 * Ячейка липкой шапки чек-листа. `border-collapse` не рисует границы у
 * sticky-ячеек (они «уезжают» вместе со скроллом), поэтому нижнюю линию
 * даём inset-тенью, а фон держим непрозрачным — иначе строки просвечивают.
 */
const CHECKLIST_STICKY_HEAD_CLASS =
  "sticky top-0 z-20 border-[#333] bg-[#f8f9fc] text-[15px] font-semibold leading-tight text-black shadow-[inset_0_-1px_0_#333] print:static print:bg-white print:shadow-none print:border-b print:border-black";

function formatRuDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("ru-RU");
}

function createId() {
  return typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      (json && typeof json.error === "string" && json.error) || "Операция не выполнена"
    );
  }
  return json;
}

function TimeSelect({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [hour = "00", minute = "00"] = value.split(":");

  return (
    <div className="flex items-center gap-2">
      <Select
        value={hour}
        onValueChange={(nextHour) => onChange(`${nextHour}:${minute}`)}
        disabled={disabled}
      >
        <SelectTrigger className="h-12 w-[106px] rounded-[18px] border-[#dcdfed] bg-white px-4 text-[16px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={minute}
        onValueChange={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
        disabled={disabled}
      >
        <SelectTrigger className="h-12 w-[106px] rounded-[18px] border-[#dcdfed] bg-white px-4 text-[16px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DocumentSettingsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserItem[];
  initial: SettingsState;
  onSubmit: (value: SettingsState) => Promise<void>;
  useV2?: boolean;
}) {
  const [state, setState] = useState<SettingsState>(props.initial);
  const [submitting, setSubmitting] = useState(false);

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
        onOpenChange={(nextOpen) => {
          if (nextOpen) setState(props.initial);
          props.onOpenChange(nextOpen);
        }}
        title="Настройки журнала"
        description="Название журнала, дата начала, режим проветривания и ответственный сотрудник."
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
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Дата начала
          </Label>
          <Input
            type="date"
            value={state.dateFrom}
            onChange={(event) =>
              setState((current) => ({ ...current, dateFrom: event.target.value }))
            }
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:bg-[#f5f6ff]">
          <Checkbox
            checked={state.ventilationEnabled}
            onCheckedChange={(checked) =>
              setState((current) => ({
                ...current,
                ventilationEnabled: checked === true,
              }))
            }
          />
          <div className="text-[14px] text-[#0b1024]">
            Проветривание
            <div className="mt-0.5 text-[12px] text-[#6f7282]">
              Включайте если помещение реально проветривается.
            </div>
          </div>
        </label>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Должность ответственного
          </Label>
          <Select
            value={state.mainResponsibleTitle}
            onValueChange={(value) =>
              setState((current) => {
                const candidates = filterUsersByBucket(props.users, value);
                const stillValid =
                  current.mainResponsibleUserId &&
                  candidates.some((u) => u.id === current.mainResponsibleUserId);
                return {
                  ...current,
                  mainResponsibleTitle: value,
                  mainResponsibleUserId: stillValid
                    ? current.mainResponsibleUserId
                    : candidates[0]?.id || "",
                };
              })
            }
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
            Сотрудник
          </Label>
          <Select
            value={state.mainResponsibleUserId}
            onValueChange={(value) =>
              setState((current) => ({ ...current, mainResponsibleUserId: value }))
            }
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              {filterUsersByBucket(props.users, state.mainResponsibleTitle).map(
                (user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </JournalSettingsModal>
    );
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setState(props.initial);
        }
        props.onOpenChange(nextOpen);
      }}
    >
      <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
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
              onChange={(event) => setState((current) => ({ ...current, title: event.target.value }))}
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Дата начала</Label>
            <div className="relative">
              <Input
                type="date"
                value={state.dateFrom}
                onChange={(event) =>
                  setState((current) => ({ ...current, dateFrom: event.target.value }))
                }
                className="h-9 rounded-xl border-[#dcdfed] px-6 pr-14 text-[13.5px]"
              />
              <CalendarDays className="pointer-events-none absolute right-5 top-1/2 size-6 -translate-y-1/2 text-[#6f7282]" />
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <Checkbox
                checked={state.ventilationEnabled}
                onCheckedChange={(checked) =>
                  setState((current) => ({ ...current, ventilationEnabled: checked === true }))
                }
                className="size-6 rounded-[10px]"
              />
              <span className="text-[15px] text-black">Проветривание</span>
            </label>
            <p className="text-[15px] text-black/70">
              Включайте, если помещение действительно проветривается. Без окон магия не сработает,
              даже если кожаные очень верят.
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Должность ответственного</Label>
            <Select
              value={state.mainResponsibleTitle}
              onValueChange={(value) =>
                setState((current) => {
                  const candidates = filterUsersByBucket(props.users, value);
                  const stillValid =
                    current.mainResponsibleUserId &&
                    candidates.some((u) => u.id === current.mainResponsibleUserId);
                  return {
                    ...current,
                    mainResponsibleTitle: value,
                    mainResponsibleUserId: stillValid
                      ? current.mainResponsibleUserId
                      : candidates[0]?.id || "",
                  };
                })
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={props.users} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
            <Select
              value={state.mainResponsibleUserId}
              onValueChange={(value) =>
                setState((current) => ({ ...current, mainResponsibleUserId: value }))
              }
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                {filterUsersByBucket(props.users, state.mainResponsibleTitle).map((user) => (
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
              disabled={submitting}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
              onClick={async () => {
                setSubmitting(true);
                try {
                  await props.onSubmit(state);
                  props.onOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddResponsibleDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserItem[];
  onAdd: (responsible: CleaningVentilationResponsible) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [userId, setUserId] = useState("");

  return (
    <Dialog
      open={props.open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setTitle("");
          setUserId("");
        }
        props.onOpenChange(nextOpen);
      }}
    >
      <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <div className="flex items-center justify-between">
            <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
              Добавление ответственного лица
            </DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Должность ответственного</Label>
            <Select
              value={title}
              onValueChange={(value) => {
                setTitle(value);
                const candidates = filterUsersByBucket(props.users, value);
                if (userId && !candidates.some((u) => u.id === userId)) {
                  setUserId(candidates[0]?.id || "");
                } else if (!userId && candidates[0]) {
                  setUserId(candidates[0].id);
                }
              }}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={props.users} />
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                {filterUsersByBucket(props.users, title).map((user) => (
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
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
              disabled={!title || !userId}
              onClick={async () => {
                await props.onAdd({ id: createId(), title, userId });
                props.onOpenChange(false);
              }}
            >
              Добавить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Диалог «Добавление периодичности». Базовые строки («Дезинфекция – 3
 * раз(а) в день») считаются от процедур; здесь управляющая дописывает свои
 * («Мытьё окон – 1 раз в неделю»).
 */
function AddPeriodicityDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (line: string) => Promise<void>;
}) {
  const [line, setLine] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog
      open={props.open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setLine("");
        props.onOpenChange(nextOpen);
      }}
    >
      <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            Добавление периодичности
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-6 py-5">
          <div className="space-y-2">
            <Label className="text-[13px] font-medium text-[#3c4053]">
              Строка периодичности
            </Label>
            <Input
              value={line}
              autoFocus
              placeholder="Например: Мытьё окон – 1 раз в неделю"
              onChange={(event) => setLine(event.target.value)}
              className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
            />
            <p className="text-[12px] leading-[1.45] text-[#6f7282]">
              Появится в блоке «Периодичность» внутри таблицы и в печатной
              форме.
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={!line.trim() || saving}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white transition-colors duration-150 hover:bg-[#4a5bf0]"
              onClick={async () => {
                setSaving(true);
                try {
                  await props.onAdd(line.trim());
                  props.onOpenChange(false);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Добавление..." : "Добавить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CleaningVentilationChecklistDocumentClient({
  documentId,
  routeCode,
  title,
  organizationName,
  controlPeriodicity = "",
  status,
  dateFrom,
  users,
  config: initialConfig,
  initialEntries,
  useV2 = false,
}: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(() =>
    normalizeCleaningVentilationConfig(initialConfig, users)
  );
  const [entryMap, setEntryMap] = useState<
    Record<string, { id?: string; data: CleaningVentilationChecklistEntryData }>
  >(() =>
    Object.fromEntries(
      initialEntries.map((entry) => [
        entry.date,
        { id: entry.id, data: normalizeCleaningVentilationEntryData(entry.data) },
      ])
    )
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const copyYesterday = useCopyYesterdayAction(documentId);
  const [responsibleDialogOpen, setResponsibleDialogOpen] = useState(false);
  const [periodicityDialogOpen, setPeriodicityDialogOpen] = useState(false);
  // По умолчанию панель автозаполнения свёрнута в тонкую полосу
  // (тумблер + резюме + «Настроить»): настройки меняют редко, а места
  // раскрытая панель занимала больше, чем сам чек-лист.
  const [panelOpen, setPanelOpen] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const isActive = status === "active";
  const { mobileView, switchMobileView } = useMobileView("cleaning_ventilation_checklist");
  const docTitle = title || CLEANING_VENTILATION_CHECKLIST_TITLE;

  const activeProcedures = useMemo(
    () =>
      config.procedures.filter(
        (item) => item.enabled && (item.id !== "ventilation" || config.ventilationEnabled)
      ),
    [config]
  );

  const rows = useMemo(
    () =>
      buildChecklistDateKeys(
        dateFrom,
        config.skipWeekends,
        config.customDates,
        config.hiddenDates
      ).map((dateKey) => {
        const entry = entryMap[dateKey]?.data;
        return {
          dateKey,
          procedures: activeProcedures.map((procedure) => ({
            ...procedure,
            times: entry?.procedures[procedure.id] || procedure.times,
            responsibleUserId:
              entry?.responsibleUserId ||
              procedure.responsibleUserId ||
              config.mainResponsibleUserId,
          })),
        };
      }),
    [
      activeProcedures,
      config.customDates,
      config.hiddenDates,
      config.mainResponsibleUserId,
      config.skipWeekends,
      dateFrom,
      entryMap,
    ]
  );

  const settingsState: SettingsState = {
    title: docTitle,
    dateFrom,
    ventilationEnabled: config.ventilationEnabled,
    mainResponsibleTitle: config.mainResponsibleTitle,
    mainResponsibleUserId: config.mainResponsibleUserId,
  };

  const userMap = useMemo(
    () => Object.fromEntries(users.map((user) => [user.id, user])),
    [users]
  );

  const persistConfig = async (
    nextConfig: CleaningVentilationChecklistConfig,
    options?: { title?: string; dateFrom?: string }
  ) => {
    const safeConfig = normalizeCleaningVentilationConfig(nextConfig, users);
    const nextDateFrom = options?.dateFrom || dateFrom;
    const monthBounds = getMonthBoundsFromDate(nextDateFrom);
    await requestJson(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: options?.title || docTitle,
        dateFrom: monthBounds.dateFrom,
        dateTo: monthBounds.dateTo,
        config: safeConfig,
      }),
    });
    setConfig(safeConfig);
    router.refresh();
  };

  const persistEntry = async (
    dateKey: string,
    nextData: CleaningVentilationChecklistEntryData
  ) => {
    const employeeId =
      nextData.responsibleUserId || config.mainResponsibleUserId || users[0]?.id;
    if (!employeeId) return;

    const result = await requestJson(`/api/journal-documents/${documentId}/entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        date: dateKey,
        data: nextData,
      }),
    });

    setEntryMap((current) => ({
      ...current,
      [dateKey]: {
        id:
          result && result.entry && typeof result.entry.id === "string"
            ? result.entry.id
            : current[dateKey]?.id,
        data: nextData,
      },
    }));
  };

  const updateProcedureTime = async (
    dateKey: string,
    procedure: RowProcedure,
    timeIndex: number,
    value: string
  ) => {
    const existing = entryMap[dateKey]?.data || { procedures: {} };
    const sourceTimes =
      existing.procedures[procedure.id] ||
      config.procedures.find((item) => item.id === procedure.id)?.times ||
      [];
    const nextTimes = [...sourceTimes];
    nextTimes[timeIndex] = value;
    await persistEntry(dateKey, {
      procedures: {
        ...existing.procedures,
        [procedure.id]: nextTimes.filter(Boolean),
      },
      responsibleUserId:
        existing.responsibleUserId || procedure.responsibleUserId || config.mainResponsibleUserId,
    });
  };

  const clearSelectedRows = async () => {
    const ids = selection
      .map((item) => entryMap[item]?.id)
      .filter((item): item is string => Boolean(item));
    if (ids.length > 0) {
      await requestJson(`/api/journal-documents/${documentId}/entries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    }

    const nextConfig = {
      ...config,
      hiddenDates: [...new Set([...config.hiddenDates, ...selection])],
      customDates: config.customDates.filter((item) => !selection.includes(item)),
    };
    const nextEntryMap = { ...entryMap };
    selection.forEach((item) => delete nextEntryMap[item]);
    setEntryMap(nextEntryMap);
    setSelection([]);
    await persistConfig(nextConfig);
  };

  const addManualDate = async () => {
    const existingDates = rows.map((item) => item.dateKey);
    const lastDate = existingDates[existingDates.length - 1] || dateFrom;
    const nextDate = new Date(`${lastDate}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextIso = nextDate.toISOString().slice(0, 10);
    await persistConfig({
      ...config,
      hiddenDates: config.hiddenDates.filter((item) => item !== nextIso),
      customDates: [...new Set([...config.customDates, nextIso])],
    });
  };

  return (
    <div className="space-y-5">
      <FocusTodayScroller />
      <JournalSelectionBar
        count={selection.length}
        onClear={() => setSelection([])}
        onDelete={() => {
          clearSelectedRows().catch((error) =>
            toast.error(error instanceof Error ? error.message : "Не удалось удалить строки")
          );
        }}
        hint="Отметки в выбранных строках будут очищены"
      />

      <div className="space-y-6 overflow-hidden rounded-[28px] bg-white p-4 shadow-sm sm:p-8">
        <DocumentActionsBar
          className="mb-0"
          backHref={`/journals/${routeCode}`}
          documentId={documentId}
          heading={<h1 className={`${DOC_HEADING_CLASS} max-w-[980px]`}>{docTitle}</h1>}
          onSettings={isActive ? () => setSettingsOpen(true) : undefined}
          menuItems={
            isActive
              ? [
                  {
                    key: "copy-yesterday",
                    label: "Скопировать вчерашнее",
                    icon: <Copy className="size-4" />,
                    title:
                      "Создать сегодняшние строки по вчерашним значениям — удобно, когда ничего не поменялось.",
                    onSelect: () => void copyYesterday.run(false),
                    disabled: copyYesterday.busy,
                  },
                ]
              : []
          }
        >
          {copyYesterday.dialog}
        </DocumentActionsBar>

        {!isActive ? (
          <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать отметки." />
        ) : null}

        {/* Полоса автозаполнения — ОДНА строка, как на эталоне
            (cleaning_ventilation_checklist-grid.png): тумблер слева,
            «Настроить» справа. Резюме («3 процедуры, время …») жило второй
            строкой и делало полосу вдвое выше эталонной — расписание
            времени и так видно в панели настройки. */}
        <div className="rounded-[28px] bg-[#f4f5fe] px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Switch
                id="cleaning-ventilation-autofill"
                checked={config.autoFillEnabled}
                disabled={!isActive}
                onCheckedChange={(checked) => {
                  persistConfig({ ...config, autoFillEnabled: checked === true }).catch((error) =>
                    toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки")
                  );
                }}
                className="data-[state=checked]:bg-[#5566f6] data-[state=unchecked]:bg-[#d4d8ec]"
              />
              <label
                htmlFor="cleaning-ventilation-autofill"
                className="block min-w-0 cursor-pointer truncate text-[16px] font-semibold text-black"
              >
                Автоматически заполнять чек-лист
              </label>
            </div>
            <button
              type="button"
              onClick={() => setPanelOpen((current) => !current)}
              className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-2xl bg-[#5566f6]/[0.04] px-4 text-[14px] font-medium text-[#5566f6] transition-colors duration-150 hover:bg-[#5566f6]/[0.09] sm:self-auto"
              title={panelOpen ? "Свернуть настройки автозаполнения" : "Показать время и ответственных"}
            >
              {panelOpen ? "Свернуть" : "Настроить"}
              {panelOpen ? (
                <ChevronUp className="size-5" />
              ) : (
                <ChevronDown className="size-5" />
              )}
            </button>
          </div>

          {panelOpen ? (
            <div className="mt-6 space-y-7">
              {activeProcedures.map((procedure) => (
                <div key={procedure.id} className="space-y-4">
                  {procedure.times.map((time, index) => (
                    <div
                      key={`${procedure.id}-${index}`}
                      className="flex flex-col gap-3 md:flex-row md:items-center"
                    >
                      <div className="w-full text-[18px] text-black md:w-[180px]">
                        {procedure.label}
                      </div>
                      <TimeSelect
                        value={time}
                        disabled={!isActive}
                        onChange={(value) => {
                          const nextProcedures = config.procedures.map((item) =>
                            item.id === procedure.id
                              ? {
                                  ...item,
                                  times: item.times.map((existing, timeIndex) =>
                                    timeIndex === index ? value : existing
                                  ),
                                }
                              : item
                          );
                          persistConfig({ ...config, procedures: nextProcedures }).catch((error) =>
                            toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки")
                          );
                        }}
                      />
                    </div>
                  ))}

                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="w-full text-[18px] text-black md:w-[180px]">ФИО отв. лица</div>
                    <Select
                      value={procedure.responsibleUserId}
                      disabled={!isActive}
                      onValueChange={(value) => {
                        const nextProcedures = config.procedures.map((item) =>
                          item.id === procedure.id ? { ...item, responsibleUserId: value } : item
                        );
                        persistConfig({ ...config, procedures: nextProcedures }).catch((error) =>
                          toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки")
                        );
                      }}
                    >
                      <SelectTrigger className="h-12 w-full rounded-[18px] border-[#dcdfed] bg-white px-4 text-[16px] md:w-[320px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}

              <label className="flex items-center gap-3 text-[18px] text-black">
                <Checkbox
                  checked={config.skipWeekends}
                  disabled={!isActive}
                  onCheckedChange={(checked) => {
                    persistConfig({ ...config, skipWeekends: checked === true }).catch((error) =>
                      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки")
                    );
                  }}
                  className="size-6 rounded-[10px]"
                />
                Не заполнять в выходные дни
              </label>
            </div>
          ) : null}
        </div>

        {/* Рамку контейнера убрали: границы теперь несут сами ячейки
            бумажной шапки, иначе линия дублировалась. */}
        <div className="overflow-hidden">
          <table className="w-full border-collapse text-[13px] text-left">
            <tbody>
              <JournalPaperHeaderRows
                orgName={organizationName || 'ООО "Тест"'}
                title={CLEANING_VENTILATION_CHECKLIST_TITLE.toUpperCase()}
                startedAt={dateFrom}
                finishedAt={isActive ? null : dateFrom}
                controlPeriodicity={controlPeriodicity}
                orgCellClass="w-[220px]"
                sideCellClass="w-[250px]"
              />
            </tbody>
          </table>

          <table className="w-full border-collapse text-[13px]">
            <tbody>
              <tr className="border-b border-[#333] print:border-black">
                <td className="w-[180px] border-r border-[#333] print:border-black px-5 py-2 text-[16px] font-semibold leading-tight">
                  Процедура
                </td>
                <td className="border-r border-[#333] print:border-black px-5 py-2 text-[15px] leading-6">
                  {getCleaningVentilationDescriptionLines()
                    .filter(
                      (item) =>
                        item.label !== "Рабочие помещения при проветривании" ||
                        config.ventilationEnabled
                    )
                    .map((item) => (
                      <div key={item.label}>
                        <span className="font-semibold">{item.label}: </span>
                        {item.text}
                      </div>
                    ))}
                </td>
                <td className="w-[210px] border-r border-[#333] print:border-black px-5 py-2 text-[16px] font-semibold leading-tight">
                  Периодичность
                </td>
                <td className="w-[260px] p-0 align-top text-[15px] leading-6">
                  <div className="space-y-1 px-5 py-2">
                    {getCleaningVentilationPeriodicityLines(config.ventilationEnabled).map(
                      (line) => (
                        <div key={line}>{line}</div>
                      )
                    )}
                    {(config.extraPeriodicityLines ?? []).map((line, index) => (
                      <div
                        key={`${line}-${index}`}
                        className="flex items-center justify-between gap-3"
                      >
                        <span>{line}</span>
                        {isActive ? (
                          <button
                            type="button"
                            aria-label={`Удалить периодичность «${line}»`}
                            className="shrink-0 text-[#ff3b30] transition-colors duration-150 hover:text-[#d92b21]"
                            onClick={() => {
                              persistConfig({
                                ...config,
                                extraPeriodicityLines: (
                                  config.extraPeriodicityLines ?? []
                                ).filter((_, itemIndex) => itemIndex !== index),
                              }).catch((error) =>
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Не удалось обновить периодичность"
                                )
                              );
                            }}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {isActive ? (
                    <button
                      type="button"
                      className={CHECKLIST_ADD_CELL_CLASS}
                      onClick={() => setPeriodicityDialogOpen(true)}
                    >
                      <Plus className="size-5" strokeWidth={2.5} />
                      Добавить периодичность
                    </button>
                  ) : null}
                </td>
              </tr>
              <tr>
                <td className="border-r border-[#333] print:border-black px-5 py-2 leading-tight" />
                <td className="border-r border-[#333] print:border-black px-5 py-2 leading-tight" />
                <td className="border-r border-[#333] print:border-black px-5 py-2 text-[16px] font-semibold leading-tight">
                  Ответственные лица
                </td>
                <td className="p-0 align-top text-[15px] leading-6">
                  <div className="space-y-2 px-5 py-2">
                  {config.responsibles.length > 0 ? (
                    config.responsibles.map((responsible) => {
                      const user = userMap[responsible.userId];
                      return (
                        <div key={responsible.id} className="flex items-center justify-between gap-3">
                          <span>
                            {responsible.title} - {user?.name || "Не выбран"}
                          </span>
                          {isActive ? (
                            <button
                              type="button"
                              className="text-[#ff3b30]"
                              onClick={() => {
                                persistConfig({
                                  ...config,
                                  responsibles: config.responsibles.filter(
                                    (item) => item.id !== responsible.id
                                  ),
                                }).catch((error) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Не удалось обновить список ответственных"
                                  )
                                );
                              }}
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div>—</div>
                  )}
                  </div>
                  {isActive ? (
                    <button
                      type="button"
                      className={CHECKLIST_ADD_CELL_CLASS}
                      onClick={() => setResponsibleDialogOpen(true)}
                    >
                      <Plus className="size-5" strokeWidth={2.5} />
                      Добавить ответственного
                    </button>
                  ) : null}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="sm:hidden print:hidden">
          <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />
        </div>

        {mobileView === "cards" ? (
          <RecordCardsView
            items={rows.map((row, index) => ({
              id: row.dateKey,
              title: `№${index + 1} · ${formatRuDate(row.dateKey)}`,
              subtitle: `${row.procedures.length} процедур`,
              leading: isActive ? (
                <Checkbox
                  checked={selection.includes(row.dateKey)}
                  onCheckedChange={(checked) =>
                    setSelection((current) =>
                      checked === true
                        ? [...new Set([...current, row.dateKey])]
                        : current.filter((item) => item !== row.dateKey)
                    )
                  }
                  className="size-5"
                />
              ) : null,
              fields: row.procedures.map((procedure) => {
                const responsibleName = userMap[procedure.responsibleUserId]?.name || "";
                const times = procedure.times.filter(Boolean).join(" · ") || "—";
                return {
                  label: procedure.label,
                  value: (
                    <div className="space-y-1">
                      <div>{times}</div>
                      {responsibleName ? (
                        <div className="text-[12px] text-[#6f7282]">{responsibleName}</div>
                      ) : null}
                    </div>
                  ),
                  hint: isActive && config.autoFillEnabled
                    ? "Для редактирования откройте вкладку Таблица"
                    : undefined,
                };
              }),
            }))}
            emptyLabel="Журнал пока пуст."
          />
        ) : null}

        {/* «Добавить» — слева непосредственно над таблицей (эталон).
            Раньше кнопка стояла справа и выше mobile-переключателя. */}
        <div className={DOC_ADD_ROW_CLASS}>
          {isActive ? (
            <Button
              type="button"
              onClick={() => {
                addManualDate().catch((error) =>
                  toast.error(error instanceof Error ? error.message : "Не удалось добавить дату")
                );
              }}
              className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white hover:bg-[#4a5bf0]"
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Добавить
            </Button>
          ) : null}
        </div>

        {/* Липкая шапка: у чек-листа 90+ строк (3 процедуры × 31 день), и
            без sticky заголовки колонок уезжали на первом же экране. Скролл
            собственный (max-h + overflow-y-auto), потому что страница
            журналов лежит в transform-обёртке — position:sticky относительно
            окна там работает непредсказуемо, а внутри своего скролл-контейнера
            надёжно. При печати ограничение высоты и залипание снимаются.
            Ширины колонок фиксируем через colgroup: «ФИО ответственного
            лица» раньше сжималось до «Администрат…». */}
        <MobileViewTableWrapper
          mobileView={mobileView}
          className="-mx-4 max-h-[70vh] overflow-auto px-4 sm:mx-0 sm:px-0 rounded-[28px] border border-[#333] print:mx-0 print:max-h-none print:overflow-visible print:px-0 print:border-black"
        >
          <table className="min-w-[1100px] w-full table-fixed border-collapse text-[13px]">
            <colgroup>
              <col className="w-[58px]" />
              <col className="w-[130px]" />
              <col className="w-[220px]" />
              <col className="w-[128px]" />
              <col className="w-[128px]" />
              <col className="w-[128px]" />
              <col className="w-[280px]" />
            </colgroup>
            <thead className="sticky top-0 z-20 print:static">
              <tr className="bg-[#f8f9fc] print:bg-white">
                <th className={`${CHECKLIST_STICKY_HEAD_CLASS} border-r px-4 py-4 text-center`}>
                  <div className="flex justify-center">
                    <Checkbox
                      checked={rows.length > 0 && selection.length === rows.length}
                      onCheckedChange={(checked) =>
                        setSelection(Boolean(checked) ? rows.map((r) => r.dateKey) : [])
                      }
                      disabled={!isActive}
                      className="size-5 rounded-[8px]"
                    />
                  </div>
                </th>
                <th className={`${CHECKLIST_STICKY_HEAD_CLASS} border-r px-4 py-4 text-left`}>
                  Дата
                </th>
                <th className={`${CHECKLIST_STICKY_HEAD_CLASS} border-r px-4 py-4 text-left`}>
                  Процедура
                </th>
                <th className={`${CHECKLIST_STICKY_HEAD_CLASS} border-r px-4 py-4 text-center`}>
                  Время 1
                </th>
                <th className={`${CHECKLIST_STICKY_HEAD_CLASS} border-r px-4 py-4 text-center`}>
                  Время 2
                </th>
                <th className={`${CHECKLIST_STICKY_HEAD_CLASS} border-r px-4 py-4 text-center`}>
                  Время 3
                </th>
                <th className={`${CHECKLIST_STICKY_HEAD_CLASS} px-4 py-4 text-left`}>
                  ФИО ответственного лица
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.procedures.map((procedure, index) => {
                  const selected = selection.includes(row.dateKey);
                  const responsibleName = userMap[procedure.responsibleUserId]?.name || "";
                  return (
                    <tr
                      key={`${row.dateKey}-${procedure.id}`}
                      data-focus-today={
                        index === 0 && row.dateKey === toDateKey(new Date()) ? "" : undefined
                      }
                      className="bg-white"
                    >
                      {index === 0 ? (
                        <td
                          rowSpan={row.procedures.length}
                          className="border-b border-r border-[#333] print:border-black px-4 py-4 align-top leading-tight"
                        >
                          <div className="flex justify-center">
                            <Checkbox
                              checked={selected}
                              disabled={!isActive}
                              onCheckedChange={(checked) => {
                                setSelection((current) =>
                                  checked === true
                                    ? [...new Set([...current, row.dateKey])]
                                    : current.filter((item) => item !== row.dateKey)
                                );
                              }}
                              className="mt-1 size-5 rounded-[8px]"
                            />
                          </div>
                        </td>
                      ) : null}
                      {index === 0 ? (
                        <td
                          rowSpan={row.procedures.length}
                          className="border-b border-r border-[#333] print:border-black px-4 py-4 align-top text-[16px] text-black leading-tight"
                        >
                          {formatRuDate(row.dateKey)}
                        </td>
                      ) : null}
                      <td className="border-b border-r border-[#333] print:border-black px-4 py-4 text-[16px] text-black leading-tight">
                        {procedure.label}
                      </td>
                      {[0, 1, 2].map((timeIndex) => (
                        <td
                          key={`${row.dateKey}-${procedure.id}-${timeIndex}`}
                          className="border-b border-r border-[#333] print:border-black px-3 py-1 leading-tight"
                        >
                          <TimeSelect
                            value={procedure.times[timeIndex] || "00:00"}
                            disabled={!isActive || !config.autoFillEnabled}
                            onChange={(value) => {
                              updateProcedureTime(row.dateKey, procedure, timeIndex, value).catch(
                                (error) =>
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : "Не удалось сохранить время"
                                  )
                              );
                            }}
                          />
                        </td>
                      ))}
                      <td className="border-b border-[#333] print:border-black px-4 py-4 text-[16px] text-black leading-tight">
                        {responsibleName}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </MobileViewTableWrapper>
      </div>

      <DocumentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        users={users}
        initial={settingsState}
        onSubmit={async (value) => {
          await persistConfig(
            {
              ...config,
              ventilationEnabled: value.ventilationEnabled,
              mainResponsibleTitle: value.mainResponsibleTitle,
              mainResponsibleUserId: value.mainResponsibleUserId,
              procedures: config.procedures.map((item) => ({
                ...item,
                responsibleUserId:
                  item.responsibleUserId === config.mainResponsibleUserId
                    ? value.mainResponsibleUserId
                    : item.responsibleUserId,
              })),
            },
            {
              title: value.title,
              dateFrom: value.dateFrom,
            }
          );
        }}
        useV2={useV2}
      />

      <AddPeriodicityDialog
        open={periodicityDialogOpen}
        onOpenChange={setPeriodicityDialogOpen}
        onAdd={async (line) => {
          await persistConfig({
            ...config,
            extraPeriodicityLines: [...(config.extraPeriodicityLines ?? []), line],
          });
        }}
      />

      <AddResponsibleDialog
        open={responsibleDialogOpen}
        onOpenChange={setResponsibleDialogOpen}
        users={users}
        onAdd={async (responsible) => {
          await persistConfig({
            ...config,
            responsibles: [...config.responsibles, responsible],
          });
        }}
      />
    </div>
  );
}
