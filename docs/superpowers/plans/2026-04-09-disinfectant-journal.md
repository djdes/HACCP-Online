# Disinfectant Journal Custom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `disinfectant_usage` from generic tracked/register journal to a fully custom document-style journal with three data tables (needs calculation, receipts, consumption), matching the source app UX.

**Architecture:** Custom document-style journal stored entirely in `JournalDocument.config` JSON field. Three independent data arrays (subdivisions, receipts, consumptions) with computed fields for the needs calculation table. Follows the same pattern as `training_plan` journal.

**Tech Stack:** Next.js App Router, React client components, Prisma, shadcn/ui, Tailwind CSS

---

### Task 1: Create disinfectant-document library

**Files:**
- Create: `src/lib/disinfectant-document.ts`

- [ ] **Step 1: Create the library file with types and constants**

```typescript
// src/lib/disinfectant-document.ts

export const DISINFECTANT_TEMPLATE_CODE = "disinfectant_usage";
export const DISINFECTANT_SOURCE_SLUG = "disinfectjournal";
export const DISINFECTANT_HEADING =
  "Журнал учета получения, расхода дезинфицирующих средств и проведения дезинфекционных работ на объекте";
export const DISINFECTANT_DOCUMENT_TITLE = "Журнал учета дез. средств";

export type MeasureUnit = "kg" | "l" | "bottle";

export const MEASURE_UNIT_LABELS: Record<MeasureUnit, string> = {
  kg: "кг.",
  l: "л.",
  bottle: "фл.",
};

export type SubdivisionRow = {
  id: string;
  name: string;
  area: number | null;
  byCapacity: boolean;
  treatmentType: "current" | "general";
  frequencyPerMonth: number;
  disinfectantName: string;
  concentration: number;
  solutionConsumptionPerSqm: number;
  solutionPerTreatment: number;
};

export type ReceiptRow = {
  id: string;
  date: string;
  disinfectantName: string;
  quantity: number;
  unit: MeasureUnit;
  expiryDate: string;
  responsibleRole: string;
  responsibleEmployee: string;
};

export type ConsumptionRow = {
  id: string;
  periodFrom: string;
  periodTo: string;
  disinfectantName: string;
  totalReceived: number;
  totalReceivedUnit: MeasureUnit;
  totalConsumed: number;
  totalConsumedUnit: MeasureUnit;
  remainder: number;
  remainderUnit: MeasureUnit;
  responsibleRole: string;
  responsibleEmployee: string;
};

export type DisinfectantDocumentConfig = {
  responsibleRole: string;
  responsibleEmployee: string;
  subdivisions: SubdivisionRow[];
  receipts: ReceiptRow[];
  consumptions: ConsumptionRow[];
};

function createId() {
  return `dis-${Math.random().toString(36).slice(2, 9)}`;
}

function safeText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function safeMeasureUnit(value: unknown): MeasureUnit {
  if (value === "kg" || value === "l" || value === "bottle") return value;
  return "kg";
}

// --- Computed helpers ---

export function computeNeedPerTreatment(row: SubdivisionRow): number {
  return row.solutionPerTreatment * (row.concentration / 100);
}

export function computeNeedPerMonth(row: SubdivisionRow): number {
  return computeNeedPerTreatment(row) * row.frequencyPerMonth;
}

export function computeNeedPerYear(row: SubdivisionRow): number {
  return computeNeedPerMonth(row) * 12;
}

export function formatNumber(value: number, decimals = 3): string {
  if (value === 0) return "";
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export function formatQuantityWithUnit(quantity: number, unit: MeasureUnit): string {
  if (quantity === 0) return "";
  return `${formatNumber(quantity)} ${MEASURE_UNIT_LABELS[unit]}`;
}

// --- Normalization ---

function normalizeSubdivision(value: unknown): SubdivisionRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  return {
    id: safeText(s.id) || createId(),
    name: safeText(s.name),
    area: s.byCapacity === true ? null : safeNumber(s.area),
    byCapacity: s.byCapacity === true,
    treatmentType: s.treatmentType === "general" ? "general" : "current",
    frequencyPerMonth: safeNumber(s.frequencyPerMonth),
    disinfectantName: safeText(s.disinfectantName),
    concentration: safeNumber(s.concentration),
    solutionConsumptionPerSqm: safeNumber(s.solutionConsumptionPerSqm),
    solutionPerTreatment: safeNumber(s.solutionPerTreatment),
  };
}

function normalizeReceipt(value: unknown): ReceiptRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  return {
    id: safeText(s.id) || createId(),
    date: safeText(s.date),
    disinfectantName: safeText(s.disinfectantName),
    quantity: safeNumber(s.quantity),
    unit: safeMeasureUnit(s.unit),
    expiryDate: safeText(s.expiryDate),
    responsibleRole: safeText(s.responsibleRole),
    responsibleEmployee: safeText(s.responsibleEmployee),
  };
}

function normalizeConsumption(value: unknown): ConsumptionRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>;
  return {
    id: safeText(s.id) || createId(),
    periodFrom: safeText(s.periodFrom),
    periodTo: safeText(s.periodTo),
    disinfectantName: safeText(s.disinfectantName),
    totalReceived: safeNumber(s.totalReceived),
    totalReceivedUnit: safeMeasureUnit(s.totalReceivedUnit),
    totalConsumed: safeNumber(s.totalConsumed),
    totalConsumedUnit: safeMeasureUnit(s.totalConsumedUnit),
    remainder: safeNumber(s.remainder),
    remainderUnit: safeMeasureUnit(s.remainderUnit),
    responsibleRole: safeText(s.responsibleRole),
    responsibleEmployee: safeText(s.responsibleEmployee),
  };
}

export function normalizeDisinfectantConfig(
  config: unknown
): DisinfectantDocumentConfig {
  const fallback = getDisinfectantDefaultConfig();
  if (!config || typeof config !== "object" || Array.isArray(config))
    return fallback;
  const source = config as Record<string, unknown>;

  return {
    responsibleRole: safeText(source.responsibleRole) || fallback.responsibleRole,
    responsibleEmployee: safeText(source.responsibleEmployee) || fallback.responsibleEmployee,
    subdivisions: Array.isArray(source.subdivisions)
      ? source.subdivisions
          .map(normalizeSubdivision)
          .filter((s): s is SubdivisionRow => s !== null)
      : [],
    receipts: Array.isArray(source.receipts)
      ? source.receipts
          .map(normalizeReceipt)
          .filter((r): r is ReceiptRow => r !== null)
      : [],
    consumptions: Array.isArray(source.consumptions)
      ? source.consumptions
          .map(normalizeConsumption)
          .filter((c): c is ConsumptionRow => c !== null)
      : [],
  };
}

// --- Defaults ---

export function getDisinfectantDefaultConfig(): DisinfectantDocumentConfig {
  return {
    responsibleRole: "Управляющий",
    responsibleEmployee: "",
    subdivisions: [
      {
        id: "sub-1",
        name: "Поверхности в помещениях для гостей (пол)",
        area: 50,
        byCapacity: false,
        treatmentType: "current",
        frequencyPerMonth: 31,
        disinfectantName: "Ph средство дезинфицирующее",
        concentration: 0.5,
        solutionConsumptionPerSqm: 0.7,
        solutionPerTreatment: 35,
      },
      {
        id: "sub-2",
        name: "Мебель в помещениях для гостей (столы, стулья, диваны, полки), стационарные официантов в торговом зале",
        area: null,
        byCapacity: true,
        treatmentType: "current",
        frequencyPerMonth: 31,
        disinfectantName: "Ph средство дезинфицирующее",
        concentration: 0.5,
        solutionConsumptionPerSqm: 0,
        solutionPerTreatment: 5,
      },
      {
        id: "sub-3",
        name: "Поверхности в производственных и складских помещениях, в баре (пол, фартуки над рабочими поверхностями)",
        area: 50,
        byCapacity: false,
        treatmentType: "current",
        frequencyPerMonth: 31,
        disinfectantName: "Ph средство дезинфицирующее",
        concentration: 0.5,
        solutionConsumptionPerSqm: 0.1,
        solutionPerTreatment: 5,
      },
    ],
    receipts: [
      {
        id: "rec-1",
        date: "2025-02-13",
        disinfectantName: "Ph средство дезинфицирующее",
        quantity: 30,
        unit: "l",
        expiryDate: "2026-05-01",
        responsibleRole: "Управляющий",
        responsibleEmployee: "Иванов И.И.",
      },
      {
        id: "rec-2",
        date: "2023-12-01",
        disinfectantName: "Ph средство дезинфицирующее",
        quantity: 30,
        unit: "l",
        expiryDate: "2025-04-25",
        responsibleRole: "Управляющий",
        responsibleEmployee: "Иванов И.И.",
      },
    ],
    consumptions: [
      {
        id: "con-1",
        periodFrom: "2024-03-07",
        periodTo: "2024-12-05",
        disinfectantName: "Ph средство дезинфицирующее",
        totalReceived: 30,
        totalReceivedUnit: "kg",
        totalConsumed: 19.976,
        totalConsumedUnit: "kg",
        remainder: 11,
        remainderUnit: "kg",
        responsibleRole: "Управляющий",
        responsibleEmployee: "Иванов И.И.",
      },
    ],
  };
}

export function createEmptySubdivision(): SubdivisionRow {
  return {
    id: createId(),
    name: "",
    area: null,
    byCapacity: false,
    treatmentType: "current",
    frequencyPerMonth: 0,
    disinfectantName: "",
    concentration: 0,
    solutionConsumptionPerSqm: 0,
    solutionPerTreatment: 0,
  };
}

export function createEmptyReceipt(
  defaultRole: string,
  defaultEmployee: string
): ReceiptRow {
  return {
    id: createId(),
    date: new Date().toISOString().slice(0, 10),
    disinfectantName: "",
    quantity: 0,
    unit: "kg",
    expiryDate: new Date().toISOString().slice(0, 10),
    responsibleRole: defaultRole,
    responsibleEmployee: defaultEmployee,
  };
}

export function createEmptyConsumption(
  defaultRole: string,
  defaultEmployee: string
): ConsumptionRow {
  return {
    id: createId(),
    periodFrom: "",
    periodTo: "",
    disinfectantName: "",
    totalReceived: 0,
    totalReceivedUnit: "kg",
    totalConsumed: 0,
    totalConsumedUnit: "kg",
    remainder: 0,
    remainderUnit: "kg",
    responsibleRole: defaultRole,
    responsibleEmployee: defaultEmployee,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/disinfectant-document.ts
git commit -m "feat: add disinfectant-document library with types, normalization, and defaults"
```

