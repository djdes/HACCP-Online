"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getHygienePositionLabel } from "@/lib/hygiene-document";

type EmployeeItem = {
  id: string;
  name: string;
  role: string;
};

type FieldOption = {
  value: string;
  label: string;
};

type FieldItem = {
  key: string;
  label: string;
  type: string;
  options: FieldOption[];
};

type EntryItem = {
  id: string;
  employeeId: string;
  date: string;
  data: Record<string, unknown>;
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
  employees: EmployeeItem[];
  fields: FieldItem[];
  initialEntries: EntryItem[];
};

function formatDateLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}.${month}.${year}`;
}

function fieldValueToString(value: unknown) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function isSelectLikeField(field: FieldItem) {
  return field.type === "select" || field.type === "employee" || field.type === "equipment";
}

function getSortedEntries(entries: EntryItem[]) {
  return [...entries].sort((left, right) => {
    if (left.date !== right.date) return left.date.localeCompare(right.date);
    return left.employeeId.localeCompare(right.employeeId);
  });
}

function AddRowDialog({
  open,
  onOpenChange,
  employees,
  defaultEmployeeId,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  employees: EmployeeItem[];
  defaultEmployeeId: string;
  onCreate: (params: { employeeId: string; date: string }) => Promise<void>;
}) {
  const [date, setDate] = useState("");
  const [employeeId, setEmployeeId] = useState(defaultEmployeeId);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const today = new Date();
    const todayLabel = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;
    setDate(todayLabel);
    setEmployeeId(defaultEmployeeId);
  }, [defaultEmployeeId, open]);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await onCreate({ employeeId, date });
      onOpenChange(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ошибка создания строки");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] rounded-[32px] border-0 p-0">
        <DialogHeader className="border-b px-12 py-10">
          <DialogTitle className="text-[32px] font-medium text-black">Добавление новой строки</DialogTitle>
        </DialogHeader>

        <div className="space-y-7 px-12 py-10">
          <div className="space-y-3">
            <Label className="text-[18px] text-[#73738a]">Дата</Label>
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-18 rounded-3xl border-[#dfe1ec] px-6 text-[20px]"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-[18px] text-[#73738a]">Сотрудник</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
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

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !date || !employeeId}
              className="h-16 rounded-3xl bg-[#5b66ff] px-10 text-[18px] text-white hover:bg-[#4b57ff]"
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
  onSave,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  responsibleTitle: string | null;
  responsibleUserId: string | null;
  employees: EmployeeItem[];
  onSave: (params: {
    title: string;
    responsibleTitle: string | null;
    responsibleUserId: string | null;
  }) => Promise<void>;
}) {
  const titleOptions = useMemo(
    () => [...new Set(employees.map((employee) => getHygienePositionLabel(employee.role)))],
    [employees]
  );

  const [name, setName] = useState(title);
  const [position, setPosition] = useState(responsibleTitle || titleOptions[0] || "");
  const [userId, setUserId] = useState(responsibleUserId || employees[0]?.id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(title);
    setPosition(responsibleTitle || titleOptions[0] || "");
    setUserId(responsibleUserId || employees[0]?.id || "");
  }, [employees, open, responsibleTitle, responsibleUserId, title, titleOptions]);

  async function handleSave() {
    setIsSubmitting(true);
    try {
      await onSave({
        title: name.trim(),
        responsibleTitle: position || null,
        responsibleUserId: userId || null,
      });
      onOpenChange(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ошибка сохранения настроек");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] rounded-[32px] border-0 p-0">
        <DialogHeader className="border-b px-14 py-12">
          <DialogTitle className="text-[32px] font-medium text-black">Настройки журнала</DialogTitle>
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
              <Label className="text-[18px] text-[#73738a]">Должность ответственного</Label>
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
              <Label className="text-[18px] text-[#73738a]">Сотрудник по умолчанию</Label>
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

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting || !name.trim()}
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

export function TrackedDocumentClient({
  documentId,
  title,
  organizationName,
  dateFrom,
  dateTo,
  responsibleTitle,
  responsibleUserId,
  status,
  employees,
  fields,
  initialEntries,
}: Props) {
  const router = useRouter();
  const [documentTitle, setDocumentTitle] = useState(title);
  const [entries, setEntries] = useState(getSortedEntries(initialEntries));
  const [isCreating, setIsCreating] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setEntries(getSortedEntries(initialEntries));
  }, [initialEntries]);

  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((item) => [item.id, item])),
    [employees]
  );

  async function persistDocument(body: Record<string, unknown>) {
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || "Не удалось обновить документ");
    }

    return result;
  }

  async function saveEntry(nextEntry: EntryItem) {
    const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: nextEntry.employeeId,
        date: nextEntry.date,
        data: nextEntry.data,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.entry) {
      throw new Error(result?.error || "Не удалось сохранить строку");
    }

    setEntries((current) => {
      const withoutCurrent = current.filter((item) => item.id !== nextEntry.id);
      return getSortedEntries([
        ...withoutCurrent,
        {
          ...nextEntry,
          id: result.entry.id,
        },
      ]);
    });
  }

  async function createEntry(params: { employeeId: string; date: string }) {
    if (!params.employeeId || !params.date) {
      throw new Error("Заполните дату и сотрудника");
    }

    setIsCreating(true);
    try {
      const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: params.employeeId,
          date: params.date,
          data: {},
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.entry) {
        throw new Error(result?.error || "Не удалось добавить строку");
      }

      setEntries((current) =>
        getSortedEntries([
          ...current,
          {
            id: result.entry.id,
            employeeId: params.employeeId,
            date: params.date,
            data: {},
          },
        ])
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function removeEntry(entryId: string) {
    if (!window.confirm("Удалить строку?")) return;

    const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [entryId] }),
    });

    if (!response.ok) {
      window.alert("Не удалось удалить строку");
      return;
    }

    setEntries((current) => current.filter((item) => item.id !== entryId));
  }

  async function handleSaveSettings(params: {
    title: string;
    responsibleTitle: string | null;
    responsibleUserId: string | null;
  }) {
    await persistDocument(params);
    setDocumentTitle(params.title);
    router.refresh();
  }

  const defaultEmployeeId = responsibleUserId || employees[0]?.id || "";

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-[#eceef5] bg-white px-8 py-7 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="text-[16px] text-[#84849a]">{organizationName}</div>
            <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.03em] text-black">{documentTitle}</h1>
            <div className="mt-2 text-[16px] text-[#84849a]">
              Период: {formatDateLabel(dateFrom)} - {formatDateLabel(dateTo)}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {status === "active" && (
              <Button
                type="button"
                onClick={() => setAddRowOpen(true)}
                disabled={isCreating || employees.length === 0}
                className="h-12 rounded-2xl bg-[#5b66ff] px-5 text-[16px] text-white hover:bg-[#4d58f5]"
              >
                <Plus className="size-5" />
                Добавить строку
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setSettingsOpen(true)}
              className="h-12 rounded-2xl border-[#e6e9f5] px-5 text-[16px] text-black shadow-none"
            >
              <Settings2 className="size-5" />
              Настройки
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => window.open(`/api/journal-documents/${documentId}/pdf`, "_blank")}
              className="h-12 rounded-2xl border-[#e6e9f5] px-5 text-[16px] text-black shadow-none"
            >
              <Printer className="size-5" />
              Печать
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[26px] border border-[#eceef5] bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <table className="min-w-[1200px] w-full border-collapse text-[15px]">
          <thead>
            <tr className="bg-[#f7f8fd]">
              <th className="border border-[#eceef5] px-4 py-3 text-left font-medium text-[#5b6075]">Дата</th>
              <th className="border border-[#eceef5] px-4 py-3 text-left font-medium text-[#5b6075]">Ответственный</th>
              {fields.map((field) => (
                <th key={field.key} className="border border-[#eceef5] px-4 py-3 text-left font-medium text-[#5b6075]">
                  {field.label}
                </th>
              ))}
              {status === "active" && (
                <th className="border border-[#eceef5] px-4 py-3 text-center font-medium text-[#5b6075]">Действия</th>
              )}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-[#fbfbfe]">
                <td className="border border-[#eceef5] p-2 align-top">
                  {status === "active" ? (
                    <Input
                      type="date"
                      defaultValue={entry.date}
                      className="h-10 rounded-xl border-[#dfe1ec]"
                      onBlur={(event) =>
                        saveEntry({
                          ...entry,
                          date: event.target.value,
                        }).catch((error) =>
                          window.alert(error instanceof Error ? error.message : "Ошибка сохранения")
                        )
                      }
                    />
                  ) : (
                    <div className="px-2 py-2 text-[15px] text-black">{formatDateLabel(entry.date)}</div>
                  )}
                </td>

                <td className="border border-[#eceef5] p-2 align-top">
                  {status === "active" ? (
                    <Select
                      value={entry.employeeId}
                      onValueChange={(value) => {
                        saveEntry({ ...entry, employeeId: value }).catch((error) =>
                          window.alert(error instanceof Error ? error.message : "Ошибка сохранения")
                        );
                      }}
                    >
                      <SelectTrigger className="h-10 rounded-xl border-[#dfe1ec]">
                        <SelectValue placeholder="Сотрудник" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="px-2 py-2 text-[15px] text-black">{employeeMap[entry.employeeId]?.name || ""}</div>
                  )}
                </td>

                {fields.map((field) => {
                  const value = entry.data[field.key];
                  const stringValue = fieldValueToString(value);

                  return (
                    <td key={`${entry.id}:${field.key}`} className="border border-[#eceef5] p-2 align-top">
                      {status !== "active" ? (
                        <div className="px-2 py-2 text-[15px] text-black">{stringValue || "—"}</div>
                      ) : field.type === "boolean" ? (
                        <div className="flex h-10 items-center px-2">
                          <Checkbox
                            checked={value === true}
                            onCheckedChange={(checked) => {
                              saveEntry({
                                ...entry,
                                data: {
                                  ...entry.data,
                                  [field.key]: checked === true,
                                },
                              }).catch((error) =>
                                window.alert(error instanceof Error ? error.message : "Ошибка сохранения")
                              );
                            }}
                          />
                        </div>
                      ) : isSelectLikeField(field) && field.options.length > 0 ? (
                        <Select
                          value={stringValue || undefined}
                          onValueChange={(nextValue) => {
                            saveEntry({
                              ...entry,
                              data: {
                                ...entry.data,
                                [field.key]: nextValue,
                              },
                            }).catch((error) =>
                              window.alert(error instanceof Error ? error.message : "Ошибка сохранения")
                            );
                          }}
                        >
                          <SelectTrigger className="h-10 rounded-xl border-[#dfe1ec]">
                            <SelectValue
                              placeholder={
                                field.type === "employee"
                                  ? "Выберите сотрудника"
                                  : field.type === "equipment"
                                    ? "Выберите оборудование"
                                    : "Выберите"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                          defaultValue={stringValue}
                          className="h-10 rounded-xl border-[#dfe1ec]"
                          onBlur={(event) =>
                            saveEntry({
                              ...entry,
                              data: {
                                ...entry.data,
                                [field.key]: event.target.value,
                              },
                            }).catch((error) =>
                              window.alert(error instanceof Error ? error.message : "Ошибка сохранения")
                            )
                          }
                        />
                      )}
                    </td>
                  );
                })}

                {status === "active" && (
                  <td className="border border-[#eceef5] p-2 text-center align-top">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeEntry(entry.id)}
                      className="h-10 rounded-xl border-[#ffd7d3] px-3 text-[#ff3b30] hover:bg-[#fff3f2]"
                    >
                      <Trash2 className="size-4" />
                      Удалить
                    </Button>
                  </td>
                )}
              </tr>
            ))}

            {entries.length === 0 && (
              <tr>
                <td
                  colSpan={status === "active" ? fields.length + 3 : fields.length + 2}
                  className="border border-[#eceef5] p-8 text-center text-[16px] text-[#7d8196]"
                >
                  Пока нет строк. Добавьте первую запись.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddRowDialog
        open={addRowOpen}
        onOpenChange={setAddRowOpen}
        employees={employees}
        defaultEmployeeId={defaultEmployeeId}
        onCreate={createEntry}
      />

      <JournalSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={documentTitle}
        responsibleTitle={responsibleTitle}
        responsibleUserId={responsibleUserId}
        employees={employees}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
