"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createMetalImpurityRow,
  getMetalImpurityOptionName,
  getMetalImpurityValuePerKg,
  METAL_IMPURITY_DOCUMENT_TITLE,
  METAL_IMPURITY_TEMPLATE_CODE,
  normalizeMetalImpurityConfig,
  type MetalImpurityDocumentConfig,
  type MetalImpurityOption,
  type MetalImpurityRow,
} from "@/lib/metal-impurity-document";

type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  status: string;
  config: unknown;
};

type RowDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: MetalImpurityRow | null;
  materials: MetalImpurityOption[];
  suppliers: MetalImpurityOption[];
  defaultResponsibleName: string;
  onSave: (row: MetalImpurityRow) => Promise<void>;
};

function formatRuDate(value: string) {
  if (!value) return "__________";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ru-RU");
}

function RowDialog({
  open,
  onOpenChange,
  row,
  materials,
  suppliers,
  defaultResponsibleName,
  onSave,
}: RowDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [draft, setDraft] = useState<MetalImpurityRow>(
    createMetalImpurityRow({ date: today, responsibleName: defaultResponsibleName })
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      row ||
        createMetalImpurityRow({
          date: today,
          materialId: materials[0]?.id || "",
          supplierId: suppliers[0]?.id || "",
          responsibleName: defaultResponsibleName,
        })
    );
    setSubmitting(false);
  }, [defaultResponsibleName, materials, open, row, suppliers, today]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[780px] rounded-[32px] border-0 p-0">
        <DialogHeader className="border-b px-12 py-10">
          <DialogTitle className="text-[32px] font-medium text-black">
            {row ? "Редактирование строки" : "Добавление новой строки"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-12 py-10">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">Дата</Label>
              <Input
                type="date"
                value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })}
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">Поставщик</Label>
              <Select
                value={draft.supplierId}
                onValueChange={(value) => setDraft({ ...draft, supplierId: value })}
              >
                <SelectTrigger className="h-15 rounded-[18px] border-[#dfe1ec] bg-[#f5f6fb] px-5 text-[18px]">
                  <SelectValue placeholder="Выберите поставщика" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">Наименование сырья</Label>
              <Select
                value={draft.materialId}
                onValueChange={(value) => setDraft({ ...draft, materialId: value })}
              >
                <SelectTrigger className="h-15 rounded-[18px] border-[#dfe1ec] bg-[#f5f6fb] px-5 text-[18px]">
                  <SelectValue placeholder="Выберите сырье" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">ФИО ответственного</Label>
              <Input
                value={draft.responsibleName}
                onChange={(event) =>
                  setDraft({ ...draft, responsibleName: event.target.value })
                }
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">
                Количество израсходованного сырья, кг
              </Label>
              <Input
                value={draft.consumedQuantityKg}
                onChange={(event) =>
                  setDraft({ ...draft, consumedQuantityKg: event.target.value })
                }
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">
                Количество металломагнитной примеси, г
              </Label>
              <Input
                value={draft.impurityQuantityG}
                onChange={(event) =>
                  setDraft({ ...draft, impurityQuantityG: event.target.value })
                }
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
          </div>
          <div className="space-y-3">
            <Label className="text-[18px] text-[#73738a]">
              Характеристика металломагнитной примеси
            </Label>
            <Textarea
              value={draft.impurityCharacteristic}
              onChange={(event) =>
                setDraft({ ...draft, impurityCharacteristic: event.target.value })
              }
              className="min-h-[130px] rounded-[18px] border-[#dfe1ec] px-5 py-4 text-[18px]"
            />
          </div>
          <div className="rounded-[18px] bg-[#f5f6fb] px-5 py-4 text-[17px] text-[#53566c]">
            Количество в мг на 1 кг муки:{" "}
            <span className="font-semibold text-black">
              {getMetalImpurityValuePerKg(
                draft.impurityQuantityG,
                draft.consumedQuantityKg
              ) || "—"}
            </span>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onSave(draft);
                  onOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="h-16 rounded-[18px] bg-[#5b66ff] px-10 text-[18px] text-white hover:bg-[#4b57ff]"
            >
              {submitting ? "Сохранение..." : row ? "Сохранить" : "Добавить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  title,
  config,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  config: MetalImpurityDocumentConfig;
  onSave: (params: { title: string; config: MetalImpurityDocumentConfig }) => Promise<void>;
}) {
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftConfig, setDraftConfig] = useState(config);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftTitle(title);
    setDraftConfig(config);
    setSubmitting(false);
  }, [config, open, title]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] rounded-[32px] border-0 p-0">
        <DialogHeader className="border-b px-12 py-10">
          <DialogTitle className="text-[32px] font-medium text-black">
            Настройки журнала
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 px-12 py-10">
          <div className="space-y-3">
            <Label className="text-[18px] text-[#73738a]">Название документа</Label>
            <Input
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">Дата начала</Label>
              <Input
                type="date"
                value={draftConfig.startDate}
                onChange={(event) =>
                  setDraftConfig({ ...draftConfig, startDate: event.target.value })
                }
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">Дата окончания</Label>
              <Input
                type="date"
                value={draftConfig.endDate}
                onChange={(event) =>
                  setDraftConfig({ ...draftConfig, endDate: event.target.value })
                }
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">Должность ответственного</Label>
              <Input
                value={draftConfig.responsiblePosition}
                onChange={(event) =>
                  setDraftConfig({
                    ...draftConfig,
                    responsiblePosition: event.target.value,
                  })
                }
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-[18px] text-[#73738a]">Сотрудник</Label>
              <Input
                value={draftConfig.responsibleEmployee}
                onChange={(event) =>
                  setDraftConfig({
                    ...draftConfig,
                    responsibleEmployee: event.target.value,
                  })
                }
                className="h-15 rounded-[18px] border-[#dfe1ec] px-5 text-[18px]"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onSave({ title: draftTitle, config: draftConfig });
                  onOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="h-16 rounded-[18px] bg-[#5b66ff] px-10 text-[18px] text-white hover:bg-[#4b57ff]"
            >
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ListsDialog({
  open,
  onOpenChange,
  config,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: MetalImpurityDocumentConfig;
  onSave: (config: MetalImpurityDocumentConfig) => Promise<void>;
}) {
  const [draft, setDraft] = useState(config);
  const [newMaterial, setNewMaterial] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(config);
    setNewMaterial("");
    setNewSupplier("");
    setSubmitting(false);
  }, [config, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[980px] rounded-[32px] border-0 p-0">
        <DialogHeader className="border-b px-12 py-10">
          <DialogTitle className="text-[32px] font-medium text-black">
            Редактировать списки
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-8 px-12 py-10">
          <div className="space-y-4">
            <div className="text-[24px] font-semibold text-black">Сырье</div>
            <div className="space-y-3 rounded-[24px] bg-[#f6f7fb] p-5">
              {draft.materials.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-[16px] bg-white px-4 py-3">
                  <Checkbox checked={false} />
                  <Input
                    value={item.name}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        materials: draft.materials.map((current) =>
                          current.id === item.id
                            ? { ...current, name: event.target.value }
                            : current
                        ),
                      })
                    }
                    className="h-12 border-0 px-0 text-[17px] shadow-none"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Input
                  value={newMaterial}
                  onChange={(event) => setNewMaterial(event.target.value)}
                  placeholder="Добавить сырье"
                  className="h-12 rounded-[16px] border-[#dfe1ec] px-4 text-[17px]"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!newMaterial.trim()) return;
                    setDraft({
                      ...draft,
                      materials: [
                        ...draft.materials,
                        { id: `material-${Date.now()}`, name: newMaterial.trim() },
                      ],
                    });
                    setNewMaterial("");
                  }}
                  className="h-12 rounded-[16px] bg-[#5b66ff] px-5 text-white hover:bg-[#4b57ff]"
                >
                  Добавить
                </Button>
              </div>
              <div className="rounded-[16px] border border-dashed border-[#cdd2ea] px-4 py-3 text-[15px] text-[#6d7288]">
                Добавить из файла: первый лист, первый столбец, начиная с первой строки.
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="text-[24px] font-semibold text-black">Поставщики</div>
            <div className="space-y-3 rounded-[24px] bg-[#f6f7fb] p-5">
              {draft.suppliers.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-[16px] bg-white px-4 py-3">
                  <Checkbox checked={false} />
                  <Input
                    value={item.name}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        suppliers: draft.suppliers.map((current) =>
                          current.id === item.id
                            ? { ...current, name: event.target.value }
                            : current
                        ),
                      })
                    }
                    className="h-12 border-0 px-0 text-[17px] shadow-none"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Input
                  value={newSupplier}
                  onChange={(event) => setNewSupplier(event.target.value)}
                  placeholder="Добавить поставщика"
                  className="h-12 rounded-[16px] border-[#dfe1ec] px-4 text-[17px]"
                />
                <Button
                  type="button"
                  onClick={() => {
                    if (!newSupplier.trim()) return;
                    setDraft({
                      ...draft,
                      suppliers: [
                        ...draft.suppliers,
                        { id: `supplier-${Date.now()}`, name: newSupplier.trim() },
                      ],
                    });
                    setNewSupplier("");
                  }}
                  className="h-12 rounded-[16px] bg-[#5b66ff] px-5 text-white hover:bg-[#4b57ff]"
                >
                  Добавить
                </Button>
              </div>
              <div className="rounded-[16px] border border-dashed border-[#cdd2ea] px-4 py-3 text-[15px] text-[#6d7288]">
                Добавить из файла: первый лист, первый столбец, начиная с первой строки.
              </div>
            </div>
          </div>
          <div className="col-span-2 flex justify-end">
            <Button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setSubmitting(true);
                try {
                  await onSave(draft);
                  onOpenChange(false);
                } finally {
                  setSubmitting(false);
                }
              }}
              className="h-16 rounded-[18px] bg-[#5b66ff] px-10 text-[18px] text-white hover:bg-[#4b57ff]"
            >
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MetalImpurityDocumentClient({
  documentId,
  title,
  organizationName,
  status,
  config: initialConfig,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [documentTitle, setDocumentTitle] = useState(title || METAL_IMPURITY_DOCUMENT_TITLE);
  const [config, setConfig] = useState(() => normalizeMetalImpurityConfig(initialConfig));
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<MetalImpurityRow | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [listsOpen, setListsOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);

  useEffect(() => {
    setConfig(normalizeMetalImpurityConfig(initialConfig));
  }, [initialConfig]);

  useEffect(() => {
    setDocumentTitle(title || METAL_IMPURITY_DOCUMENT_TITLE);
  }, [title]);

  useEffect(() => {
    if (searchParams.get("print") === "1") {
      const timeoutId = window.setTimeout(() => window.print(), 200);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [searchParams]);

  const allSelected = config.rows.length > 0 && selectedRowIds.length === config.rows.length;

  async function persist(
    nextTitle: string,
    nextConfig: MetalImpurityDocumentConfig,
    patch?: Record<string, unknown>
  ) {
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: nextTitle,
        dateFrom: nextConfig.startDate,
        dateTo: nextConfig.endDate || nextConfig.startDate,
        config: nextConfig,
        ...patch,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.error || "Не удалось сохранить журнал");
    }

    setDocumentTitle(nextTitle);
    setConfig(nextConfig);
    startTransition(() => router.refresh());
  }

  async function saveRow(row: MetalImpurityRow) {
    const nextRows = editingRow
      ? config.rows.map((item) => (item.id === editingRow.id ? row : item))
      : [...config.rows, row];
    await persist(documentTitle, { ...config, rows: nextRows });
    setEditingRow(null);
  }

  async function deleteSelectedRows() {
    if (selectedRowIds.length === 0) return;
    await persist(documentTitle, {
      ...config,
      rows: config.rows.filter((row) => !selectedRowIds.includes(row.id)),
    });
    setSelectedRowIds([]);
  }

  async function finishJournal() {
    const today = new Date().toISOString().slice(0, 10);
    await persist(
      documentTitle,
      { ...config, endDate: today },
      { status: "closed", dateTo: today }
    );
    router.push(`/journals/${METAL_IMPURITY_TEMPLATE_CODE}?tab=closed`);
  }

  const printRows = useMemo(
    () =>
      config.rows.map((row, index) => ({
        ...row,
        number: index + 1,
        materialName: getMetalImpurityOptionName(config.materials, row.materialId),
        supplierName: getMetalImpurityOptionName(config.suppliers, row.supplierId),
        valuePerKg: getMetalImpurityValuePerKg(
          row.impurityQuantityG,
          row.consumedQuantityKg
        ),
      })),
    [config.materials, config.rows, config.suppliers]
  );

  return (
    <>
      <div className="space-y-8 bg-white text-black">
        {selectedRowIds.length > 0 && status === "active" && (
          <div className="flex items-center gap-4 rounded-[12px] bg-white px-2 py-2 print:hidden">
            <div className="inline-flex h-14 items-center gap-3 rounded-[12px] bg-[#fafbff] px-6 text-[18px] text-[#5b66ff]">
              <button
                type="button"
                onClick={() => setSelectedRowIds([])}
                className="flex size-6 items-center justify-center"
              >
                <X className="size-5" />
              </button>
              Выбрано: {selectedRowIds.length}
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                deleteSelectedRows().catch((error) =>
                  window.alert(error instanceof Error ? error.message : "Ошибка удаления")
                )
              }
              className="h-14 rounded-[12px] border-[#ffd7d3] px-6 text-[18px] text-[#ff3b30] hover:bg-[#fff3f2]"
            >
              <Trash2 className="size-5" />
              Удалить
            </Button>
          </div>
        )}

        <div className="flex items-start justify-between gap-6 print:hidden">
          <div>
            <div className="text-[15px] text-[#6f7282]">
              {organizationName} <span className="mx-2">›</span> {documentTitle}
            </div>
            <h1 className="mt-4 text-[58px] font-semibold tracking-[-0.04em] text-black">
              {documentTitle}
            </h1>
          </div>
          {status === "active" && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setListsOpen(true)}
                className="h-14 rounded-[14px] border-[#eef0fb] px-6 text-[16px] text-[#5464ff] shadow-none"
              >
                Редактировать списки
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettingsOpen(true)}
                className="h-14 rounded-[14px] border-[#eef0fb] px-6 text-[16px] text-[#5464ff] shadow-none"
              >
                <Settings2 className="size-4" />
                Настройки журнала
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="mx-auto min-w-[1180px] max-w-[1500px] border-collapse">
            <tbody>
              <tr>
                <td rowSpan={2} className="w-[240px] border border-black px-6 py-10 text-center text-[22px] font-medium">
                  {organizationName}
                </td>
                <td className="w-[980px] border border-black px-6 py-5 text-center text-[20px]">
                  СИСТЕМА ХАССП
                </td>
                <td rowSpan={2} className="w-[240px] border border-black px-6 py-4 align-top text-[18px] leading-[1.6]">
                  <div className="font-semibold">Начат {formatRuDate(config.startDate)}</div>
                  <div className="font-semibold">
                    Окончен {config.endDate ? formatRuDate(config.endDate) : "__________"}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="border border-black px-6 py-4 text-center text-[18px] italic">
                  ЖУРНАЛ УЧЕТА МЕТАЛЛОПРИМЕСЕЙ В СЫРЬЕ
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="border border-black px-6 py-5 text-right text-[18px]">
                  СТР. 1 ИЗ 1
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {status === "active" && (
          <div className="flex items-center justify-between gap-4 print:hidden">
            <Button
              type="button"
              onClick={() => {
                setEditingRow(null);
                setRowDialogOpen(true);
              }}
              className="h-16 rounded-[14px] bg-[#5b66ff] px-8 text-[18px] text-white hover:bg-[#4b57ff]"
            >
              <Plus className="size-6" />
              Добавить
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFinishOpen(true)}
              className="h-16 rounded-[14px] border-[#eef0fb] px-8 text-[18px] text-[#5464ff] shadow-none"
            >
              Закончить журнал
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[1700px] w-full border-collapse text-[15px]">
            <thead>
              <tr className="bg-[#f2f2f2]">
                <th className="w-[42px] border border-black p-2 text-center print:hidden">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelectedRowIds(checked === true ? config.rows.map((row) => row.id) : [])
                    }
                    disabled={status !== "active" || config.rows.length === 0}
                  />
                </th>
                <th className="w-[60px] border border-black p-3 text-center font-semibold">№</th>
                <th className="w-[130px] border border-black p-3 text-center font-semibold">Дата</th>
                <th className="w-[220px] border border-black p-3 text-center font-semibold">Поставщик</th>
                <th className="w-[220px] border border-black p-3 text-center font-semibold">Наименование сырья</th>
                <th className="w-[180px] border border-black p-3 text-center font-semibold">Количество израсходованного сырья, кг</th>
                <th className="w-[180px] border border-black p-3 text-center font-semibold">Количество металломагнитной примеси, г</th>
                <th className="w-[260px] border border-black p-3 text-center font-semibold">Характеристика металломагнитной примеси</th>
                <th className="w-[170px] border border-black p-3 text-center font-semibold">Количество в мг на 1 кг муки (N - не более 3 мг)</th>
                <th className="w-[220px] border border-black p-3 text-center font-semibold">ФИО ответственного</th>
              </tr>
            </thead>
            <tbody>
              {printRows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-black p-2 text-center align-top print:hidden">
                    <Checkbox
                      checked={selectedRowIds.includes(row.id)}
                      onCheckedChange={(checked) =>
                        setSelectedRowIds((current) =>
                          checked === true
                            ? [...new Set([...current, row.id])]
                            : current.filter((id) => id !== row.id)
                        )
                      }
                      disabled={status !== "active"}
                    />
                  </td>
                  <td className="border border-black p-3 text-center align-top">{row.number}</td>
                  <td className="border border-black p-3 align-top">
                    <button
                      type="button"
                      disabled={status !== "active"}
                      onClick={() => {
                        if (status !== "active") return;
                        setEditingRow(row);
                        setRowDialogOpen(true);
                      }}
                      className="w-full text-left disabled:cursor-default"
                    >
                      {formatRuDate(row.date)}
                    </button>
                  </td>
                  <td className="border border-black p-3 align-top">{row.supplierName}</td>
                  <td className="border border-black p-3 align-top">{row.materialName}</td>
                  <td className="border border-black p-3 align-top">{row.consumedQuantityKg || "—"}</td>
                  <td className="border border-black p-3 align-top">{row.impurityQuantityG || "—"}</td>
                  <td className="border border-black p-3 align-top whitespace-pre-wrap">{row.impurityCharacteristic || "—"}</td>
                  <td className="border border-black p-3 align-top">{row.valuePerKg || "—"}</td>
                  <td className="border border-black p-3 align-top">{row.responsibleName || "—"}</td>
                </tr>
              ))}
              {printRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="border border-black px-4 py-10 text-center text-[18px] text-[#666a80]">
                    Записей пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RowDialog
        open={rowDialogOpen}
        onOpenChange={(open) => {
          setRowDialogOpen(open);
          if (!open) setEditingRow(null);
        }}
        row={editingRow}
        materials={config.materials}
        suppliers={config.suppliers}
        defaultResponsibleName={config.responsibleEmployee}
        onSave={saveRow}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title={documentTitle}
        config={config}
        onSave={async ({ title: nextTitle, config: nextConfig }) => {
          await persist(nextTitle.trim() || METAL_IMPURITY_DOCUMENT_TITLE, nextConfig);
        }}
      />

      <ListsDialog
        open={listsOpen}
        onOpenChange={setListsOpen}
        config={config}
        onSave={async (nextConfig) => {
          await persist(documentTitle, nextConfig);
        }}
      />

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent className="max-w-[680px] rounded-[32px] border-0 p-0">
          <DialogHeader className="border-b px-12 py-10">
            <DialogTitle className="pr-10 text-[32px] font-medium text-black">
              {`Закончить журнал "${documentTitle}"`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-end px-12 py-10">
            <Button
              type="button"
              onClick={() =>
                finishJournal().catch((error) =>
                  window.alert(error instanceof Error ? error.message : "Ошибка закрытия")
                )
              }
              className="h-16 rounded-[18px] bg-[#5b66ff] px-10 text-[18px] text-white hover:bg-[#4b57ff]"
            >
              Закончить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