---

### Task 2: Create disinfectant-documents-client (list page)

**Files:**
- Create: `src/components/journals/disinfectant-documents-client.tsx`

- [ ] **Step 1: Create the list page component**

This component handles the document list page with Active/Closed tabs, create/settings/archive/delete functionality. Follow the exact pattern from `training-plan-documents-client.tsx`.

```tsx
// src/components/journals/disinfectant-documents-client.tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Ellipsis,
  Pencil,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
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
  DISINFECTANT_HEADING,
  DISINFECTANT_DOCUMENT_TITLE,
  getDisinfectantDefaultConfig,
  normalizeDisinfectantConfig,
  type DisinfectantDocumentConfig,
} from "@/lib/disinfectant-document";

type UserItem = { id: string; name: string; role: string };

type DisinfectantDocumentItem = {
  id: string;
  title: string;
  status: "active" | "closed";
  config: unknown;
};

type Props = {
  routeCode: string;
  templateCode: string;
  activeTab: "active" | "closed";
  users: UserItem[];
  documents: DisinfectantDocumentItem[];
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Управляющий",
  technologist: "Технолог",
  operator: "Сотрудник",
};

type SettingsState = {
  title: string;
  responsibleRole: string;
  responsibleEmployee: string;
};

function roleOptionsFromUsers(users: UserItem[]) {
  const labels = users.map((u) => ROLE_LABELS[u.role] || u.role);
  return [...new Set(labels)];
}

function usersForRole(users: UserItem[], roleLabel: string) {
  return users.filter((u) => (ROLE_LABELS[u.role] || u.role) === roleLabel);
}

function SettingsDialog(props: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  users: UserItem[];
  initial: SettingsState | null;
  onSubmit: (value: SettingsState) => Promise<void>;
  submitText: string;
  dialogTitle: string;
}) {
  const [state, setState] = useState<SettingsState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const roles = useMemo(() => roleOptionsFromUsers(props.users), [props.users]);
  const activeState = state || props.initial;

  async function handleSubmit() {
    if (!activeState) return;
    setSubmitting(true);
    try {
      await props.onSubmit(activeState);
      props.onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={(v) => {
        if (v) setState(props.initial);
        props.onOpenChange(v);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[760px] rounded-[28px] border-0 p-0">
        <DialogHeader className="border-b px-10 py-8">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[32px] font-semibold tracking-[-0.03em] text-black">
              {props.dialogTitle}
            </DialogTitle>
            <button
              type="button"
              className="rounded-xl p-2 text-[#0b1024]"
              onClick={() => props.onOpenChange(false)}
            >
              <X className="size-8" />
            </button>
          </div>
        </DialogHeader>
        {activeState && (
          <div className="space-y-5 px-10 py-8">
            <div className="space-y-2">
              <Label className="text-[18px] text-[#7a7c8e]">
                Название документа
              </Label>
              <Input
                value={activeState.title}
                onChange={(e) =>
                  setState({ ...activeState, title: e.target.value })
                }
                placeholder="Введите название документа"
                className="h-16 rounded-3xl border-[#d8dae6] px-7 text-[22px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[18px] text-[#7a7c8e]">
                Должность ответственного
              </Label>
              <Select
                value={activeState.responsibleRole}
                onValueChange={(v) => {
                  const user = usersForRole(props.users, v)[0];
                  setState({
                    ...activeState,
                    responsibleRole: v,
                    responsibleEmployee:
                      user?.name || activeState.responsibleEmployee,
                  });
                }}
              >
                <SelectTrigger className="h-16 rounded-3xl border-[#d8dae6] bg-[#f1f2f8] px-7 text-[22px]">
                  <SelectValue placeholder="- Выберите значение -" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[18px] text-[#7a7c8e]">Сотрудник</Label>
              <Select
                value={activeState.responsibleEmployee}
                onValueChange={(v) =>
                  setState({ ...activeState, responsibleEmployee: v })
                }
              >
                <SelectTrigger className="h-16 rounded-3xl border-[#d8dae6] bg-[#f1f2f8] px-7 text-[22px]">
                  <SelectValue placeholder="- Выберите значение -" />
                </SelectTrigger>
                <SelectContent>
                  {usersForRole(props.users, activeState.responsibleRole).map(
                    (u) => (
                      <SelectItem key={u.id} value={u.name}>
                        {u.name}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-3">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="h-14 rounded-3xl bg-[#5563ff] px-10 text-[20px] text-white hover:bg-[#4554ff]"
              >
                {submitting ? "Сохранение..." : props.submitText}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DisinfectantDocumentsClient({
  routeCode,
  templateCode,
  activeTab,
  users,
  documents,
}: Props) {
  const router = useRouter();
  const [settingsTarget, setSettingsTarget] =
    useState<DisinfectantDocumentItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] =
    useState<DisinfectantDocumentItem | null>(null);

  const defaultConfig = getDisinfectantDefaultConfig();

  async function createDocument(payload: SettingsState) {
    const config: DisinfectantDocumentConfig = {
      ...defaultConfig,
      responsibleRole: payload.responsibleRole,
      responsibleEmployee: payload.responsibleEmployee,
      subdivisions: [],
      receipts: [],
      consumptions: [],
    };
    const now = new Date();
    const response = await fetch("/api/journal-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateCode,
        title:
          payload.title.trim() || DISINFECTANT_DOCUMENT_TITLE,
        dateFrom: now.toISOString().slice(0, 10),
        dateTo: now.toISOString().slice(0, 10),
        config,
      }),
    });
    if (!response.ok) {
      window.alert("Не удалось создать документ");
      return;
    }
    const data = (await response.json()) as { document: { id: string } };
    router.push(`/journals/${routeCode}/documents/${data.document.id}`);
    router.refresh();
  }

  async function saveSettings(documentId: string, payload: SettingsState) {
    const current = documents.find((d) => d.id === documentId);
    if (!current) return;
    const currentConfig = normalizeDisinfectantConfig(current.config);
    const config: DisinfectantDocumentConfig = {
      ...currentConfig,
      responsibleRole: payload.responsibleRole,
      responsibleEmployee: payload.responsibleEmployee,
    };
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payload.title.trim() || DISINFECTANT_DOCUMENT_TITLE,
        config,
      }),
    });
    if (!response.ok) {
      window.alert("Не удалось сохранить");
      return;
    }
    router.refresh();
  }

  async function handleDelete(documentId: string, docTitle: string) {
    if (!window.confirm(`Удалить документ "${docTitle}"?`)) return;
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      window.alert("Не удалось удалить");
      return;
    }
    router.refresh();
  }

  async function moveToStatus(
    documentId: string,
    newStatus: "active" | "closed"
  ) {
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!response.ok) {
      window.alert("Ошибка");
      return;
    }
    router.refresh();
  }

  const defaultCreateState = useMemo<SettingsState>(
    () => ({
      title: "",
      responsibleRole: defaultConfig.responsibleRole,
      responsibleEmployee: defaultConfig.responsibleEmployee,
    }),
    []
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[48px] font-semibold tracking-[-0.04em] text-black">
          {DISINFECTANT_HEADING}
          {activeTab === "closed" && " (Закрытые!!!)"}
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-12 rounded-2xl border-[#e8ebf7] px-6 text-[16px] text-[#5b66ff] shadow-none"
            asChild
          >
            <Link href="/sanpin">
              <BookOpenText className="size-5" /> Инструкция
            </Link>
          </Button>
          {activeTab === "active" && (
            <Button
              className="h-12 rounded-2xl bg-[#5563ff] px-8 text-[16px] text-white hover:bg-[#4554ff]"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-5" /> Создать документ
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-[#d9dce8]">
        <div className="flex gap-12 text-[18px]">
          <Link
            href={`/journals/${routeCode}`}
            className={`relative pb-6 ${
              activeTab === "active"
                ? "font-semibold text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5b66ff]"
                : "text-[#8a8ea4]"
            }`}
          >
            Активные
          </Link>
          <Link
            href={`/journals/${routeCode}?tab=closed`}
            className={`relative pb-6 ${
              activeTab === "closed"
                ? "font-semibold text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[3px] after:w-full after:bg-[#5b66ff]"
                : "text-[#8a8ea4]"
            }`}
          >
            Закрытые
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        {documents.length === 0 && (
          <div className="rounded-[18px] border border-[#e9ecf7] bg-white px-8 py-8 text-[28px] text-[#8a8ea4]">
            Документов пока нет
          </div>
        )}
        {documents.map((document) => {
          const cfg = normalizeDisinfectantConfig(document.config);
          const href = `/journals/${routeCode}/documents/${document.id}`;
          return (
            <div
              key={document.id}
              className="flex items-center justify-between rounded-[18px] border border-[#eaedf7] bg-white px-8 py-5"
            >
              <Link
                href={href}
                className="text-[18px] font-semibold tracking-[-0.02em] text-black"
              >
                {document.title || DISINFECTANT_DOCUMENT_TITLE}
              </Link>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-[14px] text-[#7c8094]">
                    Ответственный за получение
                  </div>
                  <div className="mt-1 text-[16px] font-semibold text-black">
                    {cfg.responsibleRole}
                    {cfg.responsibleEmployee
                      ? `: ${cfg.responsibleEmployee}`
                      : ""}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-full text-[#5b66ff] hover:bg-[#f5f6ff]"
                    >
                      <Ellipsis className="size-8" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[320px] rounded-[28px] border-0 p-5 shadow-xl"
                  >
                    {document.status === "active" && (
                      <DropdownMenuItem
                        className="mb-2 h-14 rounded-2xl px-4 text-[18px]"
                        onSelect={() => setSettingsTarget(document)}
                      >
                        <Pencil className="mr-3 size-6 text-[#6f7282]" />{" "}
                        Настройки
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="mb-2 h-14 rounded-2xl px-4 text-[18px]"
                      onSelect={() =>
                        window.open(
                          `/api/journal-documents/${document.id}/pdf`,
                          "_blank"
                        )
                      }
                    >
                      <Printer className="mr-3 size-6 text-[#6f7282]" /> Печать
                    </DropdownMenuItem>
                    {document.status === "active" && (
                      <>
                        <DropdownMenuItem
                          className="mb-2 h-14 rounded-2xl px-4 text-[18px]"
                          onSelect={() => setArchiveTarget(document)}
                        >
                          <BookOpenText className="mr-3 size-6 text-[#6f7282]" />{" "}
                          Отправить в закрытые
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="h-14 rounded-2xl px-4 text-[18px] text-[#ff3b30] focus:text-[#ff3b30]"
                          onSelect={() =>
                            handleDelete(document.id, document.title)
                          }
                        >
                          <Trash2 className="mr-3 size-6 text-[#ff3b30]" />{" "}
                          Удалить
                        </DropdownMenuItem>
                      </>
                    )}
                    {document.status === "closed" && (
                      <DropdownMenuItem
                        className="mb-2 h-14 rounded-2xl px-4 text-[18px]"
                        onSelect={() => moveToStatus(document.id, "active")}
                      >
                        <BookOpenText className="mr-3 size-6 text-[#6f7282]" />{" "}
                        Отправить в активные
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <SettingsDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        users={users}
        initial={defaultCreateState}
        onSubmit={createDocument}
        submitText="Создать"
        dialogTitle="Создание документа"
      />
      <SettingsDialog
        open={!!settingsTarget}
        onOpenChange={(v) => {
          if (!v) setSettingsTarget(null);
        }}
        users={users}
        initial={
          settingsTarget
            ? {
                title:
                  settingsTarget.title || DISINFECTANT_DOCUMENT_TITLE,
                responsibleRole: normalizeDisinfectantConfig(
                  settingsTarget.config
                ).responsibleRole,
                responsibleEmployee: normalizeDisinfectantConfig(
                  settingsTarget.config
                ).responsibleEmployee,
              }
            : null
        }
        onSubmit={async (v) => {
          if (settingsTarget) await saveSettings(settingsTarget.id, v);
        }}
        submitText="Сохранить"
        dialogTitle="Настройки документа"
      />

      <Dialog
        open={!!archiveTarget}
        onOpenChange={(v) => {
          if (!v) setArchiveTarget(null);
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[660px] rounded-[28px] border-0 p-0">
          <DialogHeader className="border-b px-8 py-6">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-[24px] font-semibold text-black">
                Перенести в архив документ &quot;{archiveTarget?.title}&quot;
              </DialogTitle>
              <button
                type="button"
                className="rounded-xl p-2"
                onClick={() => setArchiveTarget(null)}
              >
                <X className="size-7" />
              </button>
            </div>
          </DialogHeader>
          <div className="flex justify-end px-8 py-6">
            <Button
              className="h-12 rounded-2xl bg-[#5563ff] px-8 text-[18px] text-white hover:bg-[#4554ff]"
              onClick={async () => {
                if (!archiveTarget) return;
                await moveToStatus(archiveTarget.id, "closed");
                setArchiveTarget(null);
              }}
            >
              В архив
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journals/disinfectant-documents-client.tsx
git commit -m "feat: add disinfectant-documents-client list page component"
```

