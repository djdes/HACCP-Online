"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import { useJournalUndo } from "@/lib/journal-undo";
import {
  COLD_EQUIPMENT_PRESETS,
  collectColdEquipmentDeviations,
  isColdEquipmentValueOutOfRange,
  COLD_EQUIPMENT_READING_MODES,
  type ColdEquipmentReadingModeId,
} from "@/lib/cold-equipment-document";
import {
  DOC_ADD_ROW_CLASS,
  DOC_AUTOFILL_STRIP_CLASS,
  DOC_CAPS_TITLE_CLASS,
  DOC_HEADING_CLASS,
  DOC_PAPER_CANVAS_CLASS,
  DOC_PAPER_HEADER_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  DOC_AUTOFILL_LABEL_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import {
  JournalDocumentHeader,
  JournalDocumentTitle,
} from "@/components/journals/journal-document-header";
import {
  Archive,
  ChevronDown,
  ChevronUp,
  Copy,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceNumberInput } from "@/components/ui/voice-number-input";
import { submitWithOfflineFallback } from "@/lib/use-offline-submit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getCleaningGridMonthLabel } from "@/lib/cleaning-document";
import {
  createColdEquipmentConfigItem,
  createEmptyColdEquipmentEntryData,
  getColdEquipmentDateLabel,
  normalizeColdEquipmentDocumentConfig,
  type ColdEquipmentConfigItem,
  type ColdEquipmentDocumentConfig,
  type ColdEquipmentEntryData,
} from "@/lib/cold-equipment-document";
import {
  buildDateKeys,
  getDayNumber,
  getHygienePositionLabel,
  getWeekdayShort,
  isWeekend,
  toDateKey,
} from "@/lib/hygiene-document";
import { useDocumentCloseAction } from "@/components/journals/document-close-button";
import { useCopyYesterdayAction } from "@/components/journals/copy-yesterday-button";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { JournalClosedBanner } from "@/components/journals/journal-closed-banner";
import { MobileViewToggle } from "@/components/journals/mobile-view-toggle";
import { useMobileView } from "@/lib/use-mobile-view";

import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { confirmAsync } from "@/components/ui/confirm-async";
import { PositionSelectItems } from "@/components/shared/position-select";
import { getUsersForRoleLabel } from "@/lib/user-roles";
import {
  GRID_BORDER_CLASS,
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_SERVICE_LABEL_CLASS,
  GRID_VIEWPORT_CLASS,
} from "@/components/journals/journal-grid";

import { useTodayKey } from "@/lib/use-today-key";
/**
 * Screen ↔ print duality tokens (тот же приём, что в
 * `cleaning-document-client.tsx` / `hygiene-document-client.tsx`).
 */

type EmployeeItem = {
  id: string;
  name: string;
  role: string;
};

type EntryRow = {
  id: string;
  employeeId: string;
  date: string;
  data: ColdEquipmentEntryData;
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
  dateFrom: string;
  dateTo: string;
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  status: string;
  autoFill?: boolean;
  employees: EmployeeItem[];
  config: ColdEquipmentDocumentConfig;
  initialEntries: EntryRow[];
  /** Design v2 toggle. Settings dialog → JournalSettingsModal style. */
  useV2?: boolean;
};

function formatRange(min: number | null, max: number | null) {
  if (min == null && max == null) return "Норма не задана";
  if (min != null && max != null) return `от ${min}°C до ${max}°C`;
  if (min != null) return `от ${min}°C`;
  return `до ${max}°C`;
}

function buildResponsibleCodes(
  employees: EmployeeItem[],
  rows: EntryRow[],
  defaultResponsibleUserId: string | null
) {
  const codeMap: Record<string, string> = {};
  const usedIds = new Set<string>();

  rows.forEach((row) => {
    if (row.employeeId) usedIds.add(row.employeeId);
  });

  if (defaultResponsibleUserId) usedIds.add(defaultResponsibleUserId);

  Array.from(usedIds).forEach((employeeId, index) => {
    codeMap[employeeId] = `С${index + 1}`;
  });

  return {
    codeMap,
    items: Array.from(usedIds)
      .map((employeeId) => {
        const employee = employees.find((item) => item.id === employeeId);
        if (!employee) return null;

        return {
          employeeId,
          code: codeMap[employeeId],
          label: `${codeMap[employeeId]} - ${employee.name}`,
        };
      })
      .filter(
        (
          item
        ): item is {
          employeeId: string;
          code: string;
          label: string;
        } => item !== null
      ),
  };
}

function EquipmentDialog({
  open,
  onOpenChange,
  initialItem,
  canDelete,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialItem: ColdEquipmentConfigItem | null;
  canDelete: boolean;
  onSave: (item: ColdEquipmentConfigItem) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialItem?.name || "");
  const [min, setMin] = useState(initialItem?.min?.toString() || "");
  const [max, setMax] = useState(initialItem?.max?.toString() || "");
  const [presetId, setPresetId] = useState<string>("fridge");
  const [readingMode, setReadingMode] = useState<ColdEquipmentReadingModeId>(
    initialItem?.readingMode ?? "once",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialItem?.name || "");
    setMin(initialItem?.min?.toString() || "");
    setMax(initialItem?.max?.toString() || "");
    setReadingMode(initialItem?.readingMode ?? "once");
    // При правке подсвечиваем тот пресет, чьи нормы совпадают с
    // сохранёнными: человек должен видеть, что стоит «Морозильное», а
    // не гадать по двум числам.
    const matched = COLD_EQUIPMENT_PRESETS.find(
      (preset) =>
        preset.id !== "custom" &&
        preset.min === (initialItem?.min ?? null) &&
        preset.max === (initialItem?.max ?? null),
    );
    setPresetId(matched?.id ?? (initialItem ? "custom" : "fridge"));
  }, [initialItem, open]);

  /** Выбор типа сразу подставляет норму — вспоминать цифры не нужно. */
  function applyPreset(id: string) {
    setPresetId(id);
    const preset = COLD_EQUIPMENT_PRESETS.find((item) => item.id === id);
    if (!preset || preset.id === "custom") return;
    setMin(preset.min === null ? "" : String(preset.min));
    setMax(preset.max === null ? "" : String(preset.max));
  }

  async function handleSave() {
    const item = createColdEquipmentConfigItem({
      id: initialItem?.id,
      sourceEquipmentId: initialItem?.sourceEquipmentId || null,
      name,
      min: min === "" ? null : Number(min),
      max: max === "" ? null : Number(max),
      readingMode,
    });

    setIsSubmitting(true);
    try {
      await onSave(item);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!initialItem) return;
    setIsSubmitting(true);
    try {
      await onDelete(initialItem.id);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            {initialItem ? "Редактирование оборудования" : "Добавление оборудования"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-7 px-6 py-5">
          <div className="space-y-3">
            <Label htmlFor="equipment-name" className="text-[13px] font-medium text-[#3c4053]">
              Наименование
            </Label>
            <Input
              id="equipment-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Холодильная камера"
              className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">
              Сколько раз снимаются показания
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLD_EQUIPMENT_READING_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setReadingMode(mode.id)}
                  className={cn(
                    "h-9 rounded-xl border px-3.5 text-[13.5px] transition-colors",
                    readingMode === mode.id
                      ? "border-[#5566f6] bg-[#f5f6ff] font-medium text-[#3848c7]"
                      : "border-[#dfe1ec] bg-white text-[#3c4053] hover:bg-[#fafbff]",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Тип оборудования с нормой. Раньше нормы вводились двумя
              пустыми полями, и повар вписывал их наугад — цифры по
              СанПиН он наизусть не помнит. */}
          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">
              Данное оборудование
            </Label>
            <div className="space-y-1.5">
              {COLD_EQUIPMENT_PRESETS.map((preset) => (
                <label
                  key={preset.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 transition-colors",
                    presetId === preset.id
                      ? "border-[#5566f6] bg-[#f5f6ff]"
                      : "border-[#ececf4] bg-white hover:bg-[#fafbff]",
                  )}
                >
                  <input
                    type="radio"
                    name="cold-equipment-preset"
                    checked={presetId === preset.id}
                    onChange={() => applyPreset(preset.id)}
                    className="mt-0.5 size-4 accent-[#5566f6]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[13.5px] text-[#0b1024]">
                      {preset.label}
                    </span>
                    <span className="block text-[12px] text-[#6f7282]">
                      {preset.id === "custom"
                        ? preset.hint
                        : `температура должна быть ${preset.hint}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="equipment-min" className="text-[13px] font-medium text-[#3c4053]">
                Температура от
              </Label>
              <Input
                id="equipment-min"
                type="number"
                value={min}
                onChange={(event) => setMin(event.target.value)}
                className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="equipment-max" className="text-[13px] font-medium text-[#3c4053]">
                Температура до
              </Label>
              <Input
                id="equipment-max"
                type="number"
                value={max}
                onChange={(event) => setMax(event.target.value)}
                className="h-9 rounded-xl border-[#dfe1ec] px-3.5 text-[13.5px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {initialItem && canDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="h-9 rounded-xl border-[#ffd7d3] px-3.5 text-[13.5px] text-[#ff3b30] hover:bg-[#fff3f2]"
                >
                  Удалить строку
                </Button>
              ) : null}
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || name.trim() === ""}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Сохранение..." : initialItem ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function JournalSettingsDialog({
  open,
  onOpenChange,
  title,
  responsibleTitle,
  responsibleUserId,
  employees,
  config,
  onSave,
  useV2 = false,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  employees: EmployeeItem[];
  config: ColdEquipmentDocumentConfig;
  onSave: (params: {
    title: string;
    responsibleTitle: string | null;
    responsibleUserId: string | null;
    config: ColdEquipmentDocumentConfig;
  }) => Promise<void>;
  useV2?: boolean;
}) {
  const titleOptions = useMemo(
    () => [...new Set(employees.map((employee) => getHygienePositionLabel(employee.role)))],
    [employees]
  );

  const [name, setName] = useState(title);
  const [position, setPosition] = useState(responsibleTitle || titleOptions[0] || "");
  const [userId, setUserId] = useState(responsibleUserId || employees[0]?.id || "");
  const [skipWeekends, setSkipWeekends] = useState(config.skipWeekends);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(title);
    setPosition(responsibleTitle || titleOptions[0] || "");
    setUserId(responsibleUserId || employees[0]?.id || "");
    setSkipWeekends(config.skipWeekends);
  }, [config.skipWeekends, employees, open, responsibleTitle, responsibleUserId, title, titleOptions]);

  async function handleSave() {
    setIsSubmitting(true);
    try {
      await onSave({
        title: name.trim(),
        responsibleTitle: position || null,
        responsibleUserId: userId || null,
        config: normalizeColdEquipmentDocumentConfig({
          ...config,
          skipWeekends,
        }),
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (useV2) {
    return (
      <JournalSettingsModal
        open={open}
        onOpenChange={onOpenChange}
        title="Настройки журнала"
        description="Название журнала, ответственный сотрудник и режим заполнения."
        size="md"
        isSaving={isSubmitting}
        onSave={handleSave}
        onCancel={() => onOpenChange(false)}
      >
        <div className="space-y-2">
          <Label
            htmlFor="cold-journal-title-v2"
            className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]"
          >
            Название журнала
          </Label>
          <Input
            id="cold-journal-title-v2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Должность ответственного за снятие показателей
          </Label>
          <Select
            value={position}
            onValueChange={(value) => {
              setPosition(value);
              const candidates = getUsersForRoleLabel(employees, value);
              if (userId && !candidates.some((u) => u.id === userId)) {
                setUserId(candidates[0]?.id || "");
              } else if (!userId && candidates[0]) {
                setUserId(candidates[0].id);
              }
            }}
          >
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              <PositionSelectItems users={employees} />
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Сотрудник
          </Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
              <SelectValue placeholder="— Выберите —" />
            </SelectTrigger>
            <SelectContent>
              {(position
                ? getUsersForRoleLabel(employees, position, { keepUserId: userId })
                : employees
              ).map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:bg-[#f5f6ff]">
          <Checkbox
            id="cold-skip-weekends-v2"
            checked={skipWeekends}
            onCheckedChange={(checked) => setSkipWeekends(checked === true)}
          />
          <span className="text-[14px] text-[#0b1024]">Не заполнять в выходные дни</span>
        </label>
      </JournalSettingsModal>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            Настройки журнала
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 px-6 py-5">
          <div className="space-y-3">
            <Label htmlFor="journal-title" className="text-[13px] font-medium text-[#3c4053]">
              Название журнала
            </Label>
            <Input
              id="journal-title"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-22 rounded-[24px] border-[#dfe1ec] px-8 text-[24px]"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">
              Должность ответственного за снятие показателей
            </Label>
            <Select
              value={position}
              onValueChange={(value) => {
                setPosition(value);
                const candidates = getUsersForRoleLabel(employees, value);
                if (userId && !candidates.some((u) => u.id === userId)) {
                  setUserId(candidates[0]?.id || "");
                } else if (!userId && candidates[0]) {
                  setUserId(candidates[0].id);
                }
              }}
            >
              <SelectTrigger className="h-22 rounded-[24px] border-[#dfe1ec] bg-[#fafbff] px-8 text-[15px]">
                <SelectValue placeholder="Выберите должность" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={employees} />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="h-22 rounded-[24px] border-[#dfe1ec] bg-[#fafbff] px-8 text-[15px]">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {(position
                  ? getUsersForRoleLabel(employees, position, { keepUserId: userId })
                  : employees
                ).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4 rounded-[26px] border border-[#dfe1ec] px-6 py-5">
            <Checkbox
              id="skip-weekends"
              checked={skipWeekends}
              onCheckedChange={(checked) => setSkipWeekends(checked === true)}
            />
            <Label
              htmlFor="skip-weekends"
              className="cursor-pointer text-[15px] font-normal text-black"
            >
              Не заполнять в выходные дни
            </Label>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ColdEquipmentDocumentClient({
  documentId,
  title,
  organizationName,
  controlPeriodicity = "",
  dateFrom,
  dateTo,
  responsibleTitle,
  responsibleUserId,
  status,
  autoFill = false,
  employees,
  config,
  initialEntries,
  useV2 = false,
}: Props) {
  const router = useRouter();
  const [documentTitle, setDocumentTitle] = useState(title);
  // «Сегодня» считаем после mount (см. useTodayKey): new Date() в
  // рендере давал hydration mismatch и подсветку не того дня.
  const todayKey = useTodayKey();
  const [rows, setRows] = useState<EntryRow[]>(initialEntries);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [checkedAutoFill, setCheckedAutoFill] = useState(autoFill);
  /**
   * X3 аудита: у эталона выключенный тумблер = только полоса, панель
   * автозаполнения не раскрыта. Стартовое состояние берём от `autoFill`,
   * а рендер дополнительно гейтим по `checkedAutoFill` — выключая тумблер,
   * пользователь сразу видит свёрнутую полосу.
   */
  const [summaryOpen, setSummaryOpen] = useState(autoFill);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const copyYesterday = useCopyYesterdayAction(documentId);
  // История отмены (Ctrl+Z) — только правки этого человека в этой вкладке.
  const undoStack = useJournalUndo({ enabled: status === "active" });

  // Считаем из текущих строк: исправленная температура убирает запись
  // сразу, без перезагрузки страницы.
  const deviations = useMemo(
    () => collectColdEquipmentDeviations(config, rows),
    [config, rows],
  );

  /** Комментарий к отклонению. Кладём в ту же запись, что и температуры. */
  async function saveCorrection(
    dateKey: string,
    equipmentId: string,
    text: string,
  ) {
    const existingRow = rowByDate[dateKey];
    if (!existingRow) return;

    const nextData = {
      ...existingRow.data,
      corrections: { ...(existingRow.data.corrections ?? {}), [equipmentId]: text },
    };

    const response = await fetch(
      `/api/journal-documents/${documentId}/entries`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: existingRow.employeeId,
          date: dateKey,
          data: nextData,
        }),
      },
    ).catch(() => null);

    if (!response?.ok) {
      toast.error("Не удалось сохранить комментарий");
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.date === dateKey ? { ...row, data: nextData } : row,
      ),
    );
  }
  const closeAction = useDocumentCloseAction({ documentId, title });
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<ColdEquipmentConfigItem | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Mobile-only view preference. The 1900-px table behind horizontal
  // scroll is unusable on a 320-px phone, so by default we render a card
  // per equipment with a per-day temperature input accordion. See
  // hygiene-document-client.tsx for the original pattern. Общий хук,
  // ключ `journal-mobile-view:cold_equipment_control`.
  const { mobileView, switchMobileView } = useMobileView("cold_equipment_control");
  const [expandedEquipmentId, setExpandedEquipmentId] = useState<string | null>(
    null
  );
  // Миграция со старого ключа "cold-equipment-mobile-view" (до перехода на
  // общий useMobileView).
  useEffect(() => {
    try {
      if (window.localStorage.getItem("journal-mobile-view:cold_equipment_control")) return;
      const legacy = window.localStorage.getItem("cold-equipment-mobile-view");
      if (legacy === "table" || legacy === "cards") switchMobileView(legacy);
      window.localStorage.removeItem("cold-equipment-mobile-view");
    } catch {
      /* localStorage blocked — остаёмся на дефолте 'cards' */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dateKeys = useMemo(() => buildDateKeys(dateFrom, dateTo), [dateFrom, dateTo]);
  /**
   * Раньше ширина таблицы была прибита гвоздями (`min-w-[1900px]`), из-за
   * чего у месяца из 15 дней колонки растягивались вдвое против эталона.
   * Считаем от состава: 40 (чекбокс) + 300 (наименование) + 48 × дни.
   */
  const gridMinWidth = 340 + dateKeys.length * 48;
  const rowByDate = useMemo(
    () =>
      Object.fromEntries(
        [...rows]
          .sort((left, right) => left.date.localeCompare(right.date))
          .map((row) => [row.date, row])
      ) as Record<string, EntryRow>,
    [rows]
  );
  const responsibleCodes = useMemo(
    () => buildResponsibleCodes(employees, rows, responsibleUserId),
    [employees, responsibleUserId, rows]
  );
  const allSelected =
    config.equipment.length > 0 &&
    selectedEquipmentIds.length === config.equipment.length;

  async function persistDocument(payload: Record<string, unknown>) {
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || "Не удалось сохранить документ");
    }

    return result;
  }

  async function syncEntries() {
    const response = await fetch(`/api/journal-documents/${documentId}/cold-equipment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_entries" }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || "Не удалось синхронизировать строки");
    }
  }

  async function handleSaveSettings(params: {
    title: string;
    responsibleTitle: string | null;
    responsibleUserId: string | null;
    config: ColdEquipmentDocumentConfig;
  }) {
    await persistDocument(params);
    await syncEntries();
    setDocumentTitle(params.title);
    router.refresh();
  }

  /**
   * Смена ответственного прямо из панели («ФИО отв. лица»), без захода в
   * «Настройки журнала». Код С1/С2 под таблицей пересчитывается сам —
   * он выводится из `responsibleUserId` + `employeeId` строк.
   */
  async function handleResponsibleUserChange(nextUserId: string | null) {
    setIsSwitching(true);
    try {
      await persistDocument({ responsibleUserId: nextUserId });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сменить ответственного"
      );
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleSaveEquipment(item: ColdEquipmentConfigItem) {
    const nextConfig = normalizeColdEquipmentDocumentConfig({
      ...config,
      equipment: editingEquipment
        ? config.equipment.map((current) =>
            current.id === editingEquipment.id ? item : current
          )
        : [...config.equipment, item],
    });

    await persistDocument({ config: nextConfig });
    await syncEntries();
    router.refresh();
  }

  async function handleDeleteEquipment(itemId: string) {
    const nextEquipment = config.equipment.filter((item) => item.id !== itemId);
    if (nextEquipment.length === 0) {
      toast.error("В журнале должна остаться хотя бы одна строка оборудования.");
      return;
    }

    setIsDeleting(true);
    try {
      await persistDocument({
        config: {
          ...config,
          equipment: nextEquipment,
        },
      });
      await syncEntries();
      setSelectedEquipmentIds((current) => current.filter((value) => value !== itemId));
      router.refresh();
      toast.success("Строка удалена");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить строку"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteSelectedEquipment() {
    if (selectedEquipmentIds.length === 0) return;

    const nextEquipment = config.equipment.filter(
      (item) => !selectedEquipmentIds.includes(item.id)
    );
    if (nextEquipment.length === 0) {
      toast.error("В журнале должна остаться хотя бы одна строка оборудования.");
      return;
    }

    if (!(await confirmAsync({ title: "Удалить выбранные строки?", description: `Будет удалено строк: ${selectedEquipmentIds.length}. Восстановить нельзя.`, variant: "danger", confirmLabel: "Удалить" }))) return;

    setIsDeleting(true);
    try {
      await persistDocument({
        config: {
          ...config,
          equipment: nextEquipment,
        },
      });
      await syncEntries();
      setSelectedEquipmentIds([]);
      router.refresh();
      toast.success(`Удалено строк: ${selectedEquipmentIds.length}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось удалить выбранные строки"
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleAutoFillChange(value: boolean) {
    setCheckedAutoFill(value);
    // Включили автозаполнение — сразу показываем нормы и ответственного.
    if (value) setSummaryOpen(true);
    setIsSwitching(true);

    try {
      await persistDocument({ autoFill: value });

      if (value) {
        const response = await fetch(`/api/journal-documents/${documentId}/cold-equipment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply_auto_fill" }),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(result?.error || "Не удалось применить автозаполнение");
        }
      }

      router.refresh();
    } catch (error) {
      setCheckedAutoFill(!value);
      toast.error(
        error instanceof Error ? error.message : "Ошибка обновления автозаполнения"
      );
    } finally {
      setIsSwitching(false);
    }
  }

  /**
   * `silent` — откат/повтор из истории отмены: шаг в стек не кладём и
   * ошибку пробрасываем наружу, чтобы протухший шаг (сервер ответил
   * «прошлые дни закрыты») вылетел из истории.
   */
  async function handleTemperatureBlur(
    dateKey: string,
    equipmentId: string,
    rawValue: string,
    options?: { silent?: boolean }
  ) {
    const previousValue = rowByDate[dateKey]?.data.temperatures?.[equipmentId];
    const previousRaw =
      previousValue === null || previousValue === undefined
        ? ""
        : String(previousValue);
    const employeeId = rowByDate[dateKey]?.employeeId || responsibleUserId || employees[0]?.id;
    if (!employeeId) {
      toast.error("Нет сотрудника, которого можно назначить ответственным.");
      return;
    }

    const existingRow = rowByDate[dateKey];
    const nextData = existingRow
      ? {
          ...createEmptyColdEquipmentEntryData(
            config,
            existingRow.data.responsibleTitle || responsibleTitle
          ),
          ...existingRow.data,
          temperatures: {
            ...createEmptyColdEquipmentEntryData(
              config,
              existingRow.data.responsibleTitle || responsibleTitle
            ).temperatures,
            ...existingRow.data.temperatures,
          },
        }
      : createEmptyColdEquipmentEntryData(config, responsibleTitle);

    nextData.temperatures[equipmentId] = rawValue === "" ? null : Number(rawValue);

    const submit = await submitWithOfflineFallback({
      method: "PUT",
      url: `/api/journal-documents/${documentId}/entries`,
      body: { employeeId, date: dateKey, data: nextData },
      label: `Температура · ${dateKey}`,
      group: "cold_equipment_control",
    });

    if (submit.status === "queued") {
      toast.info(
        "Нет сети — запись сохранена локально, отправлю как только появится интернет."
      );
      // Optimistic: обновляем UI как будто успешно сохранили.
      setRows((currentRows) => {
        const nextRow: EntryRow = {
          id: `offline-${dateKey}`,
          employeeId,
          date: dateKey,
          data: nextData,
        };
        const withoutCurrent = currentRows.filter((row) => row.date !== dateKey);
        return [...withoutCurrent, nextRow].sort((left, right) =>
          left.date.localeCompare(right.date)
        );
      });
      return;
    }

    const response = submit.response;
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.entry) {
      const message = result?.error || "Не удалось сохранить значение";
      if (options?.silent) throw new Error(message);
      toast.error(message);
      return;
    }

    setRows((currentRows) => {
      const nextRow: EntryRow = {
        id: result.entry.id,
        employeeId,
        date: dateKey,
        data: nextData,
      };

      const withoutCurrent = currentRows.filter((row) => row.date !== dateKey);
      return [...withoutCurrent, nextRow].sort((left, right) =>
        left.date.localeCompare(right.date)
      );
    });

    if (!options?.silent && previousRaw !== rawValue) {
      undoStack.push({
        undo: () =>
          handleTemperatureBlur(dateKey, equipmentId, previousRaw, { silent: true }),
        redo: () =>
          handleTemperatureBlur(dateKey, equipmentId, rawValue, { silent: true }),
      });
    }
  }

  /**
   * «Добавить ХК» — ОБЫЧНАЯ инлайновая кнопка над таблицей (эталон
   * cold_equipment_control-grid.png). Раньше она жила в `sticky top-0`
   * панели и уезжала под шапку кабинета (у той свой `sticky top-0 h-14`),
   * то есть на странице её попросту не было видно.
   *
   * X2 аудита: у эталона это сплит «+ Добавить ⌄» с выпадающим списком,
   * а не одиночная кнопка. Второго ответственного модель не заводит —
   * коды С1/С2 ВЫВОДЯТСЯ из `employeeId` строк (`buildResponsibleCodes`),
   * а сам ответственный это одно поле документа. Поэтому второй пункт
   * ведёт в «Настройки журнала», где ответственный и назначается
   * (решение N8), а не создаёт новую сущность.
   */
  const equipmentAddBar =
    status === "active" ? (
      <div className={DOC_ADD_ROW_CLASS}>
        <div className="flex items-stretch overflow-hidden rounded-lg">
          <Button
            type="button"
            onClick={() => {
              setEditingEquipment(null);
              setEquipmentDialogOpen(true);
            }}
            title="Добавить единицу холодильного или морозильного оборудования"
            className="h-11 gap-2 rounded-none rounded-l-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#4a5bf0]"
          >
            <Plus className="size-5" strokeWidth={2.5} />
            Добавить
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                aria-label="Что добавить"
                className="h-11 w-11 rounded-none rounded-r-lg border-l border-white/25 bg-[#5566f6] px-0 text-white transition-colors duration-150 hover:bg-[#4a5bf0]"
              >
                <ChevronDown className="size-5" strokeWidth={2.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onSelect={() => {
                  setEditingEquipment(null);
                  setEquipmentDialogOpen(true);
                }}
              >
                Добавить ХК
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                Добавить ответственного
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    ) : null;

  const selectionBar =
    status === "active" ? (
      <JournalSelectionBar
        count={selectedEquipmentIds.length}
        onClear={() => setSelectedEquipmentIds([])}
        onDelete={handleDeleteSelectedEquipment}
        deleting={isDeleting}
        hint="Оборудование будет удалено вместе с замерами температуры"
      />
    ) : null;

  return (
    <div className="bg-white text-black">
      <FocusTodayScroller always />
      {/* Q3: верхнего padding'а нет — «крошки → H1» задаёт контейнер раздела. */}
      <div className="pb-8">
        <DocumentActionsBar
          backHref="/journals/cold_equipment_control"
          documentId={documentId}
          heading={<h1 className={DOC_HEADING_CLASS}>{documentTitle}</h1>}
          onSettings={status === "active" ? () => setSettingsOpen(true) : undefined}
          undo={{
            canUndo: undoStack.canUndo,
            canRedo: undoStack.canRedo,
            onUndo: () => void undoStack.undo(),
            onRedo: () => void undoStack.redo(),
            undoCount: undoStack.undoCount,
          }}
          menuItems={
            status === "active"
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
                  {
                    key: "close-journal",
                    label: "Закончить журнал",
                    icon: <Archive className="size-4" />,
                    onSelect: () => void closeAction.closeDocument(),
                    disabled: closeAction.isClosing,
                  },
                ]
              : []
          }
        >
          {copyYesterday.dialog}
        </DocumentActionsBar>
        {status !== "active" ? (
          <div className="mb-8">
            <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать показания." />
          </div>
        ) : null}

        {/* Q3: полоса — общий токен-лента 48px (был свой r32 + p-8 + фон
            #f5f6ff и НЕВАЛИДНЫЙ `h-10 w-18` на тумблере). Раскрывающаяся
            панель норм вынесена отдельным блоком ПОД полосой, чтобы сама
            полоса всегда держала эталонную высоту. */}
        <div
          className={cn(
            DOC_AUTOFILL_STRIP_CLASS,
            // Панель норм примыкает снизу — 40px до бумажной шапки
            // отдаёт она, иначе лента разрывалась бы пополам.
            // `cn` (tailwind-merge), а не конкатенация: в голой строке
            // `mb-0` не победил бы `mb-10` — исход решает порядок правил
            // в CSS, а не в атрибуте.
            checkedAutoFill && summaryOpen && "mb-0"
          )}
        >
          <Switch
            checked={checkedAutoFill}
            onCheckedChange={handleAutoFillChange}
            disabled={status !== "active" || isSwitching}
            className="data-[state=unchecked]:bg-[#d6d9ee]"
          />
          <span className={DOC_AUTOFILL_LABEL_CLASS}>
            Автоматически заполнять журнал
          </span>

          {checkedAutoFill ? (
            <button
              type="button"
              onClick={() => setSummaryOpen((value) => !value)}
              className="ml-auto flex size-8 items-center justify-center rounded-full text-[#5566f6] hover:bg-white/70"
            >
              {summaryOpen ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
            </button>
          ) : null}
        </div>

        {/* Панель норм — СТРОКИ (~52px), а не карточки по 120px.
            Карандаши убраны: по строке кликают целиком. Последняя
            строка — селект «ФИО отв. лица», как на эталоне. */}
        {checkedAutoFill && summaryOpen ? (
          <div className="-mx-4 mb-10 bg-[#f3f4fe] px-4 pb-4 print:hidden md:-mx-8 md:px-8">
            <div className="space-y-1.5">
              {config.equipment.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={status !== "active"}
                  onClick={() => {
                    if (status !== "active") return;
                    setEditingEquipment(item);
                    setEquipmentDialogOpen(true);
                  }}
                  className="grid h-[52px] w-full grid-cols-[minmax(0,1fr)_96px_96px] items-center gap-3 rounded-[14px] bg-white/70 px-4 text-left transition-colors duration-150 hover:bg-white disabled:cursor-default disabled:hover:bg-white/70"
                >
                  <span className="truncate text-[14px] text-black">
                    {item.name}, Темп. (T)
                  </span>
                  <span className="rounded-[10px] border border-[#dcdfed] bg-white px-3 py-1.5 text-center text-[13.5px] tabular-nums">
                    От {item.min ?? "—"}
                  </span>
                  <span className="rounded-[10px] border border-[#dcdfed] bg-white px-3 py-1.5 text-center text-[13.5px] tabular-nums">
                    До {item.max ?? "—"}
                  </span>
                </button>
              ))}

              <div className="grid h-[52px] w-full grid-cols-[minmax(0,1fr)_minmax(0,200px)] items-center gap-3 rounded-[14px] bg-white/70 px-4">
                <span className="truncate text-[14px] text-black">
                  ФИО отв. лица
                  {responsibleTitle ? (
                    <span className="ml-1 text-[13px] text-[#6f7282]">
                      ({responsibleTitle})
                    </span>
                  ) : null}
                </span>
                <Select
                  value={responsibleUserId || "__empty__"}
                  disabled={status !== "active" || isSwitching}
                  onValueChange={(value) => {
                    void handleResponsibleUserChange(
                      value === "__empty__" ? null : value
                    );
                  }}
                >
                  <SelectTrigger className="h-9 w-full rounded-[10px] border-[#dcdfed] bg-white text-[13.5px]">
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__empty__">Не назначен</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-[13px] text-[#3c4053]">
                <span className="rounded-full bg-white px-3 py-1.5">
                  Период: {getColdEquipmentDateLabel(dateFrom)} -{" "}
                  {getColdEquipmentDateLabel(dateTo)}
                </span>
                {config.skipWeekends ? (
                  <span className="rounded-full bg-white px-3 py-1.5">
                    Выходные пропускаются при автозаполнении
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* Кнопка «Добавить ХО» переехала под КАПС-заголовок, вплотную
            над таблицу — как на эталоне. В mobile-cards ветке она
            рендерится тем же узлом выше карточек. */}
        {mobileView === "cards" ? (
          <div className="sm:hidden print:hidden">{equipmentAddBar}</div>
        ) : null}

        {/* Mobile-only view toggle. Cards = accordion per equipment with
            per-day temperature inputs, vastly more usable on a phone than
            a 1900-px grid. Hidden on sm+ and in print. */}
        <MobileViewToggle mobileView={mobileView} onChange={switchMobileView} />

        {/* Mobile Cards view — accordion per equipment with per-day
            temperature inputs. `handleTemperatureBlur` is the same save
            path as the table, so the two views stay in lockstep. */}
        {mobileView === "cards" ? (
          <div className="space-y-2 sm:hidden print:hidden">
            {config.equipment.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5 text-center text-[13px] text-[#6f7282]">
                Добавьте единицу холодильного оборудования через кнопку
                «Добавить» сверху.
              </div>
            ) : null}
            {config.equipment.map((item) => {
              const expanded = expandedEquipmentId === item.id;
              const filledCount = dateKeys.reduce((acc, dk) => {
                const val = rowByDate[dk]?.data.temperatures[item.id];
                return acc + (val != null ? 1 : 0);
              }, 0);
              const isSelected = selectedEquipmentIds.includes(item.id);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#ececf4] bg-white"
                >
                  <div className="flex items-center gap-3 px-3 py-3">
                    <span
                      onClick={(event) => event.stopPropagation()}
                      className="shrink-0"
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          setSelectedEquipmentIds((current) =>
                            checked === true
                              ? [...current, item.id]
                              : current.filter((value) => value !== item.id)
                          )
                        }
                        disabled={status !== "active"}
                        className="size-5"
                      />
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedEquipmentId(expanded ? null : item.id)
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[14px] font-medium text-[#0b1024]">
                          {item.name}
                        </div>
                        <div className="truncate text-[12px] text-[#6f7282]">
                          {formatRange(item.min, item.max)}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] font-semibold text-[#5566f6]">
                        {filledCount}/{dateKeys.length}
                      </span>
                      <ChevronDown
                        className={`size-4 shrink-0 text-[#6f7282] transition-transform ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                  {expanded ? (
                    <div className="space-y-1.5 border-t border-[#ececf4] p-3">
                      {dateKeys.map((dateKey) => {
                        const row = rowByDate[dateKey];
                        const value = row?.data.temperatures[item.id];
                        const weekend = isWeekend(dateKey);
                        return (
                          <div
                            key={`${item.id}:${dateKey}`}
                            className={`flex items-center gap-2 rounded-xl px-1 py-1 ${
                              weekend ? "bg-[#fafbff]" : ""
                            }`}
                          >
                            <span className="w-14 shrink-0 text-center text-[13px] font-medium text-[#6f7282]">
                              {getDayNumber(dateKey)}{" "}
                              {getWeekdayShort(dateKey)}.
                            </span>
                            {status === "active" ? (
                              <>
                                <Input
                                  id={`temp-${item.id}-${dateKey}`}
                                  type="number"
                                  inputMode="decimal"
                                  step="0.1"
                                  defaultValue={value ?? ""}
                                  onBlur={(event) =>
                                    handleTemperatureBlur(
                                      dateKey,
                                      item.id,
                                      event.target.value
                                    )
                                  }
                                  placeholder="°C"
                                  className="h-10 min-w-0 flex-1 rounded-lg border-[#dcdfed] px-3 text-[14px]"
                                />
                                <VoiceNumberInput
                                  value={value ?? ""}
                                  inputId={`temp-${item.id}-${dateKey}`}
                                  onChange={(n) => {
                                    if (n === null) return;
                                    const input = document.getElementById(
                                      `temp-${item.id}-${dateKey}`
                                    ) as HTMLInputElement | null;
                                    if (input) input.value = String(n);
                                    handleTemperatureBlur(
                                      dateKey,
                                      item.id,
                                      String(n)
                                    );
                                  }}
                                />
                              </>
                            ) : (
                              <span className="flex-1 rounded-lg bg-[#fafbff] px-3 py-2 text-[14px] text-[#0b1024]">
                                {value ?? "—"}
                              </span>
                            )}
                            <span className="w-12 shrink-0 text-right text-[11px] text-[#9b9fb3]">
                              {responsibleCodes.codeMap[
                                row?.employeeId || responsibleUserId || ""
                              ] || ""}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* R1: бумажное полотно — во всю ширину контентной колонки.
            Сетка на 15 дней шире полотна и продолжает скроллиться внутри
            своего GRID_VIEWPORT_CLASS. */}
        <div className={`${DOC_PAPER_CANVAS_CLASS} ${mobileView === "cards" ? "hidden sm:block print:block" : ""}`}>
        {/* A10 аудита: ОДИН scroll-viewport на весь бланк.
         *
         * Раньше ХАССП-шапка и сетка замеров жили в РАЗНЫХ
         * `overflow-x-auto`-контейнерах: шапка тянулась на всю ширину
         * полотна (до 1400px), сетка держалась на inline
         * `min-width: gridMinWidth` (~1175px) — и правая вертикаль
         * бланка расходилась на пару сотен пикселей. Плюс скроллбаров
         * было два, и они ездили независимо.
         *
         * Теперь всё внутри одного viewport'а и одной внутренней
         * колонки шириной `max(100%, gridMinWidth)`: на широком экране
         * бланк занимает полотно целиком, на узком — держит свою
         * минимальную ширину и скроллится.
         * Таблицы внутри — `w-full`, поэтому правая линия ровно одна.
         * На бумаге inline min-width снимает правило по
         * `[data-journal-blank-column]` из app-theme.css. */}
        <div className={GRID_VIEWPORT_CLASS}>
          <div
            style={{ minWidth: `max(100%, ${gridMinWidth}px)` }}
            className="w-full"
            data-journal-blank-column
          >
          <div className={`${DOC_PAPER_HEADER_CLASS} print:mb-2`}>
          <JournalDocumentHeader
            orgName={organizationName}
            title="Журнал контроля температурного режима холодильного и морозильного оборудования"
            startedAt={dateFrom}
            finishedAt={status === "closed" ? dateTo : null}
            controlPeriodicity={controlPeriodicity}
          />
          </div>
        <div className={DOC_CAPS_TITLE_CLASS}>
          <JournalDocumentTitle>
            Журнал контроля температурного режима холодильного и морозильного
            оборудования
          </JournalDocumentTitle>
        </div>
        {/* Без JS-гейта по mobileView: cards — дефолт стейта и на десктопе,
            из-за чего кнопка «Добавить ХК» на десктопе не рендерилась вовсе.
            Внешний контейнер в cards-режиме уже `hidden sm:block`, так что
            на мобильном этот экземпляр скрыт CSS'ом (копия для карточек —
            в своём `sm:hidden` выше). */}
        {equipmentAddBar}
        {selectionBar}
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${GRID_HEAD_CELL_CLASS} w-[40px] px-1 py-1 text-center leading-tight print:hidden`} rowSpan={2}>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelectedEquipmentIds(
                        checked === true ? config.equipment.map((item) => item.id) : []
                      )
                    }
                    disabled={status !== "active" || config.equipment.length === 0}
                  />
                </th>
                <th
                  className={`${GRID_HEAD_CELL_CLASS} min-w-[300px] px-2 py-1.5 text-center text-[13px] font-semibold leading-tight`}
                  rowSpan={2}
                >
                  Наименование или номер ХК
                </th>
                <th
                  className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center text-[13px] font-semibold leading-tight`}
                  colSpan={dateKeys.length}
                >
                  {/* X6: `toLocaleDateString` даёт «август 2026 г.» со
                      строчной, эталон печатает «Месяц Август 2026 г.».
                      Общий хелпер сетки — тот же, что у журнала уборки. */}
                  Месяц {getCleaningGridMonthLabel(dateFrom, dateTo)}
                </th>
              </tr>
              <tr>
                {dateKeys.map((dateKey) => (
                  <th
                    key={dateKey}
                    data-focus-today={dateKey === todayKey ? "" : undefined}
                    // X7: заливки выходных здесь нет — эталон
                    // cold_equipment_control-2-doc.png печатает сетку
                    // однотонной, а чередование фона читалось как «зебра».
                    // Сегодняшний столбец — исключение: без него в сетке на
                    // месяц не видно, куда вносить, и замеры уходят в соседний
                    // день. На печати заливку снимаем, бланк остаётся строгим.
                    className={`${GRID_HEAD_CELL_CLASS} w-[48px] px-1 py-1 text-center font-semibold leading-tight ${
                      dateKey === todayKey
                        ? "bg-[#eef1ff] text-[#3848c7] print:bg-transparent print:text-inherit"
                        : ""
                    }`}
                  >
                    <div className="text-[13px]">{getDayNumber(dateKey)}</div>
                    <div className="text-[11px] font-normal uppercase text-[#666]">
                      {getWeekdayShort(dateKey)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* R5-2: у ячейки-заглушки под колонкой чекбоксов НЕ БЫЛО
                  `print:hidden`, хотя сам чекбокс-столбец в печати скрыт
                  и в шапке (`<th print:hidden>`), и в строках данных
                  (`<td print:hidden>`).

                  Из-за этого на бумаге строка несла на ОДНУ ячейку
                  больше, чем колонок в таблице: всё содержимое съезжало
                  вправо на столбец, «Температура °C» и служебная строка
                  ответственного заезжали в область дней, день 1
                  растягивался под чужую ячейку, а дни 2-15 сжимались в
                  нитки. Скрываем заглушку ровно там же, где скрыт
                  столбец — тогда colSpan (name + N дней) снова сходится. */}
              <tr>
                <td className={`${GRID_CELL_CLASS} px-2 py-1 leading-tight print:hidden`} />
                <td
                  className={`${GRID_CELL_CLASS} px-2 py-1 text-center text-[13px] font-semibold leading-tight`}
                  colSpan={dateKeys.length + 1}
                >
                  Температура °C
                </td>
              </tr>

              {config.equipment.map((item) => (
                <tr key={item.id}>
                  <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight print:hidden`}>
                    <Checkbox
                      checked={selectedEquipmentIds.includes(item.id)}
                      onCheckedChange={(checked) =>
                        setSelectedEquipmentIds((current) =>
                          checked === true
                            ? [...current, item.id]
                            : current.filter((value) => value !== item.id)
                        )
                      }
                      disabled={status !== "active"}
                    />
                  </td>

                  <td className={`${GRID_CELL_CLASS} px-2 py-1 align-middle leading-tight`}>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-medium">{item.name}</span>
                      <span className="text-[12px] text-[#6f7282]">
                        {formatRange(item.min, item.max)}
                      </span>
                    </div>
                  </td>

                  {dateKeys.map((dateKey) => {
                    const row = rowByDate[dateKey];
                    const value = row?.data.temperatures[item.id];

                    return (
                      <td
                        key={`${item.id}:${dateKey}`}
                        className={`${GRID_CELL_CLASS} p-1 text-center leading-tight`}
                      >
                        {status === "active" ? (
                          <Input
                            type="number"
                            step="0.1"
                            defaultValue={value ?? ""}
                            onBlur={(event) =>
                              handleTemperatureBlur(dateKey, item.id, event.target.value)
                            }
                            className={cn(
                              "h-7 min-w-[44px] border-0 px-1 text-center text-[13px] shadow-none focus-visible:ring-1",
                              isColdEquipmentValueOutOfRange(value, item) &&
                                "font-semibold text-[#d2453d]"
                            )}
                          />
                        ) : (
                          <span
                            className={cn(
                              "text-[13px]",
                              isColdEquipmentValueOutOfRange(value, item) &&
                                "font-semibold text-[#d2453d]"
                            )}
                          >
                            {value ?? ""}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr>
                {/* R5-2: та же заглушка колонки чекбоксов — тоже print:hidden. */}
                <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight print:hidden`} />
                {/* Эталон делит эту строку на две ячейки: слева оранжевая
                    служебная метка, справа расшифровка кода «С1 - ФИО»,
                    который стоит в ячейках дней. */}
                <td className={`${GRID_CELL_CLASS} p-0 align-middle leading-tight`}>
                  <div className="flex items-stretch">
                    <div className="flex w-[150px] shrink-0 items-center justify-center px-2 py-1 text-center">
                      <span className={GRID_SERVICE_LABEL_CLASS}>
                        Ответственный за снятие показателей
                      </span>
                    </div>
                    <div className={`flex-1 border-l ${GRID_BORDER_CLASS} px-3 py-1 text-[13px]`}>
                      {responsibleCodes.items.length > 0 ? (
                        responsibleCodes.items.map((item) => (
                          <div key={item.employeeId}>{item.label}</div>
                        ))
                      ) : (
                        <span className="text-[#9b9fb3]">Не назначен</span>
                      )}
                    </div>
                  </div>
                </td>

                {dateKeys.map((dateKey) => {
                  const row = rowByDate[dateKey];
                  /**
                   * X1 аудита: подпись «С1» ставится ТОЛЬКО в дни, где есть
                   * фактические замеры. Раньше код печатался во все 15
                   * ячеек (fallback на `responsibleUserId`), и пустой
                   * журнал выглядел подписанным задним числом.
                   */
                  const hasMeasurements = row
                    ? Object.values(row.data.temperatures).some(
                        (value) => value != null
                      )
                    : false;
                  const employeeId = hasMeasurements
                    ? row?.employeeId || responsibleUserId || ""
                    : "";

                  return (
                    <td
                      key={`responsible:${dateKey}`}
                      className={`${GRID_CELL_CLASS} px-2 py-1 text-center text-[13px] font-medium leading-tight`}
                    >
                      {employeeId ? responsibleCodes.codeMap[employeeId] || "" : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          {deviations.length > 0 ? (
            <section className="mt-6">
              <div className={DOC_CAPS_TITLE_CLASS}>
                <JournalDocumentTitle>Корректирующие действия</JournalDocumentTitle>
              </div>
              <p className="mt-1 text-center text-[12px] leading-snug text-[#a13a32] print:text-[10px]">
                Температура вышла за норму — опишите, что сделали. Пустая
                графа при проверке читается как «нарушение заметили и
                проигнорировали».
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className={`${GRID_CELL_CLASS} w-[110px] px-2 py-1.5 font-semibold text-[#3c4053]`}>
                        Дата
                      </th>
                      <th className={`${GRID_CELL_CLASS} w-[200px] px-2 py-1.5 font-semibold text-[#3c4053]`}>
                        Точка контроля
                      </th>
                      <th className={`${GRID_CELL_CLASS} w-[190px] px-2 py-1.5 font-semibold text-[#3c4053]`}>
                        Зафиксированный параметр
                      </th>
                      <th className={`${GRID_CELL_CLASS} px-2 py-1.5 font-semibold text-[#3c4053]`}>
                        Комментарий / действие
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {deviations.map((d) => (
                      <tr key={d.key} className="bg-[#fff4f2]">
                        <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center tabular-nums`}>
                          {d.date}
                        </td>
                        <td className={`${GRID_CELL_CLASS} px-2 py-1`}>
                          {d.equipmentName}
                        </td>
                        <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center font-medium text-[#d2453d]`}>
                          T, {d.value} °C
                          <span className="ml-1 text-[11px] font-normal text-[#a13a32]">
                            (норма {d.min ?? "—"}…{d.max ?? "—"})
                          </span>
                        </td>
                        <td className={`${GRID_CELL_CLASS} p-0`}>
                          <Input
                            defaultValue={d.comment}
                            placeholder="Что сделали: переставили продукт, вызвали мастера…"
                            disabled={status !== "active"}
                            onBlur={(event) =>
                              void saveCorrection(
                                d.date,
                                d.equipmentId,
                                event.target.value
                              )
                            }
                            className="h-10 w-full border-0 bg-transparent px-2 text-[13px] shadow-none focus-visible:ring-1"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          </div>
        </div>
        </div>
      </div>

      <JournalSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={documentTitle}
        responsibleTitle={responsibleTitle}
        responsibleUserId={responsibleUserId}
        employees={employees}
        config={config}
        onSave={handleSaveSettings}
        useV2={useV2}
      />

      <EquipmentDialog
        open={equipmentDialogOpen}
        onOpenChange={setEquipmentDialogOpen}
        initialItem={editingEquipment}
        canDelete={config.equipment.length > 1}
        onSave={handleSaveEquipment}
        onDelete={handleDeleteEquipment}
      />
    </div>
  );
}
