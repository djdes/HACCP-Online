# Fryer Oil Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a fully custom "Журнал учета использования фритюрных жиров" journal with event-log style entries, editable select lists, and PDF generation matching the source HACCP-Online design.

**Architecture:** The journal uses the existing `JournalDocument` + `JournalDocumentEntry` Prisma models. Each entry represents one frying event (not a grid cell). A custom lib file defines types/normalizers, a custom client component handles the UI (add row dialog, edit lists dialog, table), and a documents-list client handles the list page. PDF generation adds an appendix with quality assessment methodology.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, shadcn/ui, Tailwind CSS, jsPDF + autoTable

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/fryer-oil-document.ts` | Create | Types, normalizers, constants, quality assessment data |
| `src/components/journals/fryer-oil-document-client.tsx` | Create | Single document view: table, add-row dialog, edit-lists dialog, settings dialog |
| `src/components/journals/fryer-oil-documents-client.tsx` | Create | Document list with Active/Closed tabs, create/settings/delete |
| `src/lib/tracked-document.ts:68` | Modify | Update title to "Журнал учета использования фритюрных жиров" |
| `src/lib/tracked-document.ts:86-99` | Modify | Add `fryer_oil` create mode as `"fryer_oil"` |
| `src/app/(dashboard)/journals/[code]/page.tsx` | Modify | Route `fryer_oil` to `FryerOilDocumentsClient` |
| `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx` | Modify | Route `fryer_oil` to `FryerOilDocumentClient` |
| `src/components/journals/create-document-dialog.tsx` | Modify | Add fryer_oil create mode (simple: title + date) |
| `src/lib/document-pdf.ts` | Modify | Add `drawFryerOilPdf()` with appendix |
| `prisma/seed.ts:364-399` | Modify | Update template name and fields to match new structure |

---

### Task 1: Create lib file with types, normalizers, and constants

**Files:**
- Create: `src/lib/fryer-oil-document.ts`

- [ ] **Step 1: Create the fryer oil document lib file**

```typescript
export const FRYER_OIL_TEMPLATE_CODE = "fryer_oil";

export const FRYER_OIL_PAGE_TITLE = "Журнал учета использования фритюрных жиров";

// Default select lists stored in document config
export type FryerOilSelectLists = {
  fatTypes: string[];
  equipmentTypes: string[];
  productTypes: string[];
};

export type FryerOilDocumentConfig = {
  lists: FryerOilSelectLists;
};

export type FryerOilEntryData = {
  startDate: string;       // "2026-04-09"
  startHour: number;       // 0-23
  startMinute: number;     // 0-59
  fatType: string;         // from lists
  qualityStart: number;    // 1-5 score
  equipmentType: string;   // from lists
  productType: string;     // from lists
  endHour: number;         // 0-23
  endMinute: number;       // 0-59
  qualityEnd: number;      // 1-5 score
  carryoverKg: number;     // kg remaining
  disposedKg: number;      // kg disposed
  controllerName: string;  // employee name
};

export const DEFAULT_FAT_TYPES = [
  "Подсолнечное масло",
  "Пальмовое масло",
  "Рапсовое масло",
  "Фритюрный жир",
];

export const DEFAULT_EQUIPMENT_TYPES = [
  "Фритюрница настольная",
  "Фритюрница напольная",
  "Жарочный шкаф",
];

export const DEFAULT_PRODUCT_TYPES = [
  "Картофель фри",
  "Пельмени",
  "Вареники",
  "Рыба в кляре",
  "Куриные наггетсы",
];

export const QUALITY_LABELS: Record<number, string> = {
  5: "Отличное",
  4: "Хорошее",
  3: "Удовлетворительное",
  2: "Неудовлетворительное",
  1: "Неудовлетворительное",
};

export const QUALITY_ASSESSMENT_TABLE = {
  headers: ["Показатели качества", "отлично", "хорошо", "удовлетворительно", "неудовлетворительно"],
  rows: [
    {
      indicator: "Цвет (в проходящем и отраженном свете на белом фоне при температуре 40°С)",
      ratings: ["Соломенно-желтый", "Интенсивно-желтый с коричневым оттенком", "Светло-коричневый", "Коричневый или темно-коричневый"],
    },
    {
      indicator: "Вкус",
      ratings: ["Без постороннего привкуса", "Слабо выраженный горьковатый", "Горький, с ярко выраженным посторонним привкусом", "Очень горький, вызывающий неприятное ощущение першения"],
    },
    {
      indicator: "Запах (при температуре не ниже 50°С)",
      ratings: ["Без постороннего запаха", "Слабо выраженный, неприятный, продуктов термического распада масла", "Выраженный, неприятный, продуктов термического распада масла", "Резкий, неприятный, продуктов термического распада масла"],
    },
  ],
  scoringTable: [
    { quality: "Отличное", score: "5" },
    { quality: "Хорошее", score: "4" },
    { quality: "Удовлетворительное", score: "3" },
    { quality: "Неудовлетворительное", score: "2 или 1" },
  ],
  formula: "(4 x 3 + 3 x 2 + 3 x 2) / 7 = 3,4",
  formulaExplanation: [
    "где в числителе:",
    "4, 3, 3 - баллы по показателям качества",
    "3, 2, 2 - коэффициенты важности",
    "в знаменателе:",
    "7 - сумма коэффициентов важности",
  ],
};

export function defaultFryerOilDocumentConfig(): FryerOilDocumentConfig {
  return {
    lists: {
      fatTypes: [...DEFAULT_FAT_TYPES],
      equipmentTypes: [...DEFAULT_EQUIPMENT_TYPES],
      productTypes: [...DEFAULT_PRODUCT_TYPES],
    },
  };
}

export function normalizeFryerOilDocumentConfig(value: unknown): FryerOilDocumentConfig {
  const defaults = defaultFryerOilDocumentConfig();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const item = value as Record<string, unknown>;
  const lists = item.lists && typeof item.lists === "object" && !Array.isArray(item.lists)
    ? (item.lists as Record<string, unknown>)
    : {};

  return {
    lists: {
      fatTypes: Array.isArray(lists.fatTypes) && lists.fatTypes.length > 0
        ? lists.fatTypes.filter((v): v is string => typeof v === "string")
        : defaults.lists.fatTypes,
      equipmentTypes: Array.isArray(lists.equipmentTypes) && lists.equipmentTypes.length > 0
        ? lists.equipmentTypes.filter((v): v is string => typeof v === "string")
        : defaults.lists.equipmentTypes,
      productTypes: Array.isArray(lists.productTypes) && lists.productTypes.length > 0
        ? lists.productTypes.filter((v): v is string => typeof v === "string")
        : defaults.lists.productTypes,
    },
  };
}