---

### Task 3: Create disinfectant-document-client (single document page)

**Files:**
- Create: `src/components/journals/disinfectant-document-client.tsx`

- [ ] **Step 1: Create the document page component**

This is the main document page with three tables (subdivisions, receipts, consumptions), add/edit dialogs, row selection, and settings. This is the largest file.

```tsx
// src/components/journals/disinfectant-document-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Settings2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DISINFECTANT_HEADING,
  DISINFECTANT_DOCUMENT_TITLE,
  MEASURE_UNIT_LABELS,
  normalizeDisinfectantConfig,
  computeNeedPerTreatment,
  computeNeedPerMonth,
  computeNeedPerYear,
  formatNumber,
  formatQuantityWithUnit,
  createEmptySubdivision,
  createEmptyReceipt,
  createEmptyConsumption,
  type DisinfectantDocumentConfig,
  type SubdivisionRow,
  type ReceiptRow,
  type ConsumptionRow,
  type MeasureUnit,
} from "@/lib/disinfectant-document";

type UserItem = { id: string; name: string; role: string };

type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  status: string;
  users: UserItem[];
  config: unknown;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Управляющий",
  technologist: "Технолог",
  operator: "Сотрудник",
};

function roleOptionsFromUsers(users: UserItem[]) {
  const labels = users.map((u) => ROLE_LABELS[u.role] || u.role);
  return [...new Set(labels)];
}

function usersForRole(users: UserItem[], roleLabel: string) {
  return users.filter((u) => (ROLE_LABELS[u.role] || u.role) === roleLabel);
}

function toIsoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function formatDateRu(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

// ---------- Subdivision Add Dialog ----------
function AddSubdivisionDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (row: SubdivisionRow) => Promise<void>;
}) {
  const [row, setRow] = useState(createEmptySubdivision);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setRow(createEmptySubdivision());
  }

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (v) reset(); props.onOpenChange(v); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[660px] rounded-[28px] border-0 p-0">
        <DialogHeader className="border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[28px] font-semibold tracking-[-0.03em] text-black">
              Добавление новой строки
            </DialogTitle>
            <button type="button" className="rounded-xl p-2" onClick={() => props.onOpenChange(false)}>
              <X className="size-7" />
            </button>
          </div>
        </DialogHeader>
        <div className="space-y-4 px-8 py-6">
          <div className="space-y-2">
            <Label className="text-[16px] text-[#73738a]">Наименование подразделения / объекта</Label>
            <textarea
              value={row.name}
              onChange={(e) => setRow({ ...row, name: e.target.value })}
              placeholder="Наименование подразделения / объекта"
              className="min-h-[100px] w-full rounded-2xl border border-[#d8dae6] px-4 py-3 text-[18px] outline-none focus:border-[#5b66ff]"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[16px] text-[#73738a]">Площадь объекта (кв.м)</Label>
            <Input
              type="number"
              value={row.byCapacity ? "" : (row.area ?? "")}
              onChange={(e) => setRow({ ...row, area: e.target.value ? Number(e.target.value) : null })}
              disabled={row.byCapacity}
              placeholder="Введите площадь объекта (кв.м)"
              className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]"
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={row.byCapacity}
              onCheckedChange={(c) => setRow({ ...row, byCapacity: c, area: c ? null : row.area })}
            />
            <span className="text-[16px]">На ёмкость</span>
          </div>
          <div className="space-y-2">
            <Label className="text-[16px] text-[#73738a]">Вид обработки</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-[16px]">
                <input
                  type="radio"
                  name="treatmentType"
                  checked={row.treatmentType === "current"}
                  onChange={() => setRow({ ...row, treatmentType: "current" })}
                  className="size-5 accent-[#5b66ff]"
                />
                Текущая
              </label>
              <label className="flex items-center gap-2 text-[16px]">
                <input
                  type="radio"
                  name="treatmentType"
                  checked={row.treatmentType === "general"}
                  onChange={() => setRow({ ...row, treatmentType: "general" })}
                  className="size-5 accent-[#5b66ff]"
                />
                Генеральная
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-[16px] text-[#73738a]">Кратность обработок в месяц</Label>
            <Input
              type="number"
              value={row.frequencyPerMonth || ""}
              onChange={(e) => setRow({ ...row, frequencyPerMonth: Number(e.target.value) || 0 })}
              placeholder="Введите кратность обработок в месяц"
              className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]"
            />
          </div>
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={submitting || !row.name.trim()}
              onClick={async () => {
                setSubmitting(true);
                try { await props.onSubmit(row); props.onOpenChange(false); } finally { setSubmitting(false); }
              }}
              className="h-12 rounded-2xl bg-[#5563ff] px-6 text-[18px] text-white hover:bg-[#4554ff]"
            >
              {submitting ? "Создание..." : "Создать"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Receipt Add/Edit Dialog ----------
function ReceiptDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: UserItem[];
  initial: ReceiptRow | null;
  onSubmit: (row: ReceiptRow) => Promise<void>;
  dialogTitle: string;
}) {
  const [row, setRow] = useState<ReceiptRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const roles = useMemo(() => roleOptionsFromUsers(props.users), [props.users]);
  const active = row || props.initial;

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (v) setRow(props.initial); props.onOpenChange(v); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[660px] rounded-[28px] border-0 p-0">
        <DialogHeader className="border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[28px] font-semibold tracking-[-0.03em] text-black">
              {props.dialogTitle}
            </DialogTitle>
            <button type="button" className="rounded-xl p-2" onClick={() => props.onOpenChange(false)}>
              <X className="size-7" />
            </button>
          </div>
        </DialogHeader>
        {active && (
          <div className="space-y-4 px-8 py-6">
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Дата получения</Label>
              <div className="relative">
                <Input type="date" value={active.date} onChange={(e) => setRow({ ...active, date: toIsoDate(e.target.value) })} className="h-14 rounded-2xl border-[#d8dae6] px-4 pr-14 text-[18px]" />
                <CalendarDays className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-[#6e7080]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Наименование дез. средства</Label>
              <Input value={active.disinfectantName} onChange={(e) => setRow({ ...active, disinfectantName: e.target.value })} placeholder="Введите наименование дез. средства" className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Количество полученного дез. средства</Label>
              <Input type="number" value={active.quantity || ""} onChange={(e) => setRow({ ...active, quantity: Number(e.target.value) || 0 })} placeholder="Введите количество" className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]" />
              <div className="flex gap-6 pt-1">
                {(["kg", "l", "bottle"] as MeasureUnit[]).map((u) => (
                  <label key={u} className="flex items-center gap-2 text-[16px]">
                    <input type="radio" checked={active.unit === u} onChange={() => setRow({ ...active, unit: u })} className="size-5 accent-[#5b66ff]" />
                    {MEASURE_UNIT_LABELS[u]}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Срок годности до</Label>
              <div className="relative">
                <Input type="date" value={active.expiryDate} onChange={(e) => setRow({ ...active, expiryDate: toIsoDate(e.target.value) })} className="h-14 rounded-2xl border-[#d8dae6] px-4 pr-14 text-[18px]" />
                <CalendarDays className="pointer-events-none absolute right-4 top-1/2 size-6 -translate-y-1/2 text-[#6e7080]" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Должность ответственного</Label>
              <Select value={active.responsibleRole} onValueChange={(v) => {
                const user = usersForRole(props.users, v)[0];
                setRow({ ...active, responsibleRole: v, responsibleEmployee: user?.name || active.responsibleEmployee });
              }}>
                <SelectTrigger className="h-14 rounded-2xl border-[#d8dae6] bg-[#f1f2f8] px-4 text-[18px]"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Сотрудник</Label>
              <Select value={active.responsibleEmployee} onValueChange={(v) => setRow({ ...active, responsibleEmployee: v })}>
                <SelectTrigger className="h-14 rounded-2xl border-[#d8dae6] bg-[#f1f2f8] px-4 text-[18px]"><SelectValue /></SelectTrigger>
                <SelectContent>{usersForRole(props.users, active.responsibleRole).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" disabled={submitting} onClick={async () => {
                if (!active) return;
                setSubmitting(true);
                try { await props.onSubmit(active); props.onOpenChange(false); } finally { setSubmitting(false); }
              }} className="h-12 rounded-2xl bg-[#5563ff] px-6 text-[18px] text-white hover:bg-[#4554ff]">
                {submitting ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Consumption Add/Edit Dialog ----------
function ConsumptionDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: UserItem[];
  initial: ConsumptionRow | null;
  onSubmit: (row: ConsumptionRow) => Promise<void>;
  dialogTitle: string;
}) {
  const [row, setRow] = useState<ConsumptionRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const roles = useMemo(() => roleOptionsFromUsers(props.users), [props.users]);
  const active = row || props.initial;

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (v) setRow(props.initial); props.onOpenChange(v); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[660px] rounded-[28px] border-0 p-0">
        <DialogHeader className="border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[28px] font-semibold tracking-[-0.03em] text-black">
              {props.dialogTitle}
            </DialogTitle>
            <button type="button" className="rounded-xl p-2" onClick={() => props.onOpenChange(false)}>
              <X className="size-7" />
            </button>
          </div>
        </DialogHeader>
        {active && (
          <div className="space-y-4 px-8 py-6">
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Наименование дез. средства</Label>
              <Input value={active.disinfectantName} onChange={(e) => setRow({ ...active, disinfectantName: e.target.value })} placeholder="Введите наименование дез. средства" className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]" />
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Общее количество полученного дез. средства</Label>
              <Input type="number" value={active.totalReceived || ""} onChange={(e) => setRow({ ...active, totalReceived: Number(e.target.value) || 0 })} placeholder="Количество" className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]" />
              <div className="flex gap-6 pt-1">
                {(["kg", "l", "bottle"] as MeasureUnit[]).map((u) => (
                  <label key={u} className="flex items-center gap-2 text-[16px]">
                    <input type="radio" checked={active.totalReceivedUnit === u} onChange={() => setRow({ ...active, totalReceivedUnit: u })} className="size-5 accent-[#5b66ff]" />
                    {MEASURE_UNIT_LABELS[u]}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Общее количество израсход. дез. средства</Label>
              <Input type="number" value={active.totalConsumed || ""} onChange={(e) => setRow({ ...active, totalConsumed: Number(e.target.value) || 0 })} placeholder="Количество" className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]" />
              <div className="flex gap-6 pt-1">
                {(["kg", "l", "bottle"] as MeasureUnit[]).map((u) => (
                  <label key={u} className="flex items-center gap-2 text-[16px]">
                    <input type="radio" checked={active.totalConsumedUnit === u} onChange={() => setRow({ ...active, totalConsumedUnit: u })} className="size-5 accent-[#5b66ff]" />
                    {MEASURE_UNIT_LABELS[u]}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Остаток на конец периода дез. средства</Label>
              <Input type="number" value={active.remainder || ""} onChange={(e) => setRow({ ...active, remainder: Number(e.target.value) || 0 })} placeholder="Количество" className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[18px]" />
              <div className="flex gap-6 pt-1">
                {(["kg", "l", "bottle"] as MeasureUnit[]).map((u) => (
                  <label key={u} className="flex items-center gap-2 text-[16px]">
                    <input type="radio" checked={active.remainderUnit === u} onChange={() => setRow({ ...active, remainderUnit: u })} className="size-5 accent-[#5b66ff]" />
                    {MEASURE_UNIT_LABELS[u]}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Должность ответственного</Label>
              <Select value={active.responsibleRole} onValueChange={(v) => {
                const user = usersForRole(props.users, v)[0];
                setRow({ ...active, responsibleRole: v, responsibleEmployee: user?.name || active.responsibleEmployee });
              }}>
                <SelectTrigger className="h-14 rounded-2xl border-[#d8dae6] bg-[#f1f2f8] px-4 text-[18px]"><SelectValue /></SelectTrigger>
                <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[16px] text-[#73738a]">Сотрудник</Label>
              <Select value={active.responsibleEmployee} onValueChange={(v) => setRow({ ...active, responsibleEmployee: v })}>
                <SelectTrigger className="h-14 rounded-2xl border-[#d8dae6] bg-[#f1f2f8] px-4 text-[18px]"><SelectValue /></SelectTrigger>
                <SelectContent>{usersForRole(props.users, active.responsibleRole).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" disabled={submitting} onClick={async () => {
                if (!active) return;
                setSubmitting(true);
                try { await props.onSubmit(active); props.onOpenChange(false); } finally { setSubmitting(false); }
              }} className="h-12 rounded-2xl bg-[#5563ff] px-6 text-[18px] text-white hover:bg-[#4554ff]">
                {submitting ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Settings Dialog ----------
function DocumentSettingsDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  users: UserItem[];
  initial: { title: string; responsibleRole: string; responsibleEmployee: string };
  onSubmit: (value: { title: string; responsibleRole: string; responsibleEmployee: string }) => Promise<void>;
}) {
  const [state, setState] = useState(props.initial);
  const [submitting, setSubmitting] = useState(false);
  const roles = useMemo(() => roleOptionsFromUsers(props.users), [props.users]);

  return (
    <Dialog open={props.open} onOpenChange={(v) => { if (v) setState(props.initial); props.onOpenChange(v); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[760px] rounded-[28px] border-0 p-0">
        <DialogHeader className="border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-[32px] font-semibold tracking-[-0.03em] text-black">Настройки документа</DialogTitle>
            <button type="button" className="rounded-xl p-2" onClick={() => props.onOpenChange(false)}><X className="size-8" /></button>
          </div>
        </DialogHeader>
        <div className="space-y-4 px-8 py-6">
          <div className="space-y-2">
            <Label className="text-[18px] text-[#73738a]">Название документа</Label>
            <Input value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} className="h-14 rounded-2xl border-[#d8dae6] px-4 text-[20px]" />
          </div>
          <div className="space-y-2">
            <Label className="text-[18px] text-[#73738a]">Должность ответственного</Label>
            <Select value={state.responsibleRole} onValueChange={(v) => {
              const user = usersForRole(props.users, v)[0];
              setState({ ...state, responsibleRole: v, responsibleEmployee: user?.name || state.responsibleEmployee });
            }}>
              <SelectTrigger className="h-14 rounded-2xl border-[#d8dae6] bg-[#f1f2f8] px-4 text-[20px]"><SelectValue /></SelectTrigger>
              <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-[18px] text-[#73738a]">Сотрудник</Label>
            <Select value={state.responsibleEmployee} onValueChange={(v) => setState({ ...state, responsibleEmployee: v })}>
              <SelectTrigger className="h-14 rounded-2xl border-[#d8dae6] bg-[#f1f2f8] px-4 text-[20px]"><SelectValue /></SelectTrigger>
              <SelectContent>{usersForRole(props.users, state.responsibleRole).map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="button" disabled={submitting} onClick={async () => {
              setSubmitting(true);
              try { await props.onSubmit(state); props.onOpenChange(false); } finally { setSubmitting(false); }
            }} className="h-12 rounded-2xl bg-[#5563ff] px-6 text-[18px] text-white hover:bg-[#4554ff]">
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main Component ----------
export function DisinfectantDocumentClient({ documentId, title, organizationName, status, users, config }: Props) {
  const router = useRouter();
  const normalized = normalizeDisinfectantConfig(config);
  const readOnly = status === "closed";

  // Selection state for each table
  const [selectedSubIds, setSelectedSubIds] = useState<string[]>([]);
  const [selectedRecIds, setSelectedRecIds] = useState<string[]>([]);
  const [selectedConIds, setSelectedConIds] = useState<string[]>([]);

  // Dialog state
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [addRecOpen, setAddRecOpen] = useState(false);
  const [editRecTarget, setEditRecTarget] = useState<ReceiptRow | null>(null);
  const [addConOpen, setAddConOpen] = useState(false);
  const [editConTarget, setEditConTarget] = useState<ConsumptionRow | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  async function patchConfig(nextConfig: DisinfectantDocumentConfig, nextTitle = title) {
    const response = await fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle, config: nextConfig }),
    });
    if (!response.ok) { window.alert("Не удалось сохранить документ"); return; }
    router.refresh();
  }

  // --- Subdivision CRUD ---
  async function addSubdivision(row: SubdivisionRow) {
    await patchConfig({ ...normalized, subdivisions: [...normalized.subdivisions, row] });
  }

  async function deleteSelectedSubs() {
    if (selectedSubIds.length === 0) return;
    if (!window.confirm(`Удалить выбранные строки (${selectedSubIds.length})?`)) return;
    const next = normalized.subdivisions.filter((s) => !selectedSubIds.includes(s.id));
    setSelectedSubIds([]);
    await patchConfig({ ...normalized, subdivisions: next });
  }

  // --- Receipt CRUD ---
  async function addReceipt(row: ReceiptRow) {
    await patchConfig({ ...normalized, receipts: [...normalized.receipts, row] });
  }

  async function updateReceipt(row: ReceiptRow) {
    const next = normalized.receipts.map((r) => (r.id === row.id ? row : r));
    await patchConfig({ ...normalized, receipts: next });
  }

  async function deleteSelectedReceipts() {
    if (selectedRecIds.length === 0) return;
    if (!window.confirm(`Удалить выбранные строки (${selectedRecIds.length})?`)) return;
    const next = normalized.receipts.filter((r) => !selectedRecIds.includes(r.id));
    setSelectedRecIds([]);
    await patchConfig({ ...normalized, receipts: next });
  }

  // --- Consumption CRUD ---
  async function addConsumption(row: ConsumptionRow) {
    await patchConfig({ ...normalized, consumptions: [...normalized.consumptions, row] });
  }

  async function updateConsumption(row: ConsumptionRow) {
    const next = normalized.consumptions.map((c) => (c.id === row.id ? row : c));
    await patchConfig({ ...normalized, consumptions: next });
  }

  async function deleteSelectedConsumptions() {
    if (selectedConIds.length === 0) return;
    if (!window.confirm(`Удалить выбранные строки (${selectedConIds.length})?`)) return;
    const next = normalized.consumptions.filter((c) => !selectedConIds.includes(c.id));
    setSelectedConIds([]);
    await patchConfig({ ...normalized, consumptions: next });
  }

  // --- Totals ---
  const totalNeedPerTreatment = normalized.subdivisions.reduce((sum, s) => sum + computeNeedPerTreatment(s), 0);
  const totalNeedPerMonth = normalized.subdivisions.reduce((sum, s) => sum + computeNeedPerMonth(s), 0);
  const totalNeedPerYear = normalized.subdivisions.reduce((sum, s) => sum + computeNeedPerYear(s), 0);
  const totalReceiptQuantity = normalized.receipts.reduce((sum, r) => sum + r.quantity, 0);

  const allSubsSelected = normalized.subdivisions.length > 0 && selectedSubIds.length === normalized.subdivisions.length;
  const allRecsSelected = normalized.receipts.length > 0 && selectedRecIds.length === normalized.receipts.length;
  const allConsSelected = normalized.consumptions.length > 0 && selectedConIds.length === normalized.consumptions.length;

  const anySelected = selectedSubIds.length > 0 || selectedRecIds.length > 0 || selectedConIds.length > 0;

  return (
    <div className="space-y-8">
      {/* Breadcrumbs + Settings */}
      <div className="flex items-center justify-between">
        <div className="text-[16px] text-[#6f7282]">
          {organizationName} <span className="mx-2">›</span> {DISINFECTANT_HEADING} <span className="mx-2">›</span> {title}
        </div>
        {!readOnly && (
          <Button variant="outline" className="h-12 rounded-xl border-[#e8ebf7] px-5 text-[14px] text-[#5b66ff]" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" /> Настройки журнала
          </Button>
        )}
      </div>

      <h1 className="text-[56px] font-semibold tracking-[-0.04em] text-black">{title}</h1>

      {/* Selection bar */}
      {anySelected && !readOnly && (
        <div className="flex items-center gap-4 rounded-2xl bg-[#f3f4fe] px-6 py-3">
          <button type="button" className="flex items-center gap-1 text-[16px] text-[#5b66ff]" onClick={() => { setSelectedSubIds([]); setSelectedRecIds([]); setSelectedConIds([]); }}>
            <X className="size-4" /> Выбранно: {selectedSubIds.length + selectedRecIds.length + selectedConIds.length}
          </button>
          <button type="button" className="flex items-center gap-1 text-[16px] text-[#ff3b30]" onClick={() => { deleteSelectedSubs(); deleteSelectedReceipts(); deleteSelectedConsumptions(); }}>
            <Trash2 className="size-4" /> Удалить
          </button>
        </div>
      )}

      {/* Document Header */}
      <section className="space-y-4 rounded-[18px] border border-[#dadde9] bg-white p-8">
        <div className="grid grid-cols-[220px_1fr_220px] border border-black/70">
          <div className="flex items-center justify-center border-r border-black/70 py-10 text-[16px] font-semibold">
            {organizationName}
          </div>
          <div className="grid grid-rows-2">
            <div className="flex items-center justify-center border-b border-black/70 py-4 text-[14px]">СИСТЕМА ХАССП</div>
            <div className="flex items-center justify-center px-4 py-4 text-center text-[14px] font-semibold uppercase">
              ЖУРНАЛ УЧЕТА ПОЛУЧЕНИЯ, РАСХОДА ДЕЗИНФИЦИРУЮЩИХ СРЕДСТВ И ПРОВЕДЕНИЯ ДЕЗИНФЕКЦИОННЫХ РАБОТ НА ОБЪЕКТЕ
            </div>
          </div>
          <div className="flex items-center justify-center border-l border-black/70 text-[14px]">СТР. 1 ИЗ 1</div>
        </div>

        {/* === Section 1: Needs Calculation === */}
        <h2 className="pt-4 text-center text-[20px] font-semibold uppercase">
          РАСЧЕТ ПОТРЕБНОСТИ В ДЕЗИНФИЦИРУЮЩИХ СРЕДСТВАХ
        </h2>

        {!readOnly && (
          <Button className="h-14 rounded-2xl bg-[#5563ff] px-8 text-[16px] text-white hover:bg-[#4554ff]" onClick={() => setAddSubOpen(true)}>
            <Plus className="size-5" /> Добавить подразделение
          </Button>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-black/70 bg-white text-[13px]">
            <thead>
              <tr>
                <th rowSpan={2} className="w-12 border border-black/70 px-1 py-2">
                  {!readOnly && <Checkbox checked={allSubsSelected} onCheckedChange={(c) => setSelectedSubIds(c === true ? normalized.subdivisions.map((s) => s.id) : [])} />}
                </th>
                <th rowSpan={2} className="min-w-[200px] border border-black/70 px-2 py-2">Наименование подразделения / объекта подлежащего дезинфекции</th>
                <th rowSpan={2} className="w-[80px] border border-black/70 px-1 py-2">Площадь объекта (кв.м)</th>
                <th rowSpan={2} className="w-[60px] border border-black/70 px-1 py-2">Вид обработки (Т, Г)</th>
                <th rowSpan={2} className="w-[80px] border border-black/70 px-1 py-2">Кратность обработок в месяц</th>
                <th colSpan={2} className="border border-black/70 px-2 py-2">Дезинфицирующее средство</th>
                <th rowSpan={2} className="w-[80px] border border-black/70 px-1 py-2">Расход рабочего раствора на один кв. м. (л)</th>
                <th rowSpan={2} className="w-[100px] border border-black/70 px-1 py-2">Количество рабочего раствора для однократной обработки объекта (л)</th>
                <th colSpan={3} className="border border-black/70 px-2 py-2">Потребность в дезинфицирующем средстве</th>
              </tr>
              <tr>
                <th className="w-[120px] border border-black/70 px-1 py-2">Наименование</th>
                <th className="w-[80px] border border-black/70 px-1 py-2">Концентрация (%)</th>
                <th className="w-[80px] border border-black/70 px-1 py-2">На одну обработку (кг, л)</th>
                <th className="w-[80px] border border-black/70 px-1 py-2">На один месяц (кг, л)</th>
                <th className="w-[80px] border border-black/70 px-1 py-2">На один год (кг, л)</th>
              </tr>
            </thead>
            <tbody>
              {normalized.subdivisions.map((sub) => (
                <tr key={sub.id}>
                  <td className="border border-black/70 px-1 py-2 text-center">
                    {!readOnly && <Checkbox checked={selectedSubIds.includes(sub.id)} onCheckedChange={(c) => setSelectedSubIds((cur) => c === true ? [...new Set([...cur, sub.id])] : cur.filter((id) => id !== sub.id))} />}
                  </td>
                  <td className="border border-black/70 px-2 py-2">{sub.name}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{sub.byCapacity ? "На ёмк." : sub.area}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{sub.treatmentType === "current" ? "Т" : "Г"}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{sub.frequencyPerMonth}</td>
                  <td className="border border-black/70 px-2 py-2">{sub.disinfectantName}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{sub.concentration || ""}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{sub.solutionConsumptionPerSqm || ""}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{sub.solutionPerTreatment || ""}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{formatNumber(computeNeedPerTreatment(sub))}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{formatNumber(computeNeedPerMonth(sub))}</td>
                  <td className="border border-black/70 px-1 py-2 text-center">{formatNumber(computeNeedPerYear(sub))}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={9} className="border border-black/70 px-2 py-2 text-right">Общая потребность дез. средства</td>
                <td className="border border-black/70 px-1 py-2 text-center">{formatNumber(totalNeedPerTreatment)}</td>
                <td className="border border-black/70 px-1 py-2 text-center">{formatNumber(totalNeedPerMonth)}</td>
                <td className="border border-black/70 px-1 py-2 text-center">{formatNumber(totalNeedPerYear)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* === Section 2: Receipts === */}
        <h2 className="pt-8 text-center text-[20px] font-semibold uppercase">
          СВЕДЕНИЯ О ПОСТУПЛЕНИИ ДЕЗИНФИЦИРУЮЩИХ СРЕДСТВ
        </h2>

        {!readOnly && (
          <Button className="h-14 rounded-2xl bg-[#5563ff] px-8 text-[16px] text-white hover:bg-[#4554ff]" onClick={() => setAddRecOpen(true)}>
            <Plus className="size-5" /> Добавить поступление
          </Button>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-black/70 bg-white text-[13px]">
            <thead>
              <tr>
                <th className="w-12 border border-black/70 px-1 py-2">
                  {!readOnly && <Checkbox checked={allRecsSelected} onCheckedChange={(c) => setSelectedRecIds(c === true ? normalized.receipts.map((r) => r.id) : [])} />}
                </th>
                <th className="w-[120px] border border-black/70 px-2 py-2">Дата получения</th>
                <th className="min-w-[200px] border border-black/70 px-2 py-2">Наименование дез. средства</th>
                <th className="w-[160px] border border-black/70 px-2 py-2">Количество полученного дез. средства (кг, литр, флакон)</th>
                <th className="w-[120px] border border-black/70 px-2 py-2">Срок годности до</th>
                <th className="w-[160px] border border-black/70 px-2 py-2">Ответственный за получение</th>
              </tr>
            </thead>
            <tbody>
              {normalized.receipts.map((rec) => (
                <tr key={rec.id} className={!readOnly ? "cursor-pointer hover:bg-[#f8f9ff]" : ""} onClick={() => !readOnly && setEditRecTarget(rec)}>
                  <td className="border border-black/70 px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {!readOnly && <Checkbox checked={selectedRecIds.includes(rec.id)} onCheckedChange={(c) => setSelectedRecIds((cur) => c === true ? [...new Set([...cur, rec.id])] : cur.filter((id) => id !== rec.id))} />}
                  </td>
                  <td className="border border-black/70 px-2 py-2 text-center">{formatDateRu(rec.date)}</td>
                  <td className="border border-black/70 px-2 py-2">{rec.disinfectantName}</td>
                  <td className="border border-black/70 px-2 py-2 text-center">{formatQuantityWithUnit(rec.quantity, rec.unit)}</td>
                  <td className="border border-black/70 px-2 py-2 text-center">{formatDateRu(rec.expiryDate)}</td>
                  <td className="border border-black/70 px-2 py-2">{rec.responsibleEmployee}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={3} className="border border-black/70 px-2 py-2 text-right">Итого:</td>
                <td className="border border-black/70 px-2 py-2 text-center">{totalReceiptQuantity}</td>
                <td colSpan={2} className="border border-black/70 px-2 py-2" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* === Section 3: Consumption === */}
        <h2 className="pt-8 text-center text-[20px] font-semibold uppercase">
          СВЕДЕНИЯ О РАСХОДОВАНИИ ДЕЗИНФИЦИРУЮЩИХ СРЕДСТВ
        </h2>

        {!readOnly && (
          <Button className="h-14 rounded-2xl bg-[#5563ff] px-8 text-[16px] text-white hover:bg-[#4554ff]" onClick={() => setAddConOpen(true)}>
            <Plus className="size-5" /> Добавить расход
          </Button>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-black/70 bg-white text-[13px]">
            <thead>
              <tr>
                <th className="w-12 border border-black/70 px-1 py-2">
                  {!readOnly && <Checkbox checked={allConsSelected} onCheckedChange={(c) => setSelectedConIds(c === true ? normalized.consumptions.map((c2) => c2.id) : [])} />}
                </th>
                <th className="w-[130px] border border-black/70 px-2 py-2">За период с_____ по_____</th>
                <th className="min-w-[180px] border border-black/70 px-2 py-2">Наименование дез. средства</th>
                <th className="w-[160px] border border-black/70 px-2 py-2">Общее количество полученного дез. средства (кг, литр, флакон), в том числе остаток с прошлого периода</th>
                <th className="w-[160px] border border-black/70 px-2 py-2">Общее количество израсходованного за период дез. средства (кг, литр, флакон)</th>
                <th className="w-[140px] border border-black/70 px-2 py-2">Остаток на конец периода дез. средства (кг, литр, флакон)</th>
                <th className="w-[140px] border border-black/70 px-2 py-2">Ответственный за получение</th>
              </tr>
            </thead>
            <tbody>
              {normalized.consumptions.map((con) => (
                <tr key={con.id} className={!readOnly ? "cursor-pointer hover:bg-[#f8f9ff]" : ""} onClick={() => !readOnly && setEditConTarget(con)}>
                  <td className="border border-black/70 px-1 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {!readOnly && <Checkbox checked={selectedConIds.includes(con.id)} onCheckedChange={(c) => setSelectedConIds((cur) => c === true ? [...new Set([...cur, con.id])] : cur.filter((id) => id !== con.id))} />}
                  </td>
                  <td className="border border-black/70 px-2 py-2 text-center">
                    <div>{formatDateRu(con.periodFrom)}</div>
                    <div className="my-1 text-[11px] text-[#999]">—</div>
                    <div>{formatDateRu(con.periodTo)}</div>
                  </td>
                  <td className="border border-black/70 px-2 py-2">{con.disinfectantName}</td>
                  <td className="border border-black/70 px-2 py-2 text-center">{formatQuantityWithUnit(con.totalReceived, con.totalReceivedUnit)}</td>
                  <td className="border border-black/70 px-2 py-2 text-center">{formatQuantityWithUnit(con.totalConsumed, con.totalConsumedUnit)}</td>
                  <td className="border border-black/70 px-2 py-2 text-center">{formatQuantityWithUnit(con.remainder, con.remainderUnit)}</td>
                  <td className="border border-black/70 px-2 py-2">{con.responsibleEmployee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Dialogs */}
      <AddSubdivisionDialog open={addSubOpen} onOpenChange={setAddSubOpen} onSubmit={addSubdivision} />
      <ReceiptDialog
        open={addRecOpen}
        onOpenChange={setAddRecOpen}
        users={users}
        initial={createEmptyReceipt(normalized.responsibleRole, normalized.responsibleEmployee)}
        onSubmit={addReceipt}
        dialogTitle="Добавление новой строки"
      />
      <ReceiptDialog
        open={!!editRecTarget}
        onOpenChange={(v) => { if (!v) setEditRecTarget(null); }}
        users={users}
        initial={editRecTarget}
        onSubmit={updateReceipt}
        dialogTitle="Редактирование строки"
      />
      <ConsumptionDialog
        open={addConOpen}
        onOpenChange={setAddConOpen}
        users={users}
        initial={createEmptyConsumption(normalized.responsibleRole, normalized.responsibleEmployee)}
        onSubmit={addConsumption}
        dialogTitle="Добавление новой строки"
      />
      <ConsumptionDialog
        open={!!editConTarget}
        onOpenChange={(v) => { if (!v) setEditConTarget(null); }}
        users={users}
        initial={editConTarget}
        onSubmit={updateConsumption}
        dialogTitle="Редактирование строки"
      />
      <DocumentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        users={users}
        initial={{
          title,
          responsibleRole: normalized.responsibleRole,
          responsibleEmployee: normalized.responsibleEmployee,
        }}
        onSubmit={async (value) => {
          await patchConfig(
            { ...normalized, responsibleRole: value.responsibleRole, responsibleEmployee: value.responsibleEmployee },
            value.title.trim() || title
          );
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journals/disinfectant-document-client.tsx
git commit -m "feat: add disinfectant-document-client with three tables and dialogs"
```

