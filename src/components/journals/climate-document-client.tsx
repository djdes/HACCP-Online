"use client";

import { TOUR } from "@/lib/tour-anchors";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import {
  createClimateRoomConfig,
  createEmptyClimateEntryData,
  getClimateDateLabel,
  getClimatePeriodicityText,
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  CLIMATE_DOCUMENT_TITLE,
  climateCorrectionKey,
  collectClimateDeviations,
  isClimateValueOutOfRange,
  CLIMATE_FREQUENCY_HINT,
  CLIMATE_SCOPE_HINT,
  normalizeClimateDocumentConfig,
  syncClimateEntryDataWithConfig,
  applyRoomDirectoryToClimateConfig,
  climateRoomFromDirectory,
  listClimateRoomsNotInDocument,
  normalizeClimateRoomNorms,
  suggestDirectoryRoomForClimateRow,
  type ClimateDocumentConfig,
  type ClimateEntryData,
  type ClimateRoomConfig,
} from "@/lib/climate-document";
import {
  RoomEditorDialog,
  type RoomEditorInitial,
} from "@/components/cleaning/room-editor-dialog";
import { RoomDirectoryPickerDialog } from "@/components/cleaning/room-directory-picker-dialog";
import { directoryRoomToEditorInitial } from "@/components/cleaning/room-editor-initial";
import type { DirectoryBuilding, DirectoryRoom } from "@/lib/room-directory";
import { getHygienePositionLabel } from "@/lib/hygiene-document";
import { DocumentActionsBar } from "@/components/journals/document-actions-bar";
import { useJournalUndo } from "@/lib/journal-undo";
import {
  DOC_CAPS_TITLE_CLASS,
  DOC_HEADING_CLASS,
  DOC_PAPER_CANVAS_CLASS,
  DOC_PAPER_HEADER_CLASS,
  JOURNAL_DIALOG_CONTENT_CLASS,
  JOURNAL_DIALOG_CONTENT_WIDE_CLASS,
  JOURNAL_DIALOG_HEADER_CLASS,
  JOURNAL_DIALOG_TITLE_CLASS,
  DOC_AUTOFILL_LABEL_CLASS,
  DOC_AUTOFILL_STRIP_CLASS,
} from "@/components/journals/journal-responsive";
import { JournalSelectionBar } from "@/components/journals/journal-selection-bar";
import { JournalSettingsModal } from "@/components/journals/v2/journal-settings-modal";
import { FocusTodayScroller } from "@/components/journals/focus-today-scroller";
import { useDocumentCloseAction } from "@/components/journals/document-close-button";
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
import { StickyActionBar } from "@/components/journals/sticky-action-bar";
import {
  PositionSelectItems,
  usePositionEmployeeCascade,
} from "@/components/shared/position-select";
import {
  GRID_ADD_CELL_SOLID_CLASS,
  GRID_CELL_CLASS,
  GRID_HEAD_CELL_CLASS,
  GRID_VIEWPORT_CLASS,
} from "@/components/journals/journal-grid";
import {
  JournalDocumentTitle,
  JournalPaperHeaderRows,
} from "@/components/journals/journal-document-header";

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

type RowItem = {
  id: string;
  employeeId: string;
  date: string;
  data: ClimateEntryData;
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
  /**
   * 2026-09-04: единый справочник помещений (/settings/buildings).
   * Строки с `roomId` берут имя и нормы из него; карточка помещения
   * открывается прямо из журнала.
   */
  buildings?: DirectoryBuilding[];
  config: ClimateDocumentConfig;
  initialEntries: RowItem[];
  /** Design v2 toggle. */
  useV2?: boolean;
};

function formatRange(min: number | null, max: number | null, unit: string) {
  if (min == null && max == null) return "Не задано";
  if (min != null && max != null) return `от ${min}${unit} до ${max}${unit}`;
  if (min != null) return `от ${min}${unit}`;
  return `до ${max}${unit}`;
}

function getRoomMetricColumnCount(room: ClimateRoomConfig) {
  return Number(room.temperature.enabled) + Number(room.humidity.enabled);
}

function getSortedRows(rows: RowItem[]) {
  return [...rows].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    return left.employeeId.localeCompare(right.employeeId);
  });
}

