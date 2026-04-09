"use client";

import { useMemo, useState } from "react";
import { Plus, Printer } from "lucide-react";
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
  return (
    field.type === "select" ||
    field.type === "employee" ||
    field.type === "equipment"
  );
}

export function TrackedDocumentClient({
  documentId,
  title,
  organizationName,
  dateFrom,
  dateTo,
  status,
  employees,
  fields,
  initialEntries,
}: Props) {
  const [entries, setEntries] = useState(initialEntries);
  const [isCreating, setIsCreating] = useState(false);
  const employeeMap = useMemo(
    () => Object.fromEntries(employees.map((item) => [item.id, item])),
    [employees]
  );

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
      return [
        ...withoutCurrent,
        {
          ...nextEntry,
          id: result.entry.id,
        },
      ].sort((left, right) => left.date.localeCompare(right.date));
    });
  }

  async function createEntry() {
    if (employees.length === 0) {
      window.alert("Нет активных сотрудников.");
      return;
    }

    setIsCreating(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(`/api/journal-documents/${documentId}/entries`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employees[0].id,
          date: today,
          data: {},
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.entry) {
        throw new Error(result?.error || "Не удалось добавить строку");
      }

      setEntries((current) =>
        [
          ...current,
          {
            id: result.entry.id,
            employeeId: employees[0].id,
            date: today,
            data: {},
          },
        ].sort((left, right) => left.date.localeCompare(right.date))
      );
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Ошибка добавления");
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground">{organizationName}</div>
          <h1 className="text-3xl font-semibold">{title}</h1>
          <div className="text-sm text-muted-foreground">
            Период: {formatDateLabel(dateFrom)} - {formatDateLabel(dateTo)}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.open(`/api/journal-documents/${documentId}/pdf`, "_blank")}
        >
          <Printer className="size-4" />
          Печать
        </Button>
      </div>

      {status === "active" && (
        <Button type="button" onClick={createEntry} disabled={isCreating}>
          <Plus className="size-4" />
          {isCreating ? "Добавление..." : "Добавить строку"}
        </Button>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[1200px] w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/40">
              <th className="border p-2">Дата</th>
              <th className="border p-2">Ответственный</th>
              {fields.map((field) => (
                <th key={field.key} className="border p-2">
                  {field.label}
                </th>
              ))}
              {status === "active" && <th className="border p-2">Действия</th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="border p-1">
                  {status === "active" ? (
                    <Input
                      type="date"
                      defaultValue={entry.date}
                      onBlur={(event) =>
                        saveEntry({
                          ...entry,
                          date: event.target.value,
                        }).catch((error) =>
                          window.alert(
                            error instanceof Error ? error.message : "Ошибка сохранения"
                          )
                        )
                      }
                    />
                  ) : (
                    formatDateLabel(entry.date)
                  )}
                </td>
                <td className="border p-1">
                  {status === "active" ? (
                    <Select
                      defaultValue={entry.employeeId}
                      onValueChange={(value) => {
                        saveEntry({ ...entry, employeeId: value }).catch((error) =>
                          window.alert(
                            error instanceof Error ? error.message : "Ошибка сохранения"
                          )
                        );
                      }}
                    >
                      <SelectTrigger>
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
                    employeeMap[entry.employeeId]?.name || ""
                  )}
                </td>
                {fields.map((field) => {
                  const value = entry.data[field.key];
                  const stringValue = fieldValueToString(value);

                  return (
                    <td key={`${entry.id}:${field.key}`} className="border p-1">
                      {status !== "active" ? (
                        stringValue
                      ) : field.type === "boolean" ? (
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
                              window.alert(
                                error instanceof Error ? error.message : "Ошибка сохранения"
                              )
                            );
                          }}
                        />
                      ) : isSelectLikeField(field) && field.options.length > 0 ? (
                        <Select
                          defaultValue={stringValue}
                          onValueChange={(nextValue) => {
                            saveEntry({
                              ...entry,
                              data: {
                                ...entry.data,
                                [field.key]: nextValue,
                              },
                            }).catch((error) =>
                              window.alert(
                                error instanceof Error ? error.message : "Ошибка сохранения"
                              )
                            );
                          }}
                        >
                          <SelectTrigger>
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
                          onBlur={(event) =>
                            saveEntry({
                              ...entry,
                              data: {
                                ...entry.data,
                                [field.key]: event.target.value,
                              },
                            }).catch((error) =>
                              window.alert(
                                error instanceof Error ? error.message : "Ошибка сохранения"
                              )
                            )
                          }
                        />
                      )}
                    </td>
                  );
                })}
                {status === "active" && (
                  <td className="border p-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeEntry(entry.id)}
                    >
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
                  className="border p-6 text-center text-muted-foreground"
                >
                  Пока нет строк. Добавьте первую запись.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