---

### Task 4: Wire into routing, helpers, and remove from tracked/register

**Files:**
- Modify: `src/lib/tracked-document.ts:14` — remove `"disinfectant_usage"` from array
- Modify: `src/lib/tracked-document.ts:71` — remove title entry
- Modify: `src/lib/register-document.ts:2` — remove `"disinfectant_usage"` from array
- Modify: `src/lib/register-document.ts:41` — remove title entry
- Modify: `src/lib/journal-document-helpers.ts` — add disinfectant imports and routing
- Modify: `src/app/(dashboard)/journals/[code]/page.tsx` — add DisinfectantDocumentsClient branch
- Modify: `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx` — add DisinfectantDocumentClient branch

- [ ] **Step 1: Remove disinfectant_usage from tracked-document.ts**

In `src/lib/tracked-document.ts`, remove line 14 (`"disinfectant_usage",`) from TRACKED_DOCUMENT_TEMPLATE_CODES array, and remove line 71 (`disinfectant_usage: "Журнал учета дезинфицирующих средств",`) from the titles object.

- [ ] **Step 2: Remove disinfectant_usage from register-document.ts**

In `src/lib/register-document.ts`, remove `"disinfectant_usage",` from REGISTER_DOCUMENT_TEMPLATE_CODES array (line 2), and remove `disinfectant_usage: "Журнал учета дезинфицирующих средств",` from TITLES (line 41).

