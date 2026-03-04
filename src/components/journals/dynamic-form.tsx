"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FieldOption = { value: string; label: string };
type ShowIfCondition = { field: string; equals: unknown };

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "select" | "equipment";
  required?: boolean;
  options?: FieldOption[];
  step?: number;
  auto?: boolean;
  showIf?: ShowIfCondition;
};

type EquipmentItem = {
  id: string;
  name: string;
  type: string;
  tempMin: number | null;
  tempMax: number | null;
};

type AreaItem = {
  id: string;
  name: string;
};

interface DynamicFormProps {
  templateCode: string;
  templateName: string;
  fields: FieldDef[];
  areas: AreaItem[];
  equipment: EquipmentItem[];
}

export function DynamicForm({
  templateCode,
  templateName,
  fields,
  areas,
  equipment,
}: DynamicFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [areaId, setAreaId] = useState<string>("");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function isFieldVisible(field: FieldDef): boolean {
    if (!field.showIf) return true;
    return formData[field.showIf.field] === field.showIf.equals;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode,
          areaId: areaId || undefined,
          equipmentId: equipmentId || undefined,
          data: formData,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Ошибка при сохранении");
      }

      router.push(`/journals/${templateCode}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setIsSubmitting(false);
    }
  }

  const visibleFields = fields.filter(
    (field) => !field.auto && isFieldVisible(field)
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {areas.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="area">Участок</Label>
          <Select value={areaId} onValueChange={setAreaId}>
            <SelectTrigger id="area" className="w-full">
              <SelectValue placeholder="Выберите участок" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {visibleFields.map((field) => (
        <div key={field.key} className="space-y-2">
          {field.type === "boolean" ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id={field.key}
                checked={!!formData[field.key]}
                onCheckedChange={(checked) =>
                  updateField(field.key, checked === true)
                }
              />
              <Label htmlFor={field.key}>{field.label}</Label>
            </div>
          ) : (
            <>
              <Label htmlFor={field.key}>
                {field.label}
                {field.required && (
                  <span className="text-destructive"> *</span>
                )}
              </Label>

              {field.type === "text" && (
                <Textarea
                  id={field.key}
                  value={(formData[field.key] as string) ?? ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  required={field.required}
                />
              )}

              {field.type === "number" && (
                <Input
                  id={field.key}
                  type="number"
                  step={field.step ?? 1}
                  value={(formData[field.key] as string) ?? ""}
                  onChange={(e) =>
                    updateField(
                      field.key,
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                  required={field.required}
                />
              )}

              {field.type === "date" && (
                <Input
                  id={field.key}
                  type="date"
                  value={(formData[field.key] as string) ?? ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  required={field.required}
                />
              )}

              {field.type === "select" && field.options && (
                <Select
                  value={(formData[field.key] as string) ?? ""}
                  onValueChange={(value) => updateField(field.key, value)}
                  required={field.required}
                >
                  <SelectTrigger id={field.key} className="w-full">
                    <SelectValue placeholder="Выберите..." />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {field.type === "equipment" && (
                <Select
                  value={equipmentId}
                  onValueChange={(value) => {
                    setEquipmentId(value);
                    updateField(field.key, value);
                  }}
                  required={field.required}
                >
                  <SelectTrigger id={field.key} className="w-full">
                    <SelectValue placeholder="Выберите оборудование" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipment.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </>
          )}
        </div>
      ))}

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Сохранение..." : "Сохранить запись"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/journals/${templateCode}`)}
          disabled={isSubmitting}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}
