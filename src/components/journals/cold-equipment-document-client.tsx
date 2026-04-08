"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Printer,
  Settings2,
  Trash2,
} from "lucide-react";
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
  getWeekdayShort,
  getHygienePositionLabel,
  isWeekend,
} from "@/lib/hygiene-document";

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
  dateFrom: string;
  dateTo: string;
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  status: string;
  autoFill?: boolean;
  employees: EmployeeItem[];
  config: ColdEquipmentDocumentConfig;
  initialEntries: EntryRow[];
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

  if (defaultResponsibleUserId) {
    usedIds.add(defaultResponsibleUserId);
  }

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialItem?.name || "");
    setMin(initialItem?.min?.toString() || "");
    setMax(initialItem?.max?.toString() || "");
  }, [initialItem, open]);

  async function handleSave() {
    const item = createColdEquipmentConfigItem({
      id: initialItem?.id,
      sourceEquipmentId: initialItem?.sourceEquipmentId || null,
      name,
      min: min === "" ? null : Number(min),
      max: max === "" ? null : Number(max),
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
      <DialogContent className="max-w-[760px] rounded-[32px] border-0 p-0">
        <DialogHeader className="border-b px-12 py-10">
          <DialogTitle className="text-[32px] font-medium text-black">
            {initialItem ? "Редактирование оборудования" : "Добавление оборудования"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-7 px-12 py-10">
          <div className="space-y-3">
            <Label htmlFor="equipment-name" className="text-[18px] text-[#73738a]">
              Наименование
            </Label>
            <Input
              id="equipment-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Холодильная камера"
              className="h-18 rounded-3xl border-[#dfe1ec] px-6 text-[20px]"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="equipment-min" className="text-[18px] text-[#73738a]">
                Температура от
              </Label>
              <Input
                id="equipment-min"
                type="number"
                value={min}
                onChange={(event) => setMin(event.target.value)}
                className="h-18 rounded-3xl border-[#dfe1ec] px-6 text-[20px]"
              />
            </div>
            <div className="space-y-3">
              <Label htmlFor="equipment-max" className="text-[18px] text-[#73738a]">
                Температура до
              </Label>
              <Input
                id="equipment-max"
                type="number"
                value={max}
                onChange={(event) => setMax(event.target.value)}
                className="h-18 rounded-3xl border-[#dfe1ec] px-6 text-[20px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {initialItem && canDelete && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="h-14 rounded-2xl border-[#ffd7d3] px-6 text-[18px] text-[#ff3b30] hover:bg-[#fff3f2]"
                >
                  Удалить строку
                </Button>
              )}
            </div>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || name.trim() === ""}
              className="h-14 rounded-2xl bg-[#5b66ff] px-8 text-[18px] text-white hover:bg-[#4b57ff]"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] rounded-[32px] border-0 p-0">
        <DialogHeader className="border-b px-14 py-12">
          <DialogTitle className="text-[32px] font-medium text-black">
            Настройки журнала
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-8 px-14 py-12">
          <div className="space-y-3">
            <Label htmlFor="journal-title" className="sr-only">
              Название журнала
            </Label>
            <Input
              id="journal-title"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-22 rounded-3xl border-[#dfe1ec] px-8 text-[24px]"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">
                Должность ответственного
              </Label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger className="h-18 rounded-3xl border-[#dfe1ec] bg-[#f3f4fb] px-6 text-[20px]">
                  <SelectValue placeholder="Выберите должность" />
                </SelectTrigger>
                <SelectContent>
                  {titleOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">
                Сотрудник по умолчанию
              </Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger className="h-18 rounded-3xl border-[#dfe1ec] bg-[#f3f4fb] px-6 text-[20px]">
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-3xl border border-[#dfe1ec] px-8 py-6">
            <Checkbox
              id="skip-weekends"
              checked={skipWeekends}
              onCheckedChange={(checked) => setSkipWeekends(checked === true)}
            />
            <Label
              htmlFor="skip-weekends"
              className="cursor-pointer text-[18px] font-normal text-black"
            >
              Не заполнять автоматически в выходные дни
            </Label>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="h-16 rounded-3xl bg-[#5b66ff] px-10 text-[18px] text-white hover:bg-[#4b57ff]"
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
  dateFrom,
  dateTo,
  responsibleTitle,
  responsibleUserId,
  status,
  autoFill = false,
  employees,
  config,
  initialEntries,
}: Props) {
  const router = useRouter();
  const [documentTitle, setDocumentTitle] = useState(title);
  const [rows, setRows] = useState<EntryRow[]>(initialEntries);
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>([]);
  const [checkedAutoFill, setCheckedAutoFill] = useState(autoFill);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<ColdEquipmentConfigItem | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const dateKeys = useMemo(() => buildDateKeys(dateFrom, dateTo), [dateFrom, dateTo]);
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
      window.alert("В журнале должна остаться хотя бы одна строка оборудования.");
      return;
    }

    await persistDocument({
      config: {
        ...config,
        equipment: nextEquipment,
      },
    });
    await syncEntries();
    setSelectedEquipmentIds((current) => current.filter((value) => value !== itemId));
    router.refresh();
  }

  async function handleDeleteSelectedEquipment() {
    if (selectedEquipmentIds.length === 0) return;
    const nextEquipment = config.equipment.filter(
      (item) => !selectedEquipmentIds.includes(item.id)
    );

    if (nextEquipment.length === 0) {
      window.alert("В журнале должна остаться хотя бы одна строка оборудования.");
      return;
    }

    const confirmed = window.confirm("Удалить выбранные строки оборудования?");
    if (!confirmed) return;

    await persistDocument({
      config: {
        ...config,
        equipment: nextEquipment,
      },
    });
    await syncEntries();
    setSelectedEquipmentIds([]);
    router.refresh();
  }

  async function handleAutoFillChange(value: boolean) {
    setCheckedAutoFill(value);
    setIsSwitching(true);

    try {
      await persistDocument({ autoFill: value });

      if (value) {
        const response = await fetch(
          `/api/journal-documents/${documentId}/cold-equipment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "apply_auto_fill" }),
          }
        );

        if (!response.ok) {
          const result = await response.json().catch(() => null);
          throw new Error(result?.error || "Не удалось применить автозаполнение");
        }
      }

      router.refresh();
    } catch (error) {
      setCheckedAutoFill(!value);
      window.alert(
        error instanceof Error
          ? error.message
          : "Ошибка обновления автозаполнения"
      );
    } finally {
      setIsSwitching(false);
    }
  }

  async function handleTemperatureBlur(
    dateKey: string,
    equipmentId: string,
    rawValue: string
  ) {
    const employeeId = rowByDate[dateKey]?.employeeId || responsibleUserId || employees[0]?.id;

    if (!employeeId) {
      window.alert("Нет сотрудника, которого можно назначить ответственным.");
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

    const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId,
        date: dateKey,
        data: nextData,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.entry) {
      window.alert(result?.error || "Не удалось сохранить значение");
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
  }

  return (
    <div className="bg-white text-black">
      <div className="mx-auto max-w-[1880px] px-6 py-8">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="text-[16px] text-[#7b7d8d]">{organizationName}</div>
            <h1 className="mt-2 text-[48px] font-semibold tracking-[-0.04em] text-black">
              {documentTitle}
            </h1>
            <div className="mt-3 text-[18px] text-[#63667a]">
              Период: {getColdEquipmentDateLabel(dateFrom)} - {getColdEquipmentDateLabel(dateTo)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                window.open(`/api/journal-documents/${documentId}/pdf`, "_blank")
              }
              className="h-16 rounded-2xl border-[#eef0fb] px-7 text-[18px] text-[#5464ff] shadow-none hover:bg-[#f8f9ff]"
            >
              <Printer className="size-6" />
              Печать
            </Button>
            {status === "active" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettingsOpen(true)}
                className="h-16 rounded-2xl border-[#eef0fb] px-7 text-[18px] text-[#5464ff] shadow-none hover:bg-[#f8f9ff]"
              >
                <Settings2 className="size-6" />
                Настройки журнала
              </Button>
            )}
          </div>
        </div>

        <div className="mb-10 rounded-[24px] bg-[#f3f4fe] px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Switch
                checked={checkedAutoFill}
                onCheckedChange={handleAutoFillChange}
                disabled={status !== "active" || isSwitching}
                className="h-10 w-16 data-[state=checked]:bg-[#5b66ff] data-[state=unchecked]:bg-[#d6d9ee]"
              />
              <span className="text-[20px] font-medium text-black">
                Автоматически заполнять журнал
              </span>
            </div>

            <button
              type="button"
              onClick={() => setSummaryOpen((value) => !value)}
              className="flex size-11 items-center justify-center rounded-full text-[#5b66ff] hover:bg-white/70"
            >
              {summaryOpen ? (
                <ChevronUp className="size-7" />
              ) : (
                <ChevronDown className="size-7" />
              )}
            </button>
          </div>

          {summaryOpen && (
            <div className="mt-6 space-y-6">
              <div className="flex flex-wrap gap-8 text-[20px]">
                {config.equipment.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl bg-white/70 px-5 py-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="font-medium text-black">{item.name}</div>
                      {status === "active" && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingEquipment(item);
                            setEquipmentDialogOpen(true);
                          }}
                          className="text-[#5b66ff] hover:text-[#3f49d8]"
                        >
                          <Pencil className="size-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-3 text-[17px] text-[#4a4d63]">
                      {formatRange(item.min, item.max)}
                    </div>
                  </div>
                ))}
              </div>

              {config.skipWeekends && (
                <div className="text-[18px] text-[#44485d]">
                  Автозаполнение не создаёт записи по выходным дням.
                </div>
              )}
            </div>
          )}
        </div>

        {status === "active" && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                setEditingEquipment(null);
                setEquipmentDialogOpen(true);
              }}
              className="h-16 rounded-2xl bg-[#5b66ff] px-8 text-[18px] text-white hover:bg-[#4b57ff]"
            >
              <Plus className="size-7" />
              Добавить оборудование
            </Button>

            {selectedEquipmentIds.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteSelectedEquipment}
                className="h-16 rounded-2xl border-[#ffd7d3] px-8 text-[18px] text-[#ff3b30] hover:bg-[#fff3f2]"
              >
                <Trash2 className="size-6" />
                Удалить выбранные
              </Button>
            )}
          </div>
        )}

        <div className="overflow-x-auto rounded-[28px] border border-[#ececf4]">
          <table className="min-w-[1800px] border-collapse text-[14px]">
            <thead>
              <tr className="bg-[#f2f2f2]">
                <th
                  className="w-[44px] border border-black p-2 text-center"
                  rowSpan={2}
                >
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
                  className="min-w-[320px] border border-black p-2 text-center font-semibold"
                  rowSpan={2}
                >
                  Наименование или номер ХО
                </th>
                <th
                  className="border border-black p-2 text-right font-semibold"
                  colSpan={dateKeys.length}
                >
                  Месяц {new Date(`${dateKeys[0]}T00:00:00Z`).toLocaleDateString("ru-RU", {
                    month: "long",
                    year: "numeric",
                  })}
                </th>
              </tr>
              <tr className="bg-[#f2f2f2]">
                {dateKeys.map((dateKey) => (
                  <th
                    key={dateKey}
                    className={`w-[56px] border border-black p-2 text-center font-semibold ${
                      isWeekend(dateKey) ? "bg-[#eceffd]" : ""
                    }`}
                  >
                    <div>{getDayNumber(dateKey)}</div>
                    <div className="text-[10px] font-normal uppercase text-[#666]">
                      {getWeekdayShort(dateKey)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black p-2" />
                <td
                  className="border border-black p-2 text-center text-[13px] font-semibold"
                  colSpan={dateKeys.length + 1}
                >
                  Температура, °C
                </td>
              </tr>

              {config.equipment.map((item) => (
                <tr key={item.id}>
                  <td className="border border-black p-2 text-center">
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
                  <td className="border border-black px-4 py-3">
                    <div className="font-medium">{item.name}</div>
                    <div className="mt-1 text-[12px] text-[#666a80]">
                      {formatRange(item.min, item.max)}
                    </div>
                  </td>
                  {dateKeys.map((dateKey) => {
                    const row = rowByDate[dateKey];
                    const value = row?.data.temperatures[item.id];

                    return (
                      <td
                        key={`${item.id}:${dateKey}`}
                        className={`border border-black p-1 text-center ${
                          isWeekend(dateKey) ? "bg-[#fafbff]" : ""
                        }`}
                      >
                        {status === "active" ? (
                          <Input
                            type="number"
                            step="0.1"
                            defaultValue={value ?? ""}
                            onBlur={(event) =>
                              handleTemperatureBlur(dateKey, item.id, event.target.value)
                            }
                            className="h-10 min-w-[52px] border-0 px-1 text-center shadow-none focus-visible:ring-1"
                          />
                        ) : (
                          value ?? ""
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              <tr>
                <td className="border border-black p-2 text-center" />
                <td className="border border-black px-4 py-3 align-top">
                  <div className="font-medium">Ответственный за снятие показателей</div>
                  <div className="mt-2 space-y-1 text-[12px] text-[#4f5368]">
                    {responsibleCodes.items.map((item) => (
                      <div key={item.employeeId}>{item.label}</div>
                    ))}
                  </div>
                </td>
                {dateKeys.map((dateKey) => {
                  const row = rowByDate[dateKey];
                  const employeeId = row?.employeeId || responsibleUserId || "";

                  return (
                    <td
                      key={`responsible:${dateKey}`}
                      className={`border border-black p-2 text-center text-[12px] font-medium ${
                        isWeekend(dateKey) ? "bg-[#fafbff]" : ""
                      }`}
                    >
                      {employeeId ? responsibleCodes.codeMap[employeeId] || "" : ""}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
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