- [ ] **Step 3: Add disinfectant to journal-document-helpers.ts**

Add import at top:
```typescript
import {
  DISINFECTANT_TEMPLATE_CODE,
  DISINFECTANT_DOCUMENT_TITLE,
} from "@/lib/disinfectant-document";
```

Add to `isDocumentTemplate()` — before the `isTrackedDocumentTemplate` line:
```typescript
    templateCode === DISINFECTANT_TEMPLATE_CODE ||
```

Add to `getJournalDocumentDefaultTitle()` — before the `isTrackedDocumentTemplate` block:
```typescript
  if (templateCode === DISINFECTANT_TEMPLATE_CODE) {
    return DISINFECTANT_DOCUMENT_TITLE;
  }
```

- [ ] **Step 4: Add DisinfectantDocumentsClient to journals/[code]/page.tsx**

Add imports near the training plan imports:
```typescript
import {
  DISINFECTANT_TEMPLATE_CODE,
  DISINFECTANT_SOURCE_SLUG,
  DISINFECTANT_DOCUMENT_TITLE,
  getDisinfectantDefaultConfig,
  normalizeDisinfectantConfig,
} from "@/lib/disinfectant-document";
import { DisinfectantDocumentsClient } from "@/components/journals/disinfectant-documents-client";
```