export function normalizeFryerOilEntryData(value: unknown): FryerOilEntryData {
  const defaults: FryerOilEntryData = {
    startDate: "",
    startHour: 0,
    startMinute: 0,
    fatType: "",
    qualityStart: 5,
    equipmentType: "",
    productType: "",
    endHour: 0,
    endMinute: 0,
    qualityEnd: 5,
    carryoverKg: 0,
    disposedKg: 0,
    controllerName: "",
  };

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const item = value as Record<string, unknown>;
  return {
    startDate: typeof item.startDate === "string" ? item.startDate : defaults.startDate,
    startHour: typeof item.startHour === "number" ? item.startHour : defaults.startHour,
    startMinute: typeof item.startMinute === "number" ? item.startMinute : defaults.startMinute,
    fatType: typeof item.fatType === "string" ? item.fatType : defaults.fatType,
    qualityStart: typeof item.qualityStart === "number" && item.qualityStart >= 1 && item.qualityStart <= 5 ? item.qualityStart : defaults.qualityStart,
    equipmentType: typeof item.equipmentType === "string" ? item.equipmentType : defaults.equipmentType,
    productType: typeof item.productType === "string" ? item.productType : defaults.productType,
    endHour: typeof item.endHour === "number" ? item.endHour : defaults.endHour,
    endMinute: typeof item.endMinute === "number" ? item.endMinute : defaults.endMinute,
    qualityEnd: typeof item.qualityEnd === "number" && item.qualityEnd >= 1 && item.qualityEnd <= 5 ? item.qualityEnd : defaults.qualityEnd,
    carryoverKg: typeof item.carryoverKg === "number" ? item.carryoverKg : defaults.carryoverKg,
    disposedKg: typeof item.disposedKg === "number" ? item.disposedKg : defaults.disposedKg,
    controllerName: typeof item.controllerName === "string" ? item.controllerName : defaults.controllerName,
  };
}

export function getFryerOilDocumentTitle() {
  return FRYER_OIL_PAGE_TITLE;
}

export function getFryerOilFilePrefix() {
  return "fryer-oil-journal";
}