function parseMetricInput(rawValue: string) {
  if (rawValue.trim() === "") return null;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDateWithinDocumentPeriod(dateKey: string, dateFrom: string, dateTo: string) {
  return dateKey >= dateFrom && dateKey <= dateTo;
}

function RoomDialog({
  open,
  onOpenChange,
  initialRoom,
  canDelete,
  linkOptions,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialRoom: ClimateRoomConfig | null;
  canDelete: boolean;
  /** Помещения справочника, с которыми можно связать legacy-строку. */
  linkOptions?: Array<{ id: string; name: string }>;
  onSave: (room: ClimateRoomConfig, linkRoomId?: string | null) => Promise<void>;
  onDelete: (roomId: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [linkRoomId, setLinkRoomId] = useState("");
  const [temperatureEnabled, setTemperatureEnabled] = useState(true);
  const [temperatureMin, setTemperatureMin] = useState("18");
  const [temperatureMax, setTemperatureMax] = useState("25");
  const [humidityEnabled, setHumidityEnabled] = useState(true);
  const [humidityMin, setHumidityMin] = useState("15");
  const [humidityMax, setHumidityMax] = useState("75");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const room =
      initialRoom ||
      createClimateRoomConfig({
        temperature: { enabled: false, min: 18, max: 25 },
        humidity: { enabled: false, min: 15, max: 75 },
      });
    setName(room.name);
    setLinkRoomId("");
    setTemperatureEnabled(room.temperature.enabled);
    setTemperatureMin(room.temperature.min?.toString() || "");
    setTemperatureMax(room.temperature.max?.toString() || "");
    setHumidityEnabled(room.humidity.enabled);
    setHumidityMin(room.humidity.min?.toString() || "");
    setHumidityMax(room.humidity.max?.toString() || "");
  }, [initialRoom, open]);

  async function handleSave() {
    if (!temperatureEnabled && !humidityEnabled) {
      toast.error("Нужно оставить включённой хотя бы одну норму для помещения.");
      return;
    }

    const room = createClimateRoomConfig({
      id: initialRoom?.id,
      name,
      temperature: {
        enabled: temperatureEnabled,
        min: temperatureMin === "" ? null : Number(temperatureMin),
        max: temperatureMax === "" ? null : Number(temperatureMax),
      },
      humidity: {
        enabled: humidityEnabled,
        min: humidityMin === "" ? null : Number(humidityMin),
        max: humidityMax === "" ? null : Number(humidityMax),
      },
    });

    setIsSubmitting(true);
    try {
      await onSave(room, linkRoomId || null);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения помещения");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!initialRoom) return;
    setIsSubmitting(true);
    try {
      await onDelete(initialRoom.id);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка удаления помещения");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            {initialRoom ? "Редактирование помещения" : "Добавление нового помещения"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          <div className="space-y-3">
            <Label htmlFor="room-name" className="sr-only">
              Название помещения
            </Label>
            <Input
              id="room-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Введите название помещения"
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>

          {initialRoom && !initialRoom.roomId && (linkOptions?.length ?? 0) > 0 ? (
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
                {linkOptions?.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
              <p className="text-[11.5px] leading-[1.5] text-[#6f7282]">
                После связи имя и нормы берутся из карточки помещения («Настройки → Помещения»), замеры сохраняются.
              </p>
            </div>
          ) : null}

          <div className="space-y-5">
            <div className="text-[16px] font-medium text-black">Нормы условий</div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={temperatureEnabled}
                  onCheckedChange={setTemperatureEnabled}
                  className="data-[state=checked]:bg-[#5566f6] data-[state=unchecked]:bg-[#d6d9ee]"
                />
                <div className="text-[15px] text-black">Температура (T)</div>
                <Input
                  type="number"
                  value={temperatureMin}
                  onChange={(event) => setTemperatureMin(event.target.value)}
                  className="h-9 w-[96px] rounded-xl border-[#dcdfed] px-3 text-[13.5px]"
                  disabled={!temperatureEnabled}
                />
                <span className="text-[15px] text-[#6d7285]">°C</span>
                <Input
                  type="number"
                  value={temperatureMax}
                  onChange={(event) => setTemperatureMax(event.target.value)}
                  className="h-9 w-[96px] rounded-xl border-[#dcdfed] px-3 text-[13.5px]"
                  disabled={!temperatureEnabled}
                />
                <span className="text-[15px] text-[#6d7285]">°C</span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Switch
                  checked={humidityEnabled}
                  onCheckedChange={setHumidityEnabled}
                  className="data-[state=checked]:bg-[#5566f6] data-[state=unchecked]:bg-[#d6d9ee]"
                />
                <div className="text-[15px] text-black">Влажность воздуха (ВВ)</div>
                <Input
                  type="number"
                  value={humidityMin}
                  onChange={(event) => setHumidityMin(event.target.value)}
                  className="h-9 w-[96px] rounded-xl border-[#dcdfed] px-3 text-[13.5px]"
                  disabled={!humidityEnabled}
                />
                <span className="text-[15px] text-[#6d7285]">%</span>
                <Input
                  type="number"
                  value={humidityMax}
                  onChange={(event) => setHumidityMax(event.target.value)}
                  className="h-9 w-[96px] rounded-xl border-[#dcdfed] px-3 text-[13.5px]"
                  disabled={!humidityEnabled}
                />
                <span className="text-[15px] text-[#6d7285]">%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div>
              {initialRoom && canDelete && (
                <>
                  <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="h-9 rounded-xl border-[#ffd7d3] px-3.5 text-[13.5px] text-[#ff3b30] hover:bg-[#fff3f2]"
                >
                  Удалить помещение
                </Button>
                </>
              )}
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || name.trim() === ""}
              className="h-10 rounded-xl bg-[#5566f6] px-5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Сохранение..." : initialRoom ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResponsibleDialog({
  open,
  onOpenChange,
  row,
  employees,
  defaultResponsibleTitle,
  defaultResponsibleUserId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  row: RowItem | null;
  employees: EmployeeItem[];
  defaultResponsibleTitle: string | null;
  defaultResponsibleUserId: string | null;
  onSave: (params: {
    rowId: string;
    employeeId: string;
    responsibleTitle: string | null;
  }) => Promise<void>;
}) {
  const [responsibleTitle, setResponsibleTitle] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleOptions = useMemo(
    () => [...new Set(employees.map((employee) => getHygienePositionLabel(employee.role)))],
    [employees]
  );

  useEffect(() => {
    if (!open || !row) return;
    setResponsibleTitle(row.data.responsibleTitle || defaultResponsibleTitle || titleOptions[0] || "");
    setEmployeeId(row.employeeId || defaultResponsibleUserId || employees[0]?.id || "");
  }, [defaultResponsibleTitle, defaultResponsibleUserId, employees, open, row, titleOptions]);

  const cascade = usePositionEmployeeCascade({
    users: employees,
    positionTitle: responsibleTitle,
    userId: employeeId,
    onChange: (next) => {
      setResponsibleTitle(next.positionTitle);
      setEmployeeId(next.userId);
    },
    autoPick: "first",
  });

  async function handleSubmit() {
    if (!row) return;
    setIsSubmitting(true);
    try {
      await onSave({
        rowId: row.id,
        employeeId,
        responsibleTitle: responsibleTitle || null,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить ответственного");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            Редактирование ответственного лица
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-7 px-6 py-5">
          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">Должность ответственного</Label>
            <Select
              value={responsibleTitle}
              onValueChange={cascade.handlePositionChange}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="Выберите должность" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={employees} />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
            <Select
              value={employeeId}
              onValueChange={cascade.handleEmployeeChange}
              open={cascade.employeeOpen}
              onOpenChange={cascade.setEmployeeOpen}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {(responsibleTitle ? cascade.candidates : employees).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !employeeId}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddRowDialog({
  open,
  onOpenChange,
  employees,
  defaultResponsibleTitle,
  defaultResponsibleUserId,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  employees: EmployeeItem[];
  defaultResponsibleTitle: string | null;
  defaultResponsibleUserId: string | null;
  onCreate: (params: {
    employeeId: string;
    date: string;
    responsibleTitle: string | null;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [responsibleTitle, setResponsibleTitle] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleOptions = useMemo(
    () => [...new Set(employees.map((employee) => getHygienePositionLabel(employee.role)))],
    [employees]
  );

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setDate(todayLabel);
    setResponsibleTitle(defaultResponsibleTitle || titleOptions[0] || "");
    setEmployeeId(defaultResponsibleUserId || employees[0]?.id || "");
  }, [defaultResponsibleTitle, defaultResponsibleUserId, employees, open, titleOptions]);

  const cascade = usePositionEmployeeCascade({
    users: employees,
    positionTitle: responsibleTitle,
    userId: employeeId,
    onChange: (next) => {
      setResponsibleTitle(next.positionTitle);
      setEmployeeId(next.userId);
    },
    autoPick: "first",
  });

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await onCreate({
        employeeId,
        date,
        responsibleTitle: responsibleTitle || null,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка создания строки");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={JOURNAL_DIALOG_CONTENT_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            Добавление новой строки
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-7 px-6 py-5">
          <div className="space-y-3">
            <Label htmlFor="row-date" className="text-[13px] font-medium text-[#3c4053]">
              Дата
            </Label>
            <Input
              id="row-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">Должность ответственного</Label>
            <Select
              value={responsibleTitle}
              onValueChange={cascade.handlePositionChange}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="Выберите должность" />
              </SelectTrigger>
              <SelectContent>
                <PositionSelectItems users={employees} />
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник</Label>
            <Select
              value={employeeId}
              onValueChange={cascade.handleEmployeeChange}
              open={cascade.employeeOpen}
              onOpenChange={cascade.setEmployeeOpen}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                <SelectValue placeholder="Выберите сотрудника" />
              </SelectTrigger>
              <SelectContent>
                {(responsibleTitle ? cascade.candidates : employees).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !date || !employeeId}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Создание..." : "Создать"}
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
  config: ClimateDocumentConfig;
  onSave: (params: {
    title: string;
    responsibleTitle: string | null;
    responsibleUserId: string | null;
    config: ClimateDocumentConfig;
  }) => Promise<void>;
  useV2?: boolean;
}) {
  const [name, setName] = useState(title);
  const [position, setPosition] = useState(responsibleTitle || "");
  const [userId, setUserId] = useState(responsibleUserId || "");
  const [timeOne, setTimeOne] = useState(config.controlTimes[0] || "10:00");
  const [timeTwo, setTimeTwo] = useState(config.controlTimes[1] || "17:00");
  const [skipWeekends, setSkipWeekends] = useState(config.skipWeekends);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const titleOptions = useMemo(
    () => [...new Set(employees.map((employee) => getHygienePositionLabel(employee.role)))],
    [employees]
  );

  useEffect(() => {
    if (!open) return;
    setName(title);
    setPosition(responsibleTitle || titleOptions[0] || "");
    setUserId(responsibleUserId || employees[0]?.id || "");
    setTimeOne(config.controlTimes[0] || "10:00");
    setTimeTwo(config.controlTimes[1] || "17:00");
    setSkipWeekends(config.skipWeekends);
  }, [config.controlTimes, config.skipWeekends, employees, open, responsibleTitle, responsibleUserId, title, titleOptions]);

  const cascade = usePositionEmployeeCascade({
    users: employees,
    positionTitle: position,
    userId,
    onChange: (next) => {
      setPosition(next.positionTitle);
      setUserId(next.userId);
    },
    autoPick: "first",
  });

  async function handleSave() {
    if (!timeOne && !timeTwo) {
      toast.error("Нужно указать хотя бы одно время контроля.");
      return;
    }

    const nextConfig = normalizeClimateDocumentConfig({
      ...config,
      controlTimes: [timeOne, timeTwo].filter(Boolean),
      skipWeekends,
    });

    setIsSubmitting(true);
    try {
      await onSave({
        title: name.trim(),
        responsibleTitle: position || null,
        responsibleUserId: userId || null,
        config: nextConfig,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения настроек");
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
        description="Название журнала, ответственный сотрудник по умолчанию и расписание контроля."
        size="lg"
        isSaving={isSubmitting}
        saveDisabled={name.trim() === ""}
        onSave={handleSave}
        onCancel={() => onOpenChange(false)}
      >
        <div className="space-y-2">
          <Label
            htmlFor="climate-title-v2"
            className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]"
          >
            Название журнала
          </Label>
          <Input
            id="climate-title-v2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px] focus:border-[#5566f6] focus:ring-4 focus:ring-[#5566f6]/15"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
              Должность ответственного
            </Label>
            <Select
              value={position}
              onValueChange={cascade.handlePositionChange}
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
              Сотрудник по умолчанию
            </Label>
            <Select
              value={userId}
              onValueChange={cascade.handleEmployeeChange}
              open={cascade.employeeOpen}
              onOpenChange={cascade.setEmployeeOpen}
            >
              <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-white text-[13.5px]">
                <SelectValue placeholder="— Выберите —" />
              </SelectTrigger>
              <SelectContent>
                {(position ? cascade.candidates : employees).map(
                  (employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label
              htmlFor="climate-time-one-v2"
              className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]"
            >
              Время контроля 1
            </Label>
            <Input
              id="climate-time-one-v2"
              type="time"
              value={timeOne}
              onChange={(event) => setTimeOne(event.target.value)}
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="climate-time-two-v2"
              className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]"
            >
              Время контроля 2
            </Label>
            <Input
              id="climate-time-two-v2"
              type="time"
              value={timeTwo}
              onChange={(event) => setTimeTwo(event.target.value)}
              className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
            />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 transition-colors hover:bg-[#f5f6ff]">
          <Checkbox
            id="climate-skip-weekends-v2"
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
      <DialogContent className={JOURNAL_DIALOG_CONTENT_WIDE_CLASS}>
        <DialogHeader className={JOURNAL_DIALOG_HEADER_CLASS}>
          <DialogTitle className={JOURNAL_DIALOG_TITLE_CLASS}>
            Настройки журнала
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 px-6 py-5">
          <div className="space-y-3">
            <Label htmlFor="journal-title" className="sr-only">
              Название журнала
            </Label>
            <Input
              id="journal-title"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-22 rounded-3xl border-[#dcdfed] px-8 text-[24px]"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-[13px] font-medium text-[#3c4053]">Должность ответственного</Label>
              <Select
                value={position}
                onValueChange={cascade.handlePositionChange}
              >
                <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                  <SelectValue placeholder="Выберите должность" />
                </SelectTrigger>
                <SelectContent>
                  <PositionSelectItems users={employees} />
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[13px] font-medium text-[#3c4053]">Сотрудник по умолчанию</Label>
              <Select
                value={userId}
                onValueChange={cascade.handleEmployeeChange}
                open={cascade.employeeOpen}
                onOpenChange={cascade.setEmployeeOpen}
              >
                <SelectTrigger className="h-10 rounded-xl border-[#dcdfed] bg-[#fafbff] px-3.5 text-[13.5px]">
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {(position ? cascade.candidates : employees).map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="time-one" className="text-[13px] font-medium text-[#3c4053]">
                Время контроля 1
              </Label>
              <Input
                id="time-one"
                type="time"
                value={timeOne}
                onChange={(event) => setTimeOne(event.target.value)}
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="time-two" className="text-[13px] font-medium text-[#3c4053]">
                Время контроля 2
              </Label>
              <Input
                id="time-two"
                type="time"
                value={timeTwo}
                onChange={(event) => setTimeTwo(event.target.value)}
                className="h-9 rounded-xl border-[#dcdfed] px-3.5 text-[13.5px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-3xl border border-[#dcdfed] px-6 py-5">
            <Checkbox
              id="skip-weekends"
              checked={skipWeekends}
              onCheckedChange={(checked) => setSkipWeekends(checked === true)}
              className="size-6"
            />
            <Label htmlFor="skip-weekends" className="text-[15px] text-black">
              Не заполнять в выходные дни
            </Label>
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || name.trim() === ""}
              className="h-10 rounded-xl bg-[#5566f6] px-3.5 text-[13.5px] text-white hover:bg-[#4a5bf0]"
            >
              {isSubmitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClimateDocumentClient({
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
  buildings = [],
  config: initialConfig,
  initialEntries,
  useV2 = false,
}: Props) {
  const router = useRouter();
  // «Сегодня» — после mount (useTodayKey): new Date() в рендере
  // расходился между сервером (UTC) и браузером и врал подсветкой.
  const todayKey = useTodayKey();
  // Справочник помещений: имена и нормы строк с roomId — из Room.
  const directoryRooms = useMemo(
    () => buildings.flatMap((b) => b.rooms),
    [buildings],
  );
  const [config, setConfig] = useState(() =>
    applyRoomDirectoryToClimateConfig(initialConfig, directoryRooms),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [roomEditor, setRoomEditor] = useState<RoomEditorInitial | null>(null);
  const [rows, setRows] = useState(getSortedRows(initialEntries));
  // Анкор спотлайт-тура «Впишите показания»: инпуты строки «сегодня»,
  // если её нет в документе — первой строки. Тур берёт первый видимый.
  const tourRowId = rows.find((row) => row.date === todayKey)?.id ?? rows[0]?.id;
  const [documentTitle, setDocumentTitle] = useState(title);
  const [defaultResponsibleTitle, setDefaultResponsibleTitle] = useState(
    responsibleTitle
  );
  const [defaultResponsibleUserId, setDefaultResponsibleUserId] = useState(
    responsibleUserId
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  // История отмены (Ctrl+Z). Пока курсор в поле ввода, хоткей отдан
  // нативной отмене браузера — стек ловит уже сохранённые значения.
  const undoStack = useJournalUndo({ enabled: status === "active" });

  // Считаем из текущих строк, а не храним: исправленное значение убирает
  // отклонение из списка сразу, без перезагрузки страницы.
  const deviations = useMemo(
    () => collectClimateDeviations(config, rows),
    [config, rows],
  );

  /** Комментарий к отклонению. Сохраняем тем же путём, что и замеры. */
  async function saveCorrection(
    rowId: string,
    roomId: string,
    time: string,
    metric: "temperature" | "humidity",
    text: string,
  ) {
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const previousRow = row;
    const key = climateCorrectionKey(roomId, time, metric);

    const nextRow: RowItem = {
      ...row,
      data: {
        ...row.data,
        corrections: { ...(row.data.corrections ?? {}), [key]: text },
      },
    };

    setRows((current) =>
      current.map((item) => (item.id === rowId ? nextRow : item)),
    );
    try {
      await saveRow(nextRow);
    } catch (error) {
      setRows((current) =>
        current.map((item) => (item.id === rowId ? previousRow : item)),
      );
      toast.error(
        error instanceof Error ? error.message : "Ошибка сохранения",
      );
    }
  }
  const closeAction = useDocumentCloseAction({ documentId, title: documentTitle });
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const [responsibleDialogOpen, setResponsibleDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<ClimateRoomConfig | null>(null);
  const [editingResponsibleRow, setEditingResponsibleRow] = useState<RowItem | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [checkedAutoFill, setCheckedAutoFill] = useState(autoFill);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
    setRows(getSortedRows(initialEntries));
  }, [initialEntries]);

  useEffect(() => {
    setDocumentTitle(title);
  }, [title]);

  useEffect(() => {
    setDefaultResponsibleTitle(responsibleTitle);
  }, [responsibleTitle]);

  useEffect(() => {
    setDefaultResponsibleUserId(responsibleUserId);
  }, [responsibleUserId]);

  useEffect(() => {
    setCheckedAutoFill(autoFill);
  }, [autoFill]);

  const employeeMap = useMemo(
    () =>
      Object.fromEntries(
        employees.map((employee) => [employee.id, employee])
      ) as Record<string, EmployeeItem>,
    [employees]
  );

  const visibleRooms = useMemo(
    () => config.rooms.filter((room) => getRoomMetricColumnCount(room) > 0),
    [config.rooms]
  );

  const totalMeasurementColumns = useMemo(
    () =>
      visibleRooms.reduce(
        (total, room) =>
          total + config.controlTimes.length * getRoomMetricColumnCount(room),
        0
      ),
    [config.controlTimes.length, visibleRooms]
  );

  const allSelected =
    rows.length > 0 && selectedRowIds.length > 0 && selectedRowIds.length === rows.length;
  const { mobileView, switchMobileView } = useMobileView("climate_control");

  async function persistDocument(params: {
    title?: string;
    responsibleTitle?: string | null;
    responsibleUserId?: string | null;
    autoFill?: boolean;
    config?: ClimateDocumentConfig;
  }) {
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "Не удалось обновить документ");
    }
  }

  async function syncEntriesWithConfig(nextConfig: ClimateDocumentConfig) {
    const response = await fetch(`/api/journal-documents/${documentId}/climate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_entries" }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      throw new Error(result?.error || "Не удалось синхронизировать строки");
    }

    setConfig(nextConfig);
    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        data: syncClimateEntryDataWithConfig(row.data, nextConfig),
      }))
    );
  }

  async function handleSaveSettings(params: {
    title: string;
    responsibleTitle: string | null;
    responsibleUserId: string | null;
    config: ClimateDocumentConfig;
  }) {
    await persistDocument({
      title: params.title,
      responsibleTitle: params.responsibleTitle,
      responsibleUserId: params.responsibleUserId,
      config: params.config,
    });

    setDocumentTitle(params.title);
    setDefaultResponsibleTitle(params.responsibleTitle);
    setDefaultResponsibleUserId(params.responsibleUserId);
    await syncEntriesWithConfig(params.config);
  }

  async function handleSaveRoom(room: ClimateRoomConfig, linkRoomId?: string | null) {
    let nextRoom = room;
    if (linkRoomId) {
      // «Связать» legacy-строку с помещением справочника: id строки не
      // меняем (ключи замеров живы), имя/нормы дальше идут из Room.
      const dbRoom = directoryRooms.find((r) => r.id === linkRoomId);
      if (dbRoom) {
        nextRoom = { ...room, roomId: dbRoom.id, name: dbRoom.name };
        if (!normalizeClimateRoomNorms(dbRoom.climateNorms)) {
          // В карточке помещения норм ещё нет — переносим из строки,
          // чтобы ничего не потерялось.
          const res = await fetch(`/api/settings/rooms/${dbRoom.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              climateNorms: { temperature: room.temperature, humidity: room.humidity },
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error || "Не удалось сохранить нормы в карточку помещения");
          }
        }
      }
    }
    const exists = config.rooms.some((item) => item.id === nextRoom.id);
    const nextRooms = exists
      ? config.rooms.map((item) => (item.id === nextRoom.id ? nextRoom : item))
      : [...config.rooms, nextRoom];
    const nextConfig = applyRoomDirectoryToClimateConfig(
      normalizeClimateDocumentConfig({ ...config, rooms: nextRooms }),
      directoryRooms,
    );

    await persistDocument({ config: nextConfig });
    await syncEntriesWithConfig(nextConfig);
    if (linkRoomId) router.refresh();
  }

  /** Карандаш у помещения: со связью — карточка помещения, без — legacy-диалог. */
  function openRoomEditor(room: ClimateRoomConfig) {
    const dbRoom = room.roomId
      ? directoryRooms.find((r) => r.id === room.roomId)
      : undefined;
    if (dbRoom) {
      setRoomEditor(directoryRoomToEditorInitial(dbRoom));
      return;
    }
    setEditingRoom(room);
    setRoomDialogOpen(true);
  }

  /** Помещение из справочника → строка документа (id стабильный `room-<Room.id>`). */
  async function addRoomFromDirectory(room: DirectoryRoom) {
    const row = climateRoomFromDirectory(room);
    if (config.rooms.some((r) => r.id === row.id || r.roomId === room.id)) {
      toast.error("Это помещение уже есть в документе");
      return;
    }
    setEditingRoom(null);
    await handleSaveRoom(row);
  }

  async function handleDeleteRoom(roomId: string) {
    const nextConfig = normalizeClimateDocumentConfig({
      ...config,
      rooms: config.rooms.filter((room) => room.id !== roomId),
    });

    await persistDocument({ config: nextConfig });
    await syncEntriesWithConfig(nextConfig);
  }

  async function handleCreateRow(params: {
    employeeId: string;
    date: string;
    responsibleTitle: string | null;
  }) {
    if (!isDateWithinDocumentPeriod(params.date, dateFrom, dateTo)) {
      toast.error("Дата строки должна попадать в период документа.");
      return;
    }

    const duplicate = rows.some(
      (row) => row.employeeId === params.employeeId && row.date === params.date
    );
    if (duplicate) {
      toast.error("Для выбранной даты и сотрудника строка уже существует.");
      return;
    }

    const data = createEmptyClimateEntryData(config, params.responsibleTitle);
    const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: params.employeeId,
        date: params.date,
        data,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.entry) {
      throw new Error(result?.error || "Не удалось создать строку");
    }

    setRows((currentRows) =>
      getSortedRows([
        ...currentRows,
        {
          id: result.entry.id,
          employeeId: params.employeeId,
          date: params.date,
          data,
        },
      ])
    );
  }

  async function handleSaveResponsible(params: {
    rowId: string;
    employeeId: string;
    responsibleTitle: string | null;
  }) {
    const row = rows.find((item) => item.id === params.rowId);
    if (!row) return;

    const duplicate = rows.some(
      (item) =>
        item.id !== row.id &&
        item.employeeId === params.employeeId &&
        item.date === row.date
    );
    if (duplicate) {
      throw new Error("Для выбранной даты и сотрудника строка уже существует.");
    }

    const nextRow: RowItem = {
      ...row,
      employeeId: params.employeeId,
      data: {
        ...row.data,
        responsibleTitle: params.responsibleTitle,
      },
    };

    setRows((currentRows) =>
      currentRows.map((item) => (item.id === row.id ? nextRow : item))
    );

    try {
      await saveRow(nextRow);
    } catch (error) {
      setRows((currentRows) =>
        currentRows.map((item) => (item.id === row.id ? row : item))
      );
      throw error;
    }
  }

  /**
   * Откат/повтор из истории отмены. Пишем тем же PUT, что и обычная
   * правка, поэтому серверные запреты (закрытый день, права) действуют
   * сами; ошибка пробрасывается, чтобы протухший шаг вылетел из стека.
   */
  async function applyRowSilent(row: RowItem, fallback: RowItem) {
    setRows((currentRows) =>
      currentRows.map((item) => (item.id === row.id ? row : item))
    );
    try {
      await saveRow(row);
    } catch (error) {
      setRows((currentRows) =>
        currentRows.map((item) => (item.id === row.id ? fallback : item))
      );
      throw error;
    }
  }

  async function saveRow(nextRow: RowItem) {
    const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: nextRow.employeeId,
        date: nextRow.date,
        data: nextRow.data,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.entry) {
      throw new Error(result?.error || "Не удалось сохранить строку");
    }

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === nextRow.id
          ? { ...nextRow, id: result.entry.id }
          : row
      )
    );
  }

  async function handleMeasurementBlur(
    rowId: string,
    roomId: string,
    time: string,
    field: "temperature" | "humidity",
    rawValue: string
  ) {
    const nextValue = parseMetricInput(rawValue);
    const row = rows.find((item) => item.id === rowId);
    if (!row) return;
    const previousRow = row;

    const nextRow: RowItem = {
      ...row,
      data: {
        ...row.data,
        measurements: {
          ...row.data.measurements,
          [roomId]: {
            ...row.data.measurements[roomId],
            [time]: {
              temperature:
                field === "temperature"
                  ? nextValue
                  : row.data.measurements[roomId]?.[time]?.temperature ?? null,
              humidity:
                field === "humidity"
                  ? nextValue
                  : row.data.measurements[roomId]?.[time]?.humidity ?? null,
            },
          },
        },
      },
    };

    setRows((currentRows) =>
      currentRows.map((item) => (item.id === rowId ? nextRow : item))
    );

    try {
      await saveRow(nextRow);
      undoStack.push({
        undo: () => applyRowSilent(previousRow, nextRow),
        redo: () => applyRowSilent(nextRow, previousRow),
      });
    } catch (error) {
      setRows((currentRows) =>
        currentRows.map((item) => (item.id === rowId ? previousRow : item))
      );
      toast.error(error instanceof Error ? error.message : "Ошибка сохранения");
    }
  }

  function handleMeasurementChange(
    rowId: string,
    roomId: string,
    time: string,
    field: "temperature" | "humidity",
    rawValue: string
  ) {
    const nextValue = parseMetricInput(rawValue);

    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.id !== rowId) return row;

        return {
          ...row,
          data: {
            ...row.data,
            measurements: {
              ...row.data.measurements,
              [roomId]: {
                ...row.data.measurements[roomId],
                [time]: {
                  temperature:
                    field === "temperature"
                      ? nextValue
                      : row.data.measurements[roomId]?.[time]?.temperature ?? null,
                  humidity:
                    field === "humidity"
                      ? nextValue
                      : row.data.measurements[roomId]?.[time]?.humidity ?? null,
                },
              },
            },
          },
        };
      })
    );
  }

  async function handleDeleteSelected() {
    if (selectedRowIds.length === 0) return;
    const count = selectedRowIds.length;
    const confirmed = await confirmAsync({ title: "Удалить выбранные строки?", description: `Будет удалено строк: ${count}. Восстановить нельзя.`, variant: "danger", confirmLabel: "Удалить" });
    if (!confirmed) return;

    try {
      const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedRowIds }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Не удалось удалить строки");
      }

      setRows((currentRows) =>
        currentRows.filter((row) => !selectedRowIds.includes(row.id))
      );
      setSelectedRowIds([]);
      toast.success(`Удалено строк: ${count}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить выбранные строки");
    }
  }

  async function handleAutoFillChange(value: boolean) {
    setCheckedAutoFill(value);
    setIsSwitching(true);

    try {
      await persistDocument({ autoFill: value });

      if (value) {
        const response = await fetch(`/api/journal-documents/${documentId}/climate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "apply_auto_fill" }),
        });

        if (!response.ok) {
          const result = await response.json().catch(() => null);
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
   * Содержимое ячейки «Нормы условий» бумажной шапки (C1).
   *
   * Пусто + документ активен ⇒ одна синяя кнопка-ячейка «+ Добавить
   * помещение» во всю ширину (эталон climate_control-2-doc.png).
   * Иначе — вложенная таблица «Помещение / Температура / Влажность»
   * с карандашами редактирования и кнопкой добавления снизу.
   */
  const climateNormsBody =
    visibleRooms.length === 0 && status === "active" ? (
      <button
        type="button"
        onClick={() => {
          setPickerOpen(true);
        }}
        title="Добавить помещение с нормами температуры и влажности"
          data-tour={TOUR.addRoom}
        className={GRID_ADD_CELL_SOLID_CLASS}
      >
        <Plus className="size-4" strokeWidth={2.5} />
        Добавить помещение
      </button>
    ) : (
      /*
       * R5-5: ДВОЙНАЯ ВЕРТИКАЛЬНАЯ ЛИНИЯ по краям блока «Нормы условий».
       *
       * Таблица норм вложена в ячейку бумажной шапки, у которой своя
       * рамка (`GRID_CELL_CLASS`), и рисует ПОВЕРХ неё собственную —
       * две линии по 1px вплотную читаются как рамка 2px со смещением.
       * `border-collapse` схлопывает границы только ВНУТРИ одной
       * таблицы, на границу «родительский td ↔ вложенная table» он не
       * распространяется.
       *
       * Решение: рамку рисует РОВНО ОДНА из двух таблиц. Родительская
       * ячейка отдаёт свою (`p-0` без GRID_CELL_CLASS, см. место
       * вставки), контур бланка в этом месте держит внешний периметр
       * вложенной таблицы. Она `w-full` внутри ячейки без паддингов,
       * поэтому её края проходят ровно там, где раньше шла рамка
       * родителя — геометрия бланка не меняется, линия становится одна.
       */
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          {/* Служебная строка-шапка норм: без неё две правые колонки
              читались как безымянные диапазоны. Эталон подписывает их. */}
          <tr>
            <td
              className={`${GRID_CELL_CLASS} w-[220px] px-4 py-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6f7282] leading-tight print:text-black`}
            >
              Помещение
            </td>
            <td
              className={`${GRID_CELL_CLASS} w-1/2 px-4 py-1 text-center text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6f7282] leading-tight print:text-black`}
            >
              Температура °C
            </td>
            <td
              className={`${GRID_CELL_CLASS} w-1/2 px-4 py-1 text-center text-[12px] font-semibold uppercase tracking-[0.04em] text-[#6f7282] leading-tight print:text-black`}
            >
              Влажность, %
            </td>
          </tr>
          {visibleRooms.map((room) => (
            <tr key={room.id}>
              <td className={`${GRID_CELL_CLASS} w-[220px] px-4 py-2 leading-tight`}>
                <div className="flex items-center gap-3">
                  {/* Иллюстрация бланка «Точки контроля», а не контрол:
                      помещение в списке — значит контролируется. Кликать
                      нечего, поэтому pointer-events снят и от скринридера
                      скрыт. */}
                  {/* A6 аудита: на бумаге синий чекбокс — единственное
                      цветное пятно бланка и чистый интерфейсный артефакт
                      (нажать на распечатке нечего). Печатается только
                      название помещения. */}
                  <Checkbox
                    checked
                    aria-hidden
                    className="pointer-events-none print:hidden"
                    tabIndex={-1}
                  />
                  {/* R5-5: на бумаге «холодильный цех» ломался на две
                      строки и РАСПИРАЛ строку норм вдвое. В печати
                      чекбокс слева скрыт (print:hidden выше), то есть
                      ~36px ширины освобождается — название спокойно
                      встаёт в одну строку. На экране перенос оставляем:
                      там чекбокс на месте и место действительно нужно. */}
                  <span className="font-medium lowercase print:whitespace-nowrap">
                    {room.name}
                  </span>
                  {status === "active" && (
                    <button
                      type="button"
                      onClick={() => openRoomEditor(room)}
                      title={
                        room.roomId
                          ? "Карточка помещения — нормы, уборка, ответственные"
                          : "Изменить нормы помещения"
                      }
                      className="text-[#5566f6] transition-colors duration-150 hover:text-[#4a5bf0] print:hidden"
                    >
                      <Pencil className="size-4" />
                    </button>
                  )}
                  {status === "active" && !room.roomId && suggestDirectoryRoomForClimateRow(room, directoryRooms) ? (
                    <button
                      type="button"
                      onClick={() => {
                        const match = suggestDirectoryRoomForClimateRow(room, directoryRooms);
                        if (match) {
                          handleSaveRoom(room, match.id).catch((error) =>
                            toast.error(error instanceof Error ? error.message : "Не удалось связать помещение"),
                          );
                        }
                      }}
                      title="В справочнике есть помещение с таким же названием — связать, чтобы нормы и имя брались из карточки помещения"
                      className="rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] font-medium text-[#3848c7] transition-colors duration-150 hover:bg-[#eef1ff] print:hidden"
                    >
                      Связать
                    </button>
                  ) : null}
                </div>
              </td>
              <td className={`${GRID_CELL_CLASS} w-1/2 px-4 py-2 text-center leading-tight`}>
                {room.temperature.enabled
                  ? formatRange(room.temperature.min, room.temperature.max, "°C")
                  : "—"}
              </td>
              <td className={`${GRID_CELL_CLASS} w-1/2 px-4 py-2 text-center leading-tight`}>
                {room.humidity.enabled
                  ? formatRange(room.humidity.min, room.humidity.max, "%")
                  : "—"}
              </td>
            </tr>
          ))}
          {status === "active" && (
            <tr>
              <td colSpan={3} className={`${GRID_CELL_CLASS} p-0 leading-tight`}>
                <button
                  type="button"
                  onClick={() => {
                    setPickerOpen(true);
                  }}
                  title="Добавить помещение с нормами температуры и влажности"
          data-tour={TOUR.addRoom}
                  className={GRID_ADD_CELL_SOLID_CLASS}
                >
                  <Plus className="size-4" strokeWidth={2.5} />
                  Добавить помещение
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    );

  return (
    <div className="bg-white text-black">
      <FocusTodayScroller
        always
        onCreate={
          status === "active" ? () => setRowDialogOpen(true) : undefined
        }
      />
      {/* Q3: верхнего padding'а нет — зазор «крошки → H1» задаёт
          `space-y-3` контейнера раздела (12px), общий для всех 13. */}
      <div className="pb-4 sm:pb-8">
        <DocumentActionsBar
          backHref="/journals/climate_control"
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
                    key: "close-journal",
                    label: "Закончить журнал",
                    icon: <Archive className="size-4" />,
                    onSelect: () => void closeAction.closeDocument(),
                    disabled: closeAction.isClosing,
                  },
                ]
              : []
          }
        />
        {status !== "active" ? (
          <div className="mb-8">
            <JournalClosedBanner hint="Откройте журнал заново, чтобы редактировать строки." />
          </div>
        ) : null}

        {/* C2 аудита: у эталона выключенный тумблер = ТОЛЬКО полоса.
            Раскрывать здесь больше нечего — «Нормы условий» и «Частота
            контроля» уехали строками в бумажную шапку (C1), чекбокс
            «Не заполнять в выходные дни» — в «Настройки журнала» (C3). */}
        {/* Q3: единый токен-лента вместо локального r24 + py-5. */}
        <div className={DOC_AUTOFILL_STRIP_CLASS} data-tour={TOUR.autofill}>
          <Switch
            checked={checkedAutoFill}
            onCheckedChange={handleAutoFillChange}
            disabled={status !== "active" || isSwitching}
            className="data-[state=unchecked]:bg-[#d6d9ee]"
          />
          <span className={`min-w-0 ${DOC_AUTOFILL_LABEL_CLASS}`}>
            Автоматически заполнять журнал
          </span>
        </div>

        {/* R1: бумажное полотно — во всю ширину контентной колонки.
            Широкая сетка климата (min-w 1280) скроллится внутри своего
            GRID_VIEWPORT_CLASS, который лежит ВНУТРИ полотна. */}

        <div className="mb-4 sm:hidden print:hidden">
          <MobileViewToggle
            mobileView={mobileView}
            onChange={switchMobileView}
            dataTour={TOUR.viewToggle}
          />
        </div>

        <div className={DOC_PAPER_CANVAS_CLASS}>
        {/* Бумажная ХАССП-шапка — САМОСТОЯТЕЛЬНЫЙ блок под полосой
            тумблера. Раньше она жила ВНУТРИ раскрывающейся панели
            автозаполнения, и при свёрнутой панели журнал оставался вообще
            без шапки. В панели теперь только инпуты норм. */}
        {/* A9 аудита: шапка получила ТУ ЖЕ минимальную ширину, что и
            сетка замеров (1280px). Раньше шапка была `w-full` по полотну
            (~1046px), а сетка — `min-w-[1280px]`: правая вертикаль бланка
            расходилась на ~230px, и правая часть сетки («Холодильный цех»,
            «Ответственный») выглядела просто ОБРЕЗАННОЙ — пользователь не
            понимал, что её надо доскроллить. Теперь обе таблицы одной
            ширины и обе живут в `GRID_VIEWPORT_CLASS` с постоянно видимой
            полосой прокрутки (`GRID_VIEWPORT_SCROLLBAR_CLASS`). */}
        <div className={`${DOC_PAPER_HEADER_CLASS} ${GRID_VIEWPORT_CLASS}`}>
          <table className="w-full min-w-[1280px] border-collapse text-[13px] text-[#0b1024]">
            <tbody>
              <JournalPaperHeaderRows
                orgName={organizationName}
                title="БЛАНК КОНТРОЛЯ ТЕМПЕРАТУРЫ И ВЛАЖНОСТИ"
                startedAt={dateFrom}
                finishedAt={status === "closed" ? dateTo : null}
                controlPeriodicity={controlPeriodicity}
              />
              {/* C1 аудита: «Нормы условий» и «Частота контроля» — это
                  СТРОКИ бумажной шапки (одна таблица, общая рамка, видны
                  всегда), а не карточка в раскрывающейся панели
                  автозаполнения. Редактирование осталось прежним:
                  карандаш → RoomDialog, «Добавить частоту контроля» →
                  «Настройки журнала». */}
              <tr>
                <td
                  className={`${GRID_HEAD_CELL_CLASS} w-[20%] px-3 py-2 text-center text-[13px] font-semibold leading-tight`}
                >
                  Нормы условий
                </td>
                {/* R5-5: БЕЗ `GRID_CELL_CLASS` — рамку этой ячейки рисует
                    вложенная таблица норм (см. `climateNormsBody`).
                    Пока рамки были у обеих, по краям блока «Нормы
                    условий» шла двойная вертикальная линия. */}
                <td colSpan={2} data-print-flush className="p-0 leading-tight">
                  {climateNormsBody}
                </td>
              </tr>
              <tr>
                {/* C6: подпись серая (GRID_HEAD_CELL_CLASS) и прижата
                    влево — как на эталоне climate_control-2-doc.png. */}
                <td
                  className={`${GRID_HEAD_CELL_CLASS} px-3 py-2 text-left text-[13px] font-semibold leading-tight`}
                >
                  Частота контроля
                </td>
                {config.controlTimes.length === 0 && status === "active" ? (
                  <td colSpan={2} className={`${GRID_CELL_CLASS} p-0 leading-tight`}>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      title="Задать время замеров — сколько раз в смену снимаются показатели"
                      className={GRID_ADD_CELL_SOLID_CLASS}
                    >
                      <Plus className="size-4" strokeWidth={2.5} />
                      Добавить частоту контроля
                    </button>
                  </td>
                ) : (
                  <td
                    colSpan={2}
                    className={`${GRID_CELL_CLASS} px-3 py-2 text-center text-[13px] leading-tight`}
                  >
                    {getClimatePeriodicityText(config)}
                  </td>
                )}
              </tr>
              {/* Строки «Ответственный за снятие показателей» здесь нет
                  сознательно: эталон climate_control-grid.png её не
                  печатает — ответственный ведётся колонкой «Фамилия
                  ответственного лица» в самой таблице замеров.
                  (У cold_equipment строка остаётся.) */}
            </tbody>
          </table>
        </div>

        <JournalDocumentTitle className={DOC_CAPS_TITLE_CLASS}>
          {CLIMATE_DOCUMENT_TITLE}
        </JournalDocumentTitle>

        {/* Область применения и периодичность — прямо в бланке, а не в
            справке: журнал заполняет сменный сотрудник, и он должен
            видеть, что сюда вносят только склады с продуктами и что
            пропущенный день считается нарушением. */}
        <p className="mt-1 text-center text-[12px] leading-snug text-[#6f7282] print:text-[10px]">
          {CLIMATE_SCOPE_HINT} {CLIMATE_FREQUENCY_HINT}
        </p>

        {deviations.length > 0 ? (
          <section className="mt-6">
            <JournalDocumentTitle className={DOC_CAPS_TITLE_CLASS}>
              Корректирующие действия
            </JournalDocumentTitle>
            <p className="mt-1 text-center text-[12px] leading-snug text-[#a13a32] print:text-[10px]">
              Показатель вышел за норму — опишите, что сделали. Пустая графа
              при проверке читается как «нарушение заметили и проигнорировали».
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={`${GRID_CELL_CLASS} w-[110px] px-2 py-1.5 font-semibold text-[#3c4053]`}>
                      Дата
                    </th>
                    <th className={`${GRID_CELL_CLASS} w-[80px] px-2 py-1.5 font-semibold text-[#3c4053]`}>
                      Время
                    </th>
                    <th className={`${GRID_CELL_CLASS} w-[160px] px-2 py-1.5 font-semibold text-[#3c4053]`}>
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
                        {getClimateDateLabel(d.date)}
                      </td>
                      <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center tabular-nums`}>
                        {d.time}
                      </td>
                      <td className={`${GRID_CELL_CLASS} px-2 py-1`}>{d.roomName}</td>
                      <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center font-medium text-[#d2453d]`}>
                        {d.metric === "temperature" ? "T" : "ВВ"}, {d.value}
                        {d.metric === "temperature" ? " °C" : " %"}
                        <span className="ml-1 text-[11px] font-normal text-[#a13a32]">
                          (норма {d.min ?? "—"}–{d.max ?? "—"})
                        </span>
                      </td>
                      <td className={`${GRID_CELL_CLASS} p-0`}>
                        <Input
                          defaultValue={d.comment}
                          placeholder="Что сделали: проветрили, вызвали мастера…"
                          disabled={status !== "active"}
                          onBlur={(event) =>
                            void saveCorrection(
                              d.rowId,
                              d.roomId,
                              d.time,
                              d.metric,
                              event.target.value,
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

        {status === "active" && (
          <StickyActionBar>
            <Button
              type="button"
              onClick={() => setRowDialogOpen(true)}
              data-tour={TOUR.addRow}
              className="h-11 gap-2 rounded-lg bg-[#5566f6] px-5 text-[15px] font-semibold text-white hover:bg-[#4a5bf0]"
            >
              <Plus className="size-5" strokeWidth={2.5} />
              Добавить строку
            </Button>

          </StickyActionBar>
        )}

        {status === "active" ? (
          <JournalSelectionBar
            count={selectedRowIds.length}
            onClear={() => setSelectedRowIds([])}
            onDelete={handleDeleteSelected}
            hint="Строки замеров будут удалены без возможности отмены"
          />
        ) : null}


        {mobileView === "cards" ? (
          <RecordCardsView
            items={rows.map((row, index) => {
              const employee = employeeMap[row.employeeId];
              return {
                id: row.id,
                title: `№${index + 1} · ${getClimateDateLabel(row.date)}`,
                subtitle: employee?.name || undefined,
                leading: status === "active" ? (
                  <Checkbox
                    checked={selectedRowIds.includes(row.id)}
                    onCheckedChange={(checked) =>
                      setSelectedRowIds((current) =>
                        checked === true
                          ? [...new Set([...current, row.id])]
                          : current.filter((value) => value !== row.id)
                      )
                    }
                    className="size-5"
                  />
                ) : null,
                fields: visibleRooms.map((room) => {
                  const measurements = row.data.measurements[room.id] || {};
                  const lines = config.controlTimes
                    .map((time) => {
                      const m = measurements[time] || {};
                      const parts: string[] = [];
                      if (room.temperature.enabled && m.temperature != null) {
                        parts.push(`T ${m.temperature}°`);
                      }
                      if (room.humidity.enabled && m.humidity != null) {
                        parts.push(`ВВ ${m.humidity}%`);
                      }
                      return parts.length > 0 ? `${time}: ${parts.join(" / ")}` : null;
                    })
                    .filter((s): s is string => s !== null);
                  return {
                    label: room.name,
                    value: lines.length > 0 ? lines.join(" · ") : "",
                    hideIfEmpty: false,
                    hint: status === "active"
                      ? "Редактирование — во вкладке Таблица"
                      : undefined,
                  };
                }),
              };
            })}
            emptyLabel="Записей по микроклимату нет."
          />
        ) : null}

        <MobileViewTableWrapper mobileView={mobileView} className={GRID_VIEWPORT_CLASS}>
          <table className="w-full min-w-[1280px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className={`${GRID_HEAD_CELL_CLASS} w-[44px] px-2 py-1.5 text-center leading-tight print:hidden`} rowSpan={4}>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelectedRowIds(
                        checked === true ? rows.map((row) => row.id) : []
                      )
                    }
                    disabled={status !== "active" || rows.length === 0}
                  />
                </th>
                <th className={`${GRID_HEAD_CELL_CLASS} w-[140px] px-2 py-1.5 text-center font-semibold leading-tight`} rowSpan={4}>
                  Дата
                </th>
                <th className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`} colSpan={totalMeasurementColumns}>
                  Точки контроля
                </th>
                <th className={`${GRID_HEAD_CELL_CLASS} w-[260px] px-2 py-1.5 text-center font-semibold leading-tight`} rowSpan={4}>
                  Фамилия ответственного лица
                </th>
              </tr>
              <tr>
                {visibleRooms.map((room) => (
                  <th
                    key={room.id}
                    className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                    colSpan={config.controlTimes.length * getRoomMetricColumnCount(room)}
                  >
                    {room.name}
                  </th>
                ))}
              </tr>
              <tr>
                {visibleRooms.flatMap((room) =>
                  config.controlTimes.map((time) => (
                    <th
                      key={`${room.id}:${time}`}
                      className={`${GRID_HEAD_CELL_CLASS} px-2 py-1.5 text-center font-semibold leading-tight`}
                      colSpan={getRoomMetricColumnCount(room)}
                    >
                      {time}
                    </th>
                  ))
                )}
              </tr>
              <tr>
                {visibleRooms.flatMap((room) =>
                  config.controlTimes.flatMap((time) => [
                    room.temperature.enabled ? (
                      <th
                        key={`${room.id}:${time}:temperature`}
                        className={`${GRID_HEAD_CELL_CLASS} w-[110px] px-2 py-1.5 text-center font-semibold leading-tight`}
                      >
                        T, °C
                      </th>
                    ) : null,
                    room.humidity.enabled ? (
                      <th
                        key={`${room.id}:${time}:humidity`}
                        className={`${GRID_HEAD_CELL_CLASS} w-[110px] px-2 py-1.5 text-center font-semibold leading-tight`}
                      >
                        ВВ, %
                      </th>
                    ) : null,
                  ])
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const employee = employeeMap[row.employeeId];
                const isToday = row.date === todayKey;
                return (
                  <tr
                    key={row.id}
                    data-focus-today={isToday ? "" : undefined}
                    className={isToday ? "bg-[#f5f6ff]" : undefined}
                  >
                    <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight print:hidden`}>
                      <Checkbox
                        checked={selectedRowIds.includes(row.id)}
                        onCheckedChange={(checked) =>
                          setSelectedRowIds((current) =>
                            checked === true
                              ? [...new Set([...current, row.id])]
                              : current.filter((value) => value !== row.id)
                          )
                        }
                        disabled={status !== "active"}
                      />
                    </td>
                    <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`}>
                      {getClimateDateLabel(row.date)}
                      {isToday ? (
                        <span className="mt-0.5 block text-[11px] font-semibold text-[#3848c7] print:hidden">
                          сегодня
                        </span>
                      ) : null}
                    </td>
                    {visibleRooms.flatMap((room) =>
                      config.controlTimes.flatMap((time) => [
                        room.temperature.enabled ? (
                          <td
                            key={`${row.id}:${room.id}:${time}:temperature`}
                            className={`${GRID_CELL_CLASS} p-1 text-center leading-tight`}
                          >
                            {status === "active" ? (
                              <Input
                                type="number"
                                step="0.1"
                                data-tour={row.id === tourRowId ? TOUR.measureInput : undefined}
                                value={row.data.measurements[room.id]?.[time]?.temperature ?? ""}
                                onChange={(event) =>
                                  handleMeasurementChange(
                                    row.id,
                                    room.id,
                                    time,
                                    "temperature",
                                    event.target.value
                                  )
                                }
                                onBlur={(event) =>
                                  handleMeasurementBlur(
                                    row.id,
                                    room.id,
                                    time,
                                    "temperature",
                                    event.target.value
                                  )
                                }
                                className={cn(
                                  "h-10 min-w-[88px] border-0 px-2 text-center shadow-none focus-visible:ring-1",
                                  isClimateValueOutOfRange(
                                    row.data.measurements[room.id]?.[time]?.temperature,
                                    room.temperature
                                  ) && "font-semibold text-[#d2453d]"
                                )}
                              />
                            ) : (
                              row.data.measurements[room.id]?.[time]?.temperature ?? ""
                            )}
                          </td>
                        ) : null,
                        room.humidity.enabled ? (
                          <td
                            key={`${row.id}:${room.id}:${time}:humidity`}
                            className={`${GRID_CELL_CLASS} p-1 text-center leading-tight`}
                          >
                            {status === "active" ? (
                              <Input
                                type="number"
                                step="0.1"
                                data-tour={row.id === tourRowId ? TOUR.measureInput : undefined}
                                value={row.data.measurements[room.id]?.[time]?.humidity ?? ""}
                                onChange={(event) =>
                                  handleMeasurementChange(
                                    row.id,
                                    room.id,
                                    time,
                                    "humidity",
                                    event.target.value
                                  )
                                }
                                onBlur={(event) =>
                                  handleMeasurementBlur(
                                    row.id,
                                    room.id,
                                    time,
                                    "humidity",
                                    event.target.value
                                  )
                                }
                                className={cn(
                                  "h-10 min-w-[88px] border-0 px-2 text-center shadow-none focus-visible:ring-1",
                                  isClimateValueOutOfRange(
                                    row.data.measurements[room.id]?.[time]?.humidity,
                                    room.humidity
                                  ) && "font-semibold text-[#d2453d]"
                                )}
                              />
                            ) : (
                              row.data.measurements[room.id]?.[time]?.humidity ?? ""
                            )}
                          </td>
                        ) : null,
                      ])
                    )}
                    <td className={`${GRID_CELL_CLASS} px-2 py-1 text-center leading-tight`}>
                      <button
                        type="button"
                        disabled={status !== "active"}
                        onClick={() => {
                          setEditingResponsibleRow(row);
                          setResponsibleDialogOpen(true);
                        }}
                        className={`w-full text-center ${status === "active" ? "cursor-pointer hover:text-[5566f6]" : ""}`}
                      >
                        <div className="font-medium">{employee?.name || "—"}</div>
                        <div className="text-[13px] text-[#6f7282]">
                          {row.data.responsibleTitle || defaultResponsibleTitle || ""}
                        </div>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={3 + totalMeasurementColumns}
                    className={`${GRID_CELL_CLASS} px-4 py-10 text-center text-[13px] text-[#6f7282] leading-tight`}
                  >
                    Пока нет строк. Добавь первую запись вручную или включи автозаполнение.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </MobileViewTableWrapper>
        </div>
      </div>

      <JournalSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={documentTitle}
        responsibleTitle={defaultResponsibleTitle}
        responsibleUserId={defaultResponsibleUserId}
        employees={employees}
        config={config}
        onSave={handleSaveSettings}
        useV2={useV2}
      />

      <RoomDialog
        open={roomDialogOpen}
        onOpenChange={(value) => {
          setRoomDialogOpen(value);
          if (!value) setEditingRoom(null);
        }}
        initialRoom={editingRoom}
        canDelete={config.rooms.length > 1}
        linkOptions={listClimateRoomsNotInDocument(config, directoryRooms)}
        onSave={handleSaveRoom}
        onDelete={handleDeleteRoom}
      />

      {/* Единый справочник помещений: добавить из /settings/buildings или
          создать новое — и сразу открыть его карточку. */}
      <RoomDirectoryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        buildings={buildings}
        excludeRoomIds={config.rooms.map((r) => r.roomId).filter((id): id is string => Boolean(id))}
        hint="Помещения общие для всех журналов. Нормы температуры и влажности задаются в карточке помещения."
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
        focus="climate"
        users={employees}
        onSaved={async (snapshot) => {
          // Имя и нормы строки — из карточки (snapshot), без ожидания
          // router.refresh(); ключ строки не меняется.
          const row = config.rooms.find((r) => r.roomId === snapshot.id);
          if (row) {
            const next: ClimateRoomConfig = {
              ...row,
              name: snapshot.name,
              ...(snapshot.climateNorms
                ? {
                    temperature: snapshot.climateNorms.temperature,
                    humidity: snapshot.climateNorms.humidity,
                  }
                : {}),
            };
            try {
              await handleSaveRoom(next);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Не удалось обновить строку");
            }
          }
          router.refresh();
        }}
      />

      <AddRowDialog
        open={rowDialogOpen}
        onOpenChange={setRowDialogOpen}
        employees={employees}
        defaultResponsibleTitle={defaultResponsibleTitle}
        defaultResponsibleUserId={defaultResponsibleUserId}
        onCreate={handleCreateRow}
      />

      <ResponsibleDialog
        open={responsibleDialogOpen}
        onOpenChange={(value) => {
          setResponsibleDialogOpen(value);
          if (!value) setEditingResponsibleRow(null);
        }}
        row={editingResponsibleRow}
        employees={employees}
        defaultResponsibleTitle={defaultResponsibleTitle}
        defaultResponsibleUserId={defaultResponsibleUserId}
        onSave={handleSaveResponsible}
      />
    </div>
  );
}