Add an if-block before the training_plan block (around line 870), following the same pattern:
```typescript
  if (resolvedCode === DISINFECTANT_TEMPLATE_CODE) {
    const existingDis = await db.journalDocument.findMany({
      where: { templateId: template.id, organizationId: session.user.organizationId },
      select: { status: true },
    });
    const disStatuses = new Set(existingDis.map((d) => d.status));
    if (!disStatuses.has("active")) {
      const now = new Date();
      const defaultCfg = getDisinfectantDefaultConfig();
      await db.journalDocument.create({
        data: {
          templateId: template.id,
          organizationId: session.user.organizationId,
          title: DISINFECTANT_DOCUMENT_TITLE,
          status: "active",
          dateFrom: now,
          dateTo: now,
          createdById: session.user.id,
          config: defaultCfg as any,
        },
      });
    }

    const disDocuments = await db.journalDocument.findMany({
      where: {
        organizationId: session.user.organizationId,
        templateId: template.id,
        status: activeTab,
      },
      orderBy: { createdAt: "asc" },
    });

    return (
      <DisinfectantDocumentsClient
        routeCode={code === DISINFECTANT_SOURCE_SLUG ? code : resolvedCode}
        templateCode={resolvedCode}
        activeTab={activeTab}
        users={orgUsers}
        documents={disDocuments.map((document) => ({
          id: document.id,
          title: document.title || DISINFECTANT_DOCUMENT_TITLE,
          status: document.status as "active" | "closed",
          config: document.config,
        }))}
      />
    );
  }
```