export function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatDateRu(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toLocaleDateString("ru-RU");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fryer-oil-document.ts
git commit -m "feat: add fryer oil document lib with types and normalizers"
```

---

### Task 2: Update tracked-document.ts and seed.ts

**Files:**
- Modify: `src/lib/tracked-document.ts:68`
- Modify: `src/lib/tracked-document.ts:86-99`
- Modify: `prisma/seed.ts:364-399`

- [ ] **Step 1: Update tracked document title**

In `src/lib/tracked-document.ts`, change line 68:
```typescript
// OLD:
  fryer_oil: "Журнал фритюрного масла",
// NEW:
  fryer_oil: "Журнал учета использования фритюрных жиров",
```

- [ ] **Step 2: Add fryer_oil create mode**

In `src/lib/tracked-document.ts`, in `getTrackedDocumentCreateMode()`, add before the `return "default"`:
```typescript
  if (templateCode === "fryer_oil") return "fryer_oil";
```

- [ ] **Step 3: Update seed template name**

In `prisma/seed.ts`, update the fryer_oil template entry (around line 364):
```typescript
  {
    code: "fryer_oil",
    name: "Журнал учета использования фритюрных жиров",
    description: "Контроль качества фритюрных жиров: органолептика, кислотное число, замена",
    sortOrder: 14,
    isMandatorySanpin: true,
    isMandatoryHaccp: false,
    fields: [],
  },
```

Note: We clear fields to `[]` because fryer_oil now uses its own custom entry structure via `FryerOilEntryData`, not generic tracked fields.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tracked-document.ts prisma/seed.ts
git commit -m "feat: update fryer oil template title and create mode"
```

---

### Task 3: Create documents list client component

**Files:**
- Create: `src/components/journals/fryer-oil-documents-client.tsx`

- [ ] **Step 1: Create the documents list client**

This follows the UV lamp runtime documents client pattern. It shows Active/Closed tabs, document list, create/settings/delete actions. The settings dialog allows editing title and start date.

```typescript
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenText, Ellipsis, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { CreateDocumentDialog } from "@/components/journals/create-document-dialog";
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
import { FRYER_OIL_PAGE_TITLE } from "@/lib/fryer-oil-document";

type DocumentItem = {
  id: string;
  title: string;
  status: "active" | "closed";
  responsibleTitle: string | null;
  dateFrom: string;
};

type Props = {
  activeTab: "active" | "closed";
  routeCode?: string;
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  documents: DocumentItem[];
};

type EditingState = {
  id: string;
  title: string;
  dateFrom: string;
};

function FryerOilSettingsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: EditingState | null;
  onSaved: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [dateFrom, setDateFrom] = useState("");

  useEffect(() => {
    if (!props.editing) return;
    setTitle(props.editing.title);
    setDateFrom(props.editing.dateFrom);
  }, [props.editing]);

  async function handleSave() {
    if (!props.editing) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/journal-documents/${props.editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), dateFrom }),
      });
      if (!response.ok) throw new Error("save_failed");
      props.onOpenChange(false);
      props.onSaved();
    } catch {
      window.alert("Не удалось сохранить настройки документа");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] rounded-[24px] border-0 p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-7 py-5">
          <DialogTitle className="text-[24px] font-semibold tracking-[-0.03em] text-black">
            Настройки документа
          </DialogTitle>
          <button
            type="button"
            className="rounded-md p-1 text-black/80 hover:bg-black/5"
            onClick={() => props.onOpenChange(false)}
          >
            <X className="size-6" />
          </button>
        </DialogHeader>
        <div className="space-y-4 px-7 py-6">
          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Название документа</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-14 rounded-2xl border-[#dfe1ec] px-4 text-[18px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[16px] text-[#6f7282]">Дата начала</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-14 rounded-2xl border-[#dfe1ec] px-4 text-[18px]"
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="h-14 rounded-xl bg-[#5863f8] px-7 text-[20px] font-medium text-white hover:bg-[#4b57f3]"
            >
              {submitting ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDateLabel(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toLocaleDateString("ru-RU").replaceAll(".", "-");
}

export function FryerOilDocumentsClient(props: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditingState | null>(null);
  const routeCode = props.routeCode || props.templateCode;

  async function handleDelete(documentId: string, title: string) {
    if (!window.confirm(`Удалить документ "${title}"?`)) return;
    const response = await fetch(`/api/journal-documents/${documentId}`, { method: "DELETE" });
    if (!response.ok) {
      window.alert("Не удалось удалить документ");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[54px] font-semibold tracking-[-0.04em] text-black">
          {FRYER_OIL_PAGE_TITLE}{props.activeTab === "closed" ? " (Закрытые!!!)" : ""}
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-12 rounded-xl border-[#eef0fb] px-4 text-[14px] text-[#5464ff] shadow-none hover:bg-[#f8f9ff]"
            asChild
          >
            <Link href="/sanpin">
              <BookOpenText className="size-4" />
              Инструкция
            </Link>
          </Button>
          {props.activeTab === "active" && (
            <CreateDocumentDialog
              templateCode={props.templateCode}
              templateName={props.templateName}
              users={props.users}
              triggerClassName="h-12 rounded-xl bg-[#5b66ff] px-5 text-[14px] font-medium text-white hover:bg-[#4c58ff]"
              triggerLabel="Создать документ"
              triggerIcon={<Plus className="size-4" />}
            />
          )}
        </div>
      </div>

      <div className="border-b border-[#d9dce8]">
        <div className="flex gap-9 text-[15px]">
          <Link
            href={`/journals/${routeCode}`}
            className={`relative pb-4 ${
              props.activeTab === "active"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#5b66ff]"
                : "text-[#7c7c93]"
            }`}
          >
            Активные
          </Link>
          <Link
            href={`/journals/${routeCode}?tab=closed`}
            className={`relative pb-4 ${
              props.activeTab === "closed"
                ? "font-medium text-black after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[#5b66ff]"
                : "text-[#7c7c93]"
            }`}
          >
            Закрытые
          </Link>
        </div>
      </div>

      <div className="space-y-3">
        {props.documents.length === 0 && (
          <div className="rounded-[16px] border border-[#eceef5] bg-white px-6 py-8 text-center text-[16px] text-[#7d8196]">
            Документов пока нет
          </div>
        )}
        {props.documents.map((document) => {
          const href = `/journals/${routeCode}/documents/${document.id}`;
          return (
            <div
              key={document.id}
              className="grid grid-cols-[minmax(0,1fr)_180px_40px] items-center rounded-[16px] border border-[#eef0f6] bg-white px-3 py-4"
            >
              <Link href={href} className="px-2 text-[14px] font-semibold leading-5 text-black">
                {document.title}
              </Link>
              <Link href={href} className="border-l border-[#edf0f7] px-6">
                <div className="text-[11px] text-[#979aab]">Дата начала</div>
                <div className="mt-1 text-[12px] font-semibold text-black">
                  {formatDateLabel(document.dateFrom)}
                </div>
              </Link>
              <div className="flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full text-[#5b66ff] hover:bg-[#f5f6ff]"
                    >
                      <Ellipsis className="size-6" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[206px] rounded-[14px] border border-[#eceef5] p-2 shadow-lg">
                    {document.status === "active" && (
                      <DropdownMenuItem
                        className="h-11 rounded-lg px-3 text-[14px]"
                        onSelect={() =>
                          setEditing({
                            id: document.id,
                            title: document.title,
                            dateFrom: document.dateFrom,
                          })
                        }
                      >
                        <Pencil className="mr-2 size-4 text-[#6f7282]" />
                        Настройки
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="h-11 rounded-lg px-3 text-[14px]"
                      onSelect={() => window.open(`/api/journal-documents/${document.id}/pdf`, "_blank")}
                    >
                      <Printer className="mr-2 size-4 text-[#6f7282]" />
                      Печать
                    </DropdownMenuItem>
                    {document.status === "active" && (
                      <DropdownMenuItem
                        className="h-11 rounded-lg px-3 text-[14px] text-[#ff3b30] focus:text-[#ff3b30]"
                        onSelect={() => handleDelete(document.id, document.title)}
                      >
                        <Trash2 className="mr-2 size-4 text-[#ff3b30]" />
                        Удалить
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <FryerOilSettingsDialog
        open={!!editing}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
        editing={editing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journals/fryer-oil-documents-client.tsx
git commit -m "feat: add fryer oil documents list client component"
```

---

### Task 4: Create single document client component

**Files:**
- Create: `src/components/journals/fryer-oil-document-client.tsx`

- [ ] **Step 1: Create the fryer oil document client**

This is the main document view. It displays entries in a table matching the screenshot layout, with "Добавить" and "Редактировать списки" buttons. The add-row dialog has date+time pickers and field selects. The edit-lists dialog manages fat types, equipment types, and product types.

The component receives entries pre-loaded from the server and manages local state for CRUD. Each entry uses the existing `/api/journal-documents/[id]/entries` PUT endpoint with `employeeId` set to a fixed sentinel value (first user or "system"), since fryer oil entries aren't employee-specific.

```typescript
"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FRYER_OIL_PAGE_TITLE,
  QUALITY_LABELS,
  QUALITY_ASSESSMENT_TABLE,
  formatTime,
  formatDateRu,
  normalizeFryerOilEntryData,
  normalizeFryerOilDocumentConfig,
  type FryerOilEntryData,
  type FryerOilDocumentConfig,
  type FryerOilSelectLists,
} from "@/lib/fryer-oil-document";

type EntryItem = {
  id: string;
  date: string;
  data: FryerOilEntryData;
};

type UserItem = {
  id: string;
  name: string;
  role: string;
};

type Props = {
  documentId: string;
  title: string;
  organizationName: string;
  status: string;
  dateFrom: string;
  config: FryerOilDocumentConfig;
  users: UserItem[];
  initialEntries: EntryItem[];
  routeCode: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

// ─── Edit Lists Dialog ───────────────────────────────────────────────

function EditListsDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: FryerOilSelectLists;
  onSave: (lists: FryerOilSelectLists) => void;
}) {
  const [activeList, setActiveList] = useState<keyof FryerOilSelectLists>("fatTypes");
  const [items, setItems] = useState<Record<keyof FryerOilSelectLists, string[]>>({
    fatTypes: [...props.lists.fatTypes],
    equipmentTypes: [...props.lists.equipmentTypes],
    productTypes: [...props.lists.productTypes],
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newValue, setNewValue] = useState("");

  const listLabels: Record<keyof FryerOilSelectLists, string> = {
    fatTypes: "Вид фритюрного жира",
    equipmentTypes: "Тип жарочного оборудования",
    productTypes: "Вид продукции",
  };

  function handleAdd() {
    if (!newValue.trim()) return;
    setItems((prev) => ({
      ...prev,
      [activeList]: [...prev[activeList], newValue.trim()],
    }));
    setNewValue("");
  }

  function handleDelete(index: number) {
    setItems((prev) => ({
      ...prev,
      [activeList]: prev[activeList].filter((_, i) => i !== index),
    }));
  }

  function handleEditSave(index: number) {
    if (!editValue.trim()) return;
    setItems((prev) => ({
      ...prev,
      [activeList]: prev[activeList].map((v, i) => (i === index ? editValue.trim() : v)),
    }));
    setEditingIndex(null);
    setEditValue("");
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] rounded-[24px] border-0 p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-7 py-5">
          <DialogTitle className="text-[24px] font-semibold text-black">
            Редактировать список изделий
          </DialogTitle>
          <button
            type="button"
            className="rounded-md p-1 text-black/80 hover:bg-black/5"
            onClick={() => props.onOpenChange(false)}
          >
            <X className="size-6" />
          </button>
        </DialogHeader>
        <div className="px-7 py-6">
          <div className="mb-4 flex gap-2">
            {(Object.keys(listLabels) as (keyof FryerOilSelectLists)[]).map((key) => (
              <button
                key={key}
                type="button"
                className={`rounded-lg px-3 py-2 text-[13px] ${activeList === key ? "bg-[#5b66ff] text-white" : "bg-[#f3f4fb] text-[#6f7282]"}`}
                onClick={() => setActiveList(key)}
              >
                {listLabels[key]}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {items[activeList].map((item, index) => (
              <div key={index} className="flex items-center gap-2 rounded-xl border border-[#eceef5] px-4 py-3">
                {editingIndex === index ? (
                  <>
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-8 flex-1 text-[14px]"
                      autoFocus
                    />
                    <button type="button" onClick={() => handleEditSave(index)} className="text-green-600 hover:text-green-700">
                      <Check className="size-4" />
                    </button>
                    <button type="button" onClick={() => setEditingIndex(null)} className="text-gray-400 hover:text-gray-600">
                      <X className="size-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-[14px]">{item}</span>
                    <button
                      type="button"
                      onClick={() => { setEditingIndex(index); setEditValue(item); }}
                      className="text-[#6f7282] hover:text-black"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(index)}
                      className="text-[#ff3b30] hover:text-red-700"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Новый элемент..."
              className="h-10 flex-1 rounded-xl text-[14px]"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            />
            <Button type="button" onClick={handleAdd} className="h-10 rounded-xl bg-[#5b66ff] px-4 text-[13px] text-white hover:bg-[#4b57ff]">
              Добавить
            </Button>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              onClick={() => { props.onSave(items); props.onOpenChange(false); }}
              className="h-11 rounded-xl bg-[#5863f8] px-6 text-[16px] font-medium text-white hover:bg-[#4b57f3]"
            >
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add Entry Dialog ────────────────────────────────────────────────

function AddEntryDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: FryerOilSelectLists;
  users: UserItem[];
  onAdd: (data: FryerOilEntryData) => void;
}) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [startDate, setStartDate] = useState(todayStr);
  const [startHour, setStartHour] = useState(now.getHours());
  const [startMinute, setStartMinute] = useState(now.getMinutes());
  const [fatType, setFatType] = useState(props.lists.fatTypes[0] || "");
  const [qualityStart, setQualityStart] = useState(5);
  const [equipmentType, setEquipmentType] = useState(props.lists.equipmentTypes[0] || "");
  const [productType, setProductType] = useState(props.lists.productTypes[0] || "");
  const [endHour, setEndHour] = useState(now.getHours());
  const [endMinute, setEndMinute] = useState(now.getMinutes());
  const [qualityEnd, setQualityEnd] = useState(5);
  const [carryoverKg, setCarryoverKg] = useState("");
  const [disposedKg, setDisposedKg] = useState("");
  const [controllerName, setControllerName] = useState(props.users[0]?.name || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    props.onAdd({
      startDate,
      startHour,
      startMinute,
      fatType,
      qualityStart,
      equipmentType,
      productType,
      endHour,
      endMinute,
      qualityEnd,
      carryoverKg: parseFloat(carryoverKg) || 0,
      disposedKg: parseFloat(disposedKg) || 0,
      controllerName,
    });
    props.onOpenChange(false);
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[620px] max-h-[90vh] overflow-y-auto rounded-[24px] border-0 p-0">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-7 py-5">
          <DialogTitle className="text-[24px] font-semibold text-black">
            Добавление новой строки
          </DialogTitle>
          <button type="button" className="rounded-md p-1 text-black/80 hover:bg-black/5" onClick={() => props.onOpenChange(false)}>
            <X className="size-6" />
          </button>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 px-7 py-6">
          {/* Date and time of start */}
          <fieldset className="space-y-3">
            <legend className="text-[16px] font-medium text-black">Дата и время начала использования</legend>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-12 rounded-2xl border-[#dfe1ec] px-4 text-[16px]" required />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[14px] text-[#6f7282]">Часы</Label>
                <Select value={String(startHour)} onValueChange={(v) => setStartHour(Number(v))}>
                  <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[14px] text-[#6f7282]">Минуты</Label>
                <Select value={String(startMinute)} onValueChange={(v) => setStartMinute(Number(v))}>
                  <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          {/* Fat type */}
          <div className="space-y-1">
            <Label className="text-[14px] text-[#6f7282]">Вид фритюрного жира</Label>
            <Select value={fatType} onValueChange={setFatType}>
              <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue placeholder="Выберите из списка или добавьте новый..." /></SelectTrigger>
              <SelectContent>{props.lists.fatTypes.map((ft) => <SelectItem key={ft} value={ft}>{ft}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Quality at start */}
          <div className="space-y-1">
            <Label className="text-[14px] text-[#6f7282]">Органолептическая оценка на начало жарки (балл)</Label>
            <Select value={String(qualityStart)} onValueChange={(v) => setQualityStart(Number(v))}>
              <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 4, 3, 2, 1].map((v) => <SelectItem key={v} value={String(v)}>{v} — {QUALITY_LABELS[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Equipment type */}
          <div className="space-y-1">
            <Label className="text-[14px] text-[#6f7282]">Тип жарочного оборудования</Label>
            <Select value={equipmentType} onValueChange={setEquipmentType}>
              <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue placeholder="Выберите..." /></SelectTrigger>
              <SelectContent>{props.lists.equipmentTypes.map((et) => <SelectItem key={et} value={et}>{et}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* Product type */}
          <div className="space-y-1">
            <Label className="text-[14px] text-[#6f7282]">Вид продукции</Label>
            <Select value={productType} onValueChange={setProductType}>
              <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue placeholder="Выберите..." /></SelectTrigger>
              <SelectContent>{props.lists.productTypes.map((pt) => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {/* End time */}
          <fieldset className="space-y-3">
            <legend className="text-[16px] font-medium text-black">Время окончания фритюрной жарки</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[14px] text-[#6f7282]">Часы</Label>
                <Select value={String(endHour)} onValueChange={(v) => setEndHour(Number(v))}>
                  <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{HOURS.map((h) => <SelectItem key={h} value={String(h)}>{h}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[14px] text-[#6f7282]">Минуты</Label>
                <Select value={String(endMinute)} onValueChange={(v) => setEndMinute(Number(v))}>
                  <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{MINUTES.map((m) => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          {/* Quality at end */}
          <div className="space-y-1">
            <Label className="text-[14px] text-[#6f7282]">Органолептическая оценка по окончании жарки (балл)</Label>
            <Select value={String(qualityEnd)} onValueChange={(v) => setQualityEnd(Number(v))}>
              <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 4, 3, 2, 1].map((v) => <SelectItem key={v} value={String(v)}>{v} — {QUALITY_LABELS[v]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Remaining fat usage */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[14px] text-[#6f7282]">Переходящий остаток, кг</Label>
              <Input type="number" step="0.1" min="0" value={carryoverKg} onChange={(e) => setCarryoverKg(e.target.value)} className="h-12 rounded-2xl border-[#dfe1ec] px-4 text-[16px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[14px] text-[#6f7282]">Утилизированный, кг</Label>
              <Input type="number" step="0.1" min="0" value={disposedKg} onChange={(e) => setDisposedKg(e.target.value)} className="h-12 rounded-2xl border-[#dfe1ec] px-4 text-[16px]" />
            </div>
          </div>

          {/* Controller */}
          <div className="space-y-1">
            <Label className="text-[14px] text-[#6f7282]">Должность, ФИО контролера</Label>
            <Select value={controllerName} onValueChange={setControllerName}>
              <SelectTrigger className="h-12 rounded-2xl border-[#dfe1ec] text-[16px]"><SelectValue placeholder="Выберите..." /></SelectTrigger>
              <SelectContent>{props.users.map((u) => <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" className="h-12 rounded-xl bg-[#5863f8] px-7 text-[16px] font-medium text-white hover:bg-[#4b57f3]">
              Добавить
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export function FryerOilDocumentClient(props: Props) {
  const router = useRouter();
  const [entries, setEntries] = useState<EntryItem[]>(props.initialEntries);
  const [config, setConfig] = useState<FryerOilDocumentConfig>(props.config);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showListsDialog, setShowListsDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sentinelEmployeeId = props.users[0]?.id || "system";

  const addEntry = useCallback(async (data: FryerOilEntryData) => {
    const entryDate = data.startDate || new Date().toISOString().slice(0, 10);
    const response = await fetch(`/api/journal-documents/${props.documentId}/entries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: sentinelEmployeeId,
        date: entryDate,
        data,
      }),
    });
    if (!response.ok) {
      window.alert("Не удалось добавить запись");
      return;
    }
    router.refresh();
    // Optimistically add to local state
    const result = await response.json();
    setEntries((prev) => [...prev, { id: result.entry?.id || crypto.randomUUID(), date: entryDate, data }]);
  }, [props.documentId, sentinelEmployeeId, router]);

  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Удалить ${selectedIds.size} записей?`)) return;
    const response = await fetch(`/api/journal-documents/${props.documentId}/entries`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    if (!response.ok) {
      window.alert("Не удалось удалить записи");
      return;
    }
    setEntries((prev) => prev.filter((e) => !selectedIds.has(e.id)));
    setSelectedIds(new Set());
  }, [selectedIds, props.documentId]);

  const saveLists = useCallback(async (lists: FryerOilSelectLists) => {
    const newConfig = { ...config, lists };
    const response = await fetch(`/api/journal-documents/${props.documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: newConfig }),
    });
    if (!response.ok) {
      window.alert("Не удалось сохранить списки");
      return;
    }
    setConfig(newConfig);
  }, [config, props.documentId]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = props.status === "active";

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-[#7c7c93]">
        <Link href="/" className="hover:text-black">{props.organizationName}</Link>
        <span>&gt;</span>
        <Link href={`/journals/${props.routeCode}`} className="hover:text-black">{FRYER_OIL_PAGE_TITLE}</Link>
        <span>&gt;</span>
        <span className="text-black">{props.title}</span>
      </div>

      {/* Title row */}
      <div className="flex items-start justify-between">
        <h1 className="text-[36px] font-bold tracking-[-0.03em] text-black">{props.title}</h1>
        <Link
          href={`/journals/${props.routeCode}/documents/${props.documentId}`}
          className="text-[14px] text-[#5b66ff] hover:underline"
          onClick={(e) => { e.preventDefault(); window.open(`/api/journal-documents/${props.documentId}/pdf`, "_blank"); }}
        >
          Настройки журнала
        </Link>
      </div>

      {/* Action buttons */}
      {isActive && (
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="h-11 rounded-xl bg-[#5b66ff] px-5 text-[14px] font-medium text-white hover:bg-[#4c58ff]"
          >
            <Plus className="mr-1 size-4" />
            Добавить
          </Button>
          <button
            type="button"
            onClick={() => setShowListsDialog(true)}
            className="text-[14px] text-[#5b66ff] hover:underline"
          >
            Редактировать списки
          </button>
          {selectedIds.size > 0 && (
            <Button
              variant="outline"
              onClick={deleteSelected}
              className="h-11 rounded-xl border-[#ff3b30] px-5 text-[14px] text-[#ff3b30] hover:bg-red-50"
            >
              <Trash2 className="mr-1 size-4" />
              Удалить ({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#e4e6ef] bg-white">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[#e4e6ef] bg-[#f8f9fc]">
              {isActive && <th className="w-10 px-3 py-3" />}
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Дата, время начала использования фритюрного жира</th>
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Вид фритюрного жира</th>
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Органолептическая оценка качества жира на начало жарки</th>
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Тип жарочного оборудования</th>
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Вид продукции</th>
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Время окончания фритюрной жарки</th>
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Органолептическая оценка качества жира по окончании жарки</th>
              <th className="px-3 py-3 text-center font-medium text-[#6f7282]" colSpan={2}>Использование оставшегося жира</th>
              <th className="px-3 py-3 text-left font-medium text-[#6f7282]">Должность, ФИО контролера</th>
            </tr>
            <tr className="border-b border-[#e4e6ef] bg-[#f8f9fc]">
              {isActive && <th />}
              <th /><th /><th /><th /><th /><th /><th />
              <th className="px-3 py-2 text-center text-[11px] font-medium text-[#6f7282]">Переходящий остаток, кг</th>
              <th className="px-3 py-2 text-center text-[11px] font-medium text-[#6f7282]">Утилизированный, кг</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={isActive ? 12 : 11} className="px-6 py-8 text-center text-[#7d8196]">
                  Записей пока нет
                </td>
              </tr>
            )}
            {entries.map((entry) => {
              const d = entry.data;
              return (
                <tr key={entry.id} className="border-b border-[#eceef5] hover:bg-[#f9f9fc]">
                  {isActive && (
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                        className="size-4 rounded border-[#d0d2db]"
                      />
                    </td>
                  )}
                  <td className="px-3 py-3 whitespace-nowrap">{formatDateRu(d.startDate)} {formatTime(d.startHour, d.startMinute)}</td>
                  <td className="px-3 py-3">{d.fatType || "—"}</td>
                  <td className="px-3 py-3 text-center">{d.qualityStart}</td>
                  <td className="px-3 py-3">{d.equipmentType || "—"}</td>
                  <td className="px-3 py-3">{d.productType || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{formatTime(d.endHour, d.endMinute)}</td>
                  <td className="px-3 py-3 text-center">{d.qualityEnd}</td>
                  <td className="px-3 py-3 text-center">{d.carryoverKg || "—"}</td>
                  <td className="px-3 py-3 text-center">{d.disposedKg || "—"}</td>
                  <td className="px-3 py-3">{d.controllerName || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quality assessment appendix */}
      <div className="space-y-4">
        <h2 className="text-[18px] font-semibold text-black">
          Приложение. Методика определения качества фритюрного жира.
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[#e4e6ef] bg-white">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b bg-[#f8f9fc]">
                <th className="px-3 py-2 text-left font-medium" rowSpan={2}>Показатели качества</th>
                <th className="px-3 py-2 text-center font-medium" colSpan={4}>Оценка</th>
              </tr>
              <tr className="border-b bg-[#f8f9fc]">
                {QUALITY_ASSESSMENT_TABLE.headers.slice(1).map((h) => (
                  <th key={h} className="px-3 py-2 text-center font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {QUALITY_ASSESSMENT_TABLE.rows.map((row) => (
                <tr key={row.indicator} className="border-b">
                  <td className="px-3 py-2 font-medium">{row.indicator}</td>
                  {row.ratings.map((r, i) => (
                    <td key={i} className="px-3 py-2 text-center">{r}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#e4e6ef] bg-white">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b bg-[#f8f9fc]">
                <th className="px-3 py-2 text-center font-medium">Качество фритюра</th>
                <th className="px-3 py-2 text-center font-medium">Бальная оценка</th>
              </tr>
            </thead>
            <tbody>
              {QUALITY_ASSESSMENT_TABLE.scoringTable.map((row) => (
                <tr key={row.quality} className="border-b">
                  <td className="px-3 py-2 text-center">{row.quality}</td>
                  <td className="px-3 py-2 text-center">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[13px] leading-6 text-[#333]">
          <p className="font-medium">Пример расчета среднего балла:</p>
          <p>{QUALITY_ASSESSMENT_TABLE.formula}</p>
          {QUALITY_ASSESSMENT_TABLE.formulaExplanation.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </div>

      {/* Dialogs */}
      <AddEntryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        lists={config.lists}
        users={props.users}
        onAdd={addEntry}
      />
      <EditListsDialog
        open={showListsDialog}
        onOpenChange={setShowListsDialog}
        lists={config.lists}
        onSave={saveLists}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journals/fryer-oil-document-client.tsx
git commit -m "feat: add fryer oil document client with add-row and edit-lists dialogs"
```

---

### Task 5: Wire up the list page routing

**Files:**
- Modify: `src/app/(dashboard)/journals/[code]/page.tsx`

- [ ] **Step 1: Add import for FryerOilDocumentsClient**

Add at the top of the file after the existing UV lamp import:
```typescript
import { FryerOilDocumentsClient } from "@/components/journals/fryer-oil-documents-client";
import { FRYER_OIL_TEMPLATE_CODE } from "@/lib/fryer-oil-document";
```

- [ ] **Step 2: Add fryer_oil routing**

Inside the `if (resolvedCode === UV_LAMP_RUNTIME_TEMPLATE_CODE) { ... }` block (around line 610), add BEFORE it (so it's checked first within the tracked-document branch):
```typescript
      if (resolvedCode === FRYER_OIL_TEMPLATE_CODE) {
        return (
          <FryerOilDocumentsClient
            activeTab={activeTab}
            routeCode={code}
            templateCode={resolvedCode}
            templateName={template.name}
            users={orgUsers}
            documents={documents.map((document) => ({
              id: document.id,
              title: document.title || "Журнал учета использования фритюрных жиров",
              status: document.status as "active" | "closed",
              responsibleTitle: document.responsibleTitle,
              dateFrom: document.dateFrom.toISOString().slice(0, 10),
            }))}
          />
        );
      }
```

- [ ] **Step 3: Add fryer_oil to SOURCE_STYLE_TRACKED_DEMO_CODES**

In the `SOURCE_STYLE_TRACKED_DEMO_CODES` set (around line 53), add `"fryer_oil"`:
```typescript
const SOURCE_STYLE_TRACKED_DEMO_CODES = new Set([
  "daily_rejection",
  "raw_storage_control",
  "defrosting_control",
  "uv_lamp_runtime",
  "fryer_oil",
]);
```

- [ ] **Step 4: Add fryer_oil sample document seeding**

In the `ensureSourceStyleTrackedSampleDocuments` function, add fryer_oil-specific demo entry creation. After the UV lamp section (around line 360), add:

```typescript
    const isFryerOil = templateCode === FRYER_OIL_TEMPLATE_CODE;

    // ... in the for loop, after UV section, add:
    if (isFryerOil) {
      const sampleEntries = [
        {
          documentId: created.id,
          employeeId: activeUser.id,
          date: config.dateFrom,
          data: {
            startDate: config.dateFrom.toISOString().slice(0, 10),
            startHour: 9, startMinute: 0,
            fatType: "Подсолнечное масло",
            qualityStart: 5,
            equipmentType: "Фритюрница настольная",
            productType: "Картофель фри",
            endHour: 11, endMinute: 30,
            qualityEnd: 4,
            carryoverKg: 2.5,
            disposedKg: 0,
            controllerName: activeUser.name,
          },
        },
      ];
      await db.journalDocumentEntry.createMany({ data: sampleEntries, skipDuplicates: true });
    }
```

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/journals/[code]/page.tsx
git commit -m "feat: wire fryer oil documents list into journal page routing"
```

---

### Task 6: Wire up the document editor page routing

**Files:**
- Modify: `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx`

- [ ] **Step 1: Add imports**

Add after the UV lamp import:
```typescript
import { FryerOilDocumentClient } from "@/components/journals/fryer-oil-document-client";
import {
  FRYER_OIL_TEMPLATE_CODE,
  normalizeFryerOilDocumentConfig,
  normalizeFryerOilEntryData,
} from "@/lib/fryer-oil-document";
```

- [ ] **Step 2: Add routing for fryer_oil**

Inside the `isTrackedDocumentTemplate()` branch (around line 243-268), add BEFORE the UV lamp check:

```typescript
    if (document.template.code === FRYER_OIL_TEMPLATE_CODE) {
      const fryerConfig = normalizeFryerOilDocumentConfig(document.config);
      return (
        <FryerOilDocumentClient
          documentId={document.id}
          title={document.title || "Журнал учета использования фритюрных жиров"}
          organizationName={organization?.name || 'ООО "Тест"'}
          status={document.status}
          dateFrom={toIsoDate(document.dateFrom)}
          config={fryerConfig}
          users={enrichedEmployees}
          initialEntries={document.entries.map((entry) => ({
            id: entry.id,
            date: toIsoDate(entry.date),
            data: normalizeFryerOilEntryData(entry.data),
          }))}
          routeCode={code}
        />
      );
    }
```

Note: `toIsoDate` is imported from uv-lamp-runtime-document already in the file.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx
git commit -m "feat: wire fryer oil document editor into page routing"
```

---

### Task 7: Update create document dialog

**Files:**
- Modify: `src/components/journals/create-document-dialog.tsx`

- [ ] **Step 1: Add imports**

Add after existing fryer-oil related imports:
```typescript
import {
  FRYER_OIL_TEMPLATE_CODE,
  getFryerOilDocumentTitle,
  defaultFryerOilDocumentConfig,
} from "@/lib/fryer-oil-document";
```

- [ ] **Step 2: Add fryer_oil handling in create mode**

The fryer_oil journal uses the `isSourceStyleTrackedJournal` flow with `trackedCreateMode === "fryer_oil"`. In the create dialog, the `"fryer_oil"` mode should show a simple title + date form (similar to `"dated"` mode).

In the `handleSubmit` function, add fryer_oil config in the config resolution:
```typescript
// In the config ternary chain, add before the generic tracked fallback:
: templateCode === FRYER_OIL_TEMPLATE_CODE
  ? defaultFryerOilDocumentConfig()
```

- [ ] **Step 3: Commit**

```bash
git add src/components/journals/create-document-dialog.tsx
git commit -m "feat: add fryer oil support to create document dialog"
```

---

### Task 8: Add PDF generation

**Files:**
- Modify: `src/lib/document-pdf.ts`

- [ ] **Step 1: Add imports**

Add to the imports section:
```typescript
import {
  FRYER_OIL_TEMPLATE_CODE,
  normalizeFryerOilDocumentConfig,
  normalizeFryerOilEntryData,
  getFryerOilDocumentTitle,
  getFryerOilFilePrefix,
  formatTime,
  QUALITY_LABELS,
  QUALITY_ASSESSMENT_TABLE,
  type FryerOilEntryData,
} from "@/lib/fryer-oil-document";
```

- [ ] **Step 2: Add drawFryerOilPdf function**

Add before the `generateJournalDocumentPdf` function:

```typescript
function drawFryerOilPdf(
  doc: jsPDF,
  params: {
    organizationName: string;
    title: string;
    dateFrom: Date;
    dateTo: Date;
    config: ReturnType<typeof normalizeFryerOilDocumentConfig>;
    entries: { employeeId: string; date: Date; data: Record<string, unknown> }[];
  }
) {
  const { organizationName, title, dateFrom, config, entries } = params;
  const startDateLabel = dateFrom.toLocaleDateString("ru-RU").replaceAll(".", "-");

  // Header
  const pageWidth = doc.internal.pageSize.getWidth();

  // Organization header table
  autoTable(doc, {
    startY: 15,
    theme: "grid",
    styles: { font: doc.getFont().fontName, fontSize: 9, cellPadding: 2, halign: "center", valign: "middle" },
    body: [
      [
        { content: organizationName, rowSpan: 2, styles: { halign: "left", cellPadding: 4 } },
        { content: "СИСТЕМА ХАССП", styles: { fontStyle: "bold" } },
        { content: `Начат  ${startDateLabel}\nОкончен _________`, styles: { halign: "left", fontSize: 8 } },
      ],
      [
        { content: title.toUpperCase(), styles: { fontStyle: "bold" } },
        { content: `СТР. 1 ИЗ 1`, styles: { fontSize: 8 } },
      ],
    ],
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 140 }, 2: { cellWidth: 60 } },
  });

  // Title
  const afterHeader = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(12);
  doc.text(title.toUpperCase(), pageWidth / 2, afterHeader, { align: "center" });

  // Data table
  const tableHead: RowInput[] = [
    [
      { content: "Дата, время начала использования фритюрного жира", rowSpan: 2, styles: { valign: "middle" } },
      { content: "Вид фритюрного жира", rowSpan: 2, styles: { valign: "middle" } },
      { content: "Органолептическая оценка качества жира на начало жарки", rowSpan: 2, styles: { valign: "middle" } },
      { content: "Тип жарочного оборудования", rowSpan: 2, styles: { valign: "middle" } },
      { content: "Вид продукции", rowSpan: 2, styles: { valign: "middle" } },
      { content: "Время окончания фритюрной жарки", rowSpan: 2, styles: { valign: "middle" } },
      { content: "Органолептическая оценка качества жира по окончании жарки", rowSpan: 2, styles: { valign: "middle" } },
      { content: "Использование оставшегося жира", colSpan: 2, styles: { halign: "center" } },
      { content: "Должность, ФИО контролера", rowSpan: 2, styles: { valign: "middle" } },
    ],
    [
      { content: "Переходящий остаток, кг" },
      { content: "Утилизированный, кг" },
    ],
  ];

  const tableBody: RowInput[] = entries.length > 0
    ? entries.map((entry) => {
        const d = normalizeFryerOilEntryData(entry.data);
        const dateLabel = d.startDate
          ? new Date(`${d.startDate}T00:00:00.000Z`).toLocaleDateString("ru-RU")
          : "—";
        return [
          `${dateLabel}\n${formatTime(d.startHour, d.startMinute)}`,
          d.fatType || "—",
          String(d.qualityStart),
          d.equipmentType || "—",
          d.productType || "—",
          formatTime(d.endHour, d.endMinute),
          String(d.qualityEnd),
          d.carryoverKg ? String(d.carryoverKg) : "—",
          d.disposedKg ? String(d.disposedKg) : "—",
          d.controllerName || "—",
        ];
      })
    : [[{ content: "", colSpan: 10, styles: { minCellHeight: 20 } }]];

  autoTable(doc, {
    startY: afterHeader + 5,
    theme: "grid",
    styles: { font: doc.getFont().fontName, fontSize: 7, cellPadding: 2, halign: "center", valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 7 },
    head: tableHead,
    body: tableBody,
  });

  // Appendix - quality assessment methodology
  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  const pageHeight = doc.internal.pageSize.getHeight();

  if (afterTable + 80 > pageHeight) {
    doc.addPage();
  }

  const appendixY = afterTable + 80 > pageHeight ? 15 : afterTable;

  doc.setFontSize(10);
  doc.text("Приложение. Методика определения качества фритюрного жира.", 14, appendixY);

  // Quality indicators table
  autoTable(doc, {
    startY: appendixY + 5,
    theme: "grid",
    styles: { font: doc.getFont().fontName, fontSize: 7, cellPadding: 2, valign: "middle" },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
    head: [
      [
        { content: "Показатели качества", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Оценка", colSpan: 4, styles: { halign: "center" } },
      ],
      ["отлично", "хорошо", "удовлетворительно", "неудовлетворительно"],
    ],
    body: QUALITY_ASSESSMENT_TABLE.rows.map((row) => [
      row.indicator,
      ...row.ratings,
    ]),
  });

  // Scoring table
  const afterQuality = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  autoTable(doc, {
    startY: afterQuality,
    theme: "grid",
    styles: { font: doc.getFont().fontName, fontSize: 8, cellPadding: 2, halign: "center" },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
    head: [["Качество фритюра", "Бальная оценка"]],
    body: QUALITY_ASSESSMENT_TABLE.scoringTable.map((row) => [row.quality, row.score]),
    tableWidth: 120,
    margin: { left: 14 },
  });

  // Formula
  const afterScoring = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  doc.setFontSize(8);
  doc.text("Пример расчета среднего балла:", 14, afterScoring);
  doc.text(QUALITY_ASSESSMENT_TABLE.formula, 14, afterScoring + 4);
  let yPos = afterScoring + 8;
  for (const line of QUALITY_ASSESSMENT_TABLE.formulaExplanation) {
    doc.text(line, 14, yPos);
    yPos += 4;
  }
}
```

- [ ] **Step 3: Add dispatch in generateJournalDocumentPdf**

In the `generateJournalDocumentPdf` function, add BEFORE the `UV_LAMP_RUNTIME_TEMPLATE_CODE` check:

```typescript
  } else if (templateCode === FRYER_OIL_TEMPLATE_CODE) {
    drawFryerOilPdf(doc, {
      organizationName,
      title: document.title || getFryerOilDocumentTitle(),
      dateFrom: document.dateFrom,
      dateTo: document.dateTo,
      config: normalizeFryerOilDocumentConfig(document.config),
      entries: document.entries.map((entry) => ({
        employeeId: entry.employeeId,
        date: entry.date,
        data: (entry.data as Record<string, unknown>) || {},
      })),
    });
```

- [ ] **Step 4: Add file prefix for fryer_oil**

In the filename prefix resolution chain (around line 1666-1683), add before the tracked template fallback:

```typescript
            : templateCode === FRYER_OIL_TEMPLATE_CODE
              ? getFryerOilFilePrefix()
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/document-pdf.ts
git commit -m "feat: add fryer oil PDF generation with quality assessment appendix"
```

---

### Task 9: Build, test, and fix

- [ ] **Step 1: Run build**

```bash
npm run build
```

Fix any TypeScript errors that arise.

- [ ] **Step 2: Manual verification**

Navigate to `/journals/fryer_oil` (or `/journals/deepfatjournal` via alias) and verify:
- Document list shows with Active/Closed tabs
- Create document dialog works
- Document editor shows the table and appendix
- Add row dialog works with all fields
- Edit lists dialog works
- PDF generation works

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve build issues for fryer oil journal"
```

---

### Task 10: Add source style demo documents and final polish

- [ ] **Step 1: Add fryer_oil to SOURCE_STYLE_TRACKED_TEMPLATE_CODES**

In `src/lib/tracked-document.ts`, add `"fryer_oil"` to the `SOURCE_STYLE_TRACKED_TEMPLATE_CODES` array:
```typescript
export const SOURCE_STYLE_TRACKED_TEMPLATE_CODES = [
  "incoming_control",
  "hand_hygiene_control",
  "waste_disposal_control",
  "uv_lamp_runtime",
  "daily_rejection",
  "raw_storage_control",
  "defrosting_control",
  "fryer_oil",
] as const;
```

- [ ] **Step 2: Update SourceStyleTrackedTemplateCode type**

The type will automatically include "fryer_oil" since it derives from the const array.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tracked-document.ts
git commit -m "feat: add fryer_oil to source-style tracked templates for demo seeding"
```