- [ ] **Step 5: Add DisinfectantDocumentClient to documents/[docId]/page.tsx**

Add imports:
```typescript
import { DISINFECTANT_TEMPLATE_CODE } from "@/lib/disinfectant-document";
import { DisinfectantDocumentClient } from "@/components/journals/disinfectant-document-client";
```

Add if-block before the training_plan block:
```typescript
  if (document.template.code === DISINFECTANT_TEMPLATE_CODE) {
    return (
      <DisinfectantDocumentClient
        documentId={document.id}
        title={document.title}
        organizationName={organization?.name || 'ООО "Тест"'}
        status={document.status}
        users={enrichedEmployees}
        config={document.config}
      />
    );
  }
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/tracked-document.ts src/lib/register-document.ts src/lib/journal-document-helpers.ts src/app
git commit -m "feat: wire disinfectant document into routing and remove from tracked/register"
```

---

### Task 5: Update seed and verify build

**Files:**
- Modify: `prisma/seed.ts:400-401` — update template name

- [ ] **Step 1: Update the template name in seed.ts**

Change the disinfectant_usage template name from:
```
name: "Учёт дезинфицирующих средств",
```
to:
```
name: "Журнал учета получения, расхода дезинфицирующих средств и проведения дезинфекционных работ на объекте",
```

- [ ] **Step 2: Run build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build completes successfully

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update disinfectant template name to full title in seed"
```

---

### Task 6: Run seed and verify end-to-end

- [ ] **Step 1: Generate Prisma client and push schema**

Run:
```bash
npx prisma generate
npx prisma db push
```

- [ ] **Step 2: Run seed to update template**

Run:
```bash
npx tsx prisma/seed.ts
```

- [ ] **Step 3: Start dev server and test**

Run: `npm run dev`

Navigate to the disinfectant journal page. Verify:
- List page shows with Active/Closed tabs
- Auto-seeded document appears with default data
- Clicking opens document page with 3 tables
- Add subdivision dialog works
- Add receipt dialog works
- Add consumption dialog works
- Edit receipt/consumption dialogs work (click on row)
- Settings dialog works
- Delete rows via checkbox selection works
- Archive/restore works

- [ ] **Step 4: Commit any fixes if needed**
