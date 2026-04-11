# Medical Books Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Медицинские книжки" (Medical Books) journal type that tracks employee health examinations and vaccinations in a grid format (employees x specialists/vaccinations).

**Architecture:** Uses the existing JournalDocument/JournalDocumentEntry system. Config stores customizable column lists (examinations, vaccinations). Each entry stores one employee's full data (exams, vaccinations, metadata) in JSON. This is NOT a date-based grid - it's employee x specialist/vaccination.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, shadcn/ui, Tailwind CSS

---

### Task 1: Library - Types, Constants, and Normalization

**Files:**
- Create: `src/lib/med-book-document.ts`

- [ ] **Step 1: Create the med-book-document.ts file with all types and constants**

```typescript
// src/lib/med-book-document.ts

export const MED_BOOK_TEMPLATE_CODE = "med_books";
export const MED_BOOK_DOCUMENT_TITLE = "Мед. книжки";

export const DEFAULT_EXAMINATIONS = [
  "Гинеколог",
  "Стоматолог",
  "Психиатр",
  "Оториноларинголог",
  "Терапевт",
  "Невролог",
  "Нарколог",
  "Дерматовенеролог",
  "Флюорография",
  "Маммография",
];

export const DEFAULT_VACCINATIONS = [
  "Дифтерия",
  "Корь",
  "Дизентерия Зонне",
  "Краснуха",
  "Гепатит B",
  "Гепатит A",
  "Грипп",
  "Коронавирус",
];

export type MedBookExamination = {
  date: string | null;
  expiryDate: string | null;
};

export type MedBookVaccinationType = "done" | "refusal" | "exemption";

export type MedBookVaccination = {
  type: MedBookVaccinationType;
  dose?: string | null;
  date?: string | null;
  expiryDate?: string | null;
};

export type MedBookEntryData = {
  positionTitle: string;
  birthDate: string | null;
  gender: "male" | "female" | null;
  hireDate: string | null;
  medBookNumber: string | null;
  photoUrl: string | null;
  examinations: Record<string, MedBookExamination>;
  vaccinations: Record<string, MedBookVaccination>;
  note: string | null;
};

export type MedBookDocumentConfig = {
  examinations: string[];
  vaccinations: string[];
  includeVaccinations: boolean;
};

export function getDefaultMedBookConfig(): MedBookDocumentConfig {
  return {
    examinations: [...DEFAULT_EXAMINATIONS],
    vaccinations: [...DEFAULT_VACCINATIONS],
    includeVaccinations: true,
  };
}

export function normalizeMedBookConfig(raw: unknown): MedBookDocumentConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return getDefaultMedBookConfig();
  }
  const obj = raw as Record<string, unknown>;
  return {
    examinations: Array.isArray(obj.examinations)
      ? (obj.examinations as string[]).filter((v) => typeof v === "string")
      : [...DEFAULT_EXAMINATIONS],
    vaccinations: Array.isArray(obj.vaccinations)
      ? (obj.vaccinations as string[]).filter((v) => typeof v === "string")
      : [...DEFAULT_VACCINATIONS],
    includeVaccinations:
      typeof obj.includeVaccinations === "boolean"
        ? obj.includeVaccinations
        : true,
  };
}

export function normalizeMedBookEntryData(raw: unknown): MedBookEntryData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyMedBookEntry("");
  }
  const obj = raw as Record<string, unknown>;
  return {
    positionTitle: typeof obj.positionTitle === "string" ? obj.positionTitle : "",
    birthDate: typeof obj.birthDate === "string" ? obj.birthDate : null,
    gender:
      obj.gender === "male" || obj.gender === "female" ? obj.gender : null,
    hireDate: typeof obj.hireDate === "string" ? obj.hireDate : null,
    medBookNumber:
      typeof obj.medBookNumber === "string" ? obj.medBookNumber : null,
    photoUrl: typeof obj.photoUrl === "string" ? obj.photoUrl : null,
    examinations: normalizeExaminationsMap(obj.examinations),
    vaccinations: normalizeVaccinationsMap(obj.vaccinations),
    note: typeof obj.note === "string" ? obj.note : null,
  };
}

function normalizeExaminationsMap(
  raw: unknown
): Record<string, MedBookExamination> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, MedBookExamination> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const v = val as Record<string, unknown>;
    result[key] = {
      date: typeof v.date === "string" ? v.date : null,
      expiryDate: typeof v.expiryDate === "string" ? v.expiryDate : null,
    };
  }
  return result;
}

function normalizeVaccinationsMap(
  raw: unknown
): Record<string, MedBookVaccination> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, MedBookVaccination> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const v = val as Record<string, unknown>;
    const type = v.type;
    if (type !== "done" && type !== "refusal" && type !== "exemption") continue;
    result[key] = {
      type,
      dose: typeof v.dose === "string" ? v.dose : null,
      date: typeof v.date === "string" ? v.date : null,
      expiryDate: typeof v.expiryDate === "string" ? v.expiryDate : null,
    };
  }
  return result;
}

export function emptyMedBookEntry(positionTitle: string): MedBookEntryData {
  return {
    positionTitle,
    birthDate: null,
    gender: null,
    hireDate: null,
    medBookNumber: null,
    photoUrl: null,
    examinations: {},
    vaccinations: {},
    note: null,
  };
}

export function isExaminationExpired(exam: MedBookExamination): boolean {
  if (!exam.expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return exam.expiryDate < today;
}

export function isExaminationExpiringSoon(
  exam: MedBookExamination,
  daysThreshold = 30
): boolean {
  if (!exam.expiryDate) return false;
  const today = new Date();
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + daysThreshold);
  const thresholdStr = threshold.toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);
  return exam.expiryDate >= todayStr && exam.expiryDate <= thresholdStr;
}

export function formatMedBookDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}-${month}-${year}`;
}

export const VACCINATION_TYPE_LABELS: Record<MedBookVaccinationType, string> = {
  done: "Вакцинация",
  refusal: "Отказ сотрудника",
  exemption: "Мед. отвод",
};

// Reference data for the static info sections
export const EXAMINATION_REFERENCE_DATA = [
  { name: "Гинеколог", periodicity: "осмотр 1 раз в год", note: "только женщины" },
  { name: "Стоматолог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Психиатр", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Оториноларинголог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Терапевт", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Невролог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Нарколог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Дерматовенеролог", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Исследования на гельминто-возы", periodicity: "при поступлении на работу, затем 1 раз в год", note: "" },
  { name: "Профпатолог", periodicity: "осмотр 1 раз в год", note: "заключение о прохождении медицинской комиссии" },
  { name: "Флюорография", periodicity: "осмотр 1 раз в год", note: "" },
  { name: "Исследования на стафилококк", periodicity: "при поступлении на работу", note: "в дальнейшем по медицинским и эпид. показаниям" },
  { name: "Бактериологическое исследование на диз.группу", periodicity: "при поступлении на работу", note: "в дальнейшем по эпид. показаниям" },
  { name: "Брюшной тиф", periodicity: "при поступлении на работу", note: "в дальнейшем по эпид. показаниям" },
  {
    name: "Гигиеническая подготовка (сан.минимум)",
    periodicity: "осмотр 1 раз / 1 раз в 2 года",
    note: "для работников деятельность, которых связана с производством, хранением, транспортировкой и реализацией мясо - молочной и кремово - кондитерской продукции, детского питания, питания дошкольников - 1 раз в год; для остальных категорий работников - 1 раз в 2 года",
  },
];

export const VACCINATION_REFERENCE_DATA = [
  {
    name: "ДИФТЕРИЯ (АДСМ анатоксин: дифтерийно-столбнячная малотоксичная)",
    periodicity: "Привитым лицам ревакцинация проводится без ограничения возраста каждые 10 лет от момента последней ревакцинации. Лицам не привитым и без сведений о прививках проводится курс из 3 прививок: 2 прививки в цикле вакцинации, проведённые с интервалом в 1,5 месяца и последующая ревакцинация через 6-9 месяцев после законченной вакцинации.",
  },
  {
    name: "КОРЬ (ЖКВ-живая коревая вакцина)",
    periodicity: "Необходимо 2 прививки. Интервал между первой прививкой (вакцинацией) и второй прививкой (ревакцинацией) составляет не менее 3 месяцев. В ВОЗРАСТЕ ДО 55 ЛЕТ.",
  },
  { name: "Дизентерия Зонне", periodicity: "Ежегодно" },
  {
    name: "КРАСНУХА",
    periodicity: "Необходимо 2 прививки женщинам до 25 лет. Интервал между первой прививкой (вакцинацией) и второй прививкой (ревакцинацией) составляет не менее 3 месяцев.",
  },
  {
    name: "ГЕПАТИТ В",
    periodicity: "Лицам до 55 лет необходимо 3 прививки по схеме 0-1 месяц - 6 месяцев (V1-V2-V3)",
  },
  {
    name: "ГЕПАТИТ А",
    periodicity: "Необходимо 2 прививки с интервалом между прививками 6-12 месяцев (V1-V2)",
  },
  {
    name: "Вакцинация от гриппа",
    periodicity: "Взрослые ежегодно, осенне-зимний период",
  },
  {
    name: "Вакцинация от коронавируса",
    periodicity: "Взрослые от 18 лет и старше, с совокупно не менее 80% от общей численности работников.",
  },
];

export const MED_BOOK_VACCINATION_RULES = [
  "В ОДИН ДЕНЬ МОЖНО ДЕЛАТЬ НЕ БОЛЕЕ 4 ПРИВИВОК ПРОТИВ РАЗНЫХ ИНФЕКЦИЙ: 2 ПОД ЛОПАТКУ (ПРАВУЮ И ЛЕВУЮ) И 2 В ПЛЕЧО (ПРАВОЕ И ЛЕВОЕ)",
  "ИНТЕРВАЛ МЕЖДУ ПРИВИВКАМИ РАЗНЫХ ИНФЕКЦИЙ СОСТАВЛЯЕТ НЕ МЕНЕЕ 1 МЕСЯЦА",
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/med-book-document.ts
git commit -m "feat: add med-book-document library with types, constants, and normalization"
```

---

### Task 2: Register Template in Seed and Helpers

**Files:**
- Modify: `prisma/seed.ts` (add template to `additionalJournalTemplates`)
- Modify: `src/lib/journal-document-helpers.ts` (register in `isDocumentTemplate`, add title/period)
- Modify: `src/lib/source-journal-map.ts` (update medbook mapping)

- [ ] **Step 1: Add med_books template to seed.ts**

In `prisma/seed.ts`, add to the `additionalJournalTemplates` array (before the closing `];` on line 552):

```typescript
  { code: "med_books", name: "Медицинские книжки", description: "Журнал учёта медицинских книжек, осмотров и прививок сотрудников", sortOrder: 36, isMandatorySanpin: true, isMandatoryHaccp: false, fields: [] },
```

- [ ] **Step 2: Register med_books in journal-document-helpers.ts**

In `src/lib/journal-document-helpers.ts`, add the import and update functions:

Add import at top:
```typescript
import {
  MED_BOOK_TEMPLATE_CODE,
  MED_BOOK_DOCUMENT_TITLE,
} from "@/lib/med-book-document";
```

Update `isDocumentTemplate` to include `med_books`:
```typescript
export function isDocumentTemplate(templateCode: string) {
  return (
    templateCode === "hygiene" ||
    templateCode === "health_check" ||
    templateCode === FINISHED_PRODUCT_DOCUMENT_TEMPLATE_CODE ||
    templateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE ||
    templateCode === CLIMATE_DOCUMENT_TEMPLATE_CODE ||
    templateCode === CLEANING_DOCUMENT_TEMPLATE_CODE ||
    templateCode === MED_BOOK_TEMPLATE_CODE ||
    isTrackedDocumentTemplate(templateCode)
  );
}
```

Update `getJournalDocumentDefaultTitle`:
```typescript
  if (templateCode === MED_BOOK_TEMPLATE_CODE) {
    return MED_BOOK_DOCUMENT_TITLE;
  }
```
(Add before the `if (isTrackedDocumentTemplate)` check)

- [ ] **Step 3: Update source-journal-map.ts**

In `src/lib/source-journal-map.ts`, change the medbook entry from `localCode: null` to:
```typescript
  { sourceSlug: "medbook", localCode: "med_books", status: "mapped" },
```

- [ ] **Step 4: Commit**

```bash
git add prisma/seed.ts src/lib/journal-document-helpers.ts src/lib/source-journal-map.ts
git commit -m "feat: register med_books template in seed, helpers, and source map"
```

---

### Task 3: Create Document Dialog - Med Books Mode

**Files:**
- Modify: `src/components/journals/create-document-dialog.tsx`

- [ ] **Step 1: Add med_books imports and state**

At the top of `create-document-dialog.tsx`, add import:
```typescript
import {
  MED_BOOK_TEMPLATE_CODE,
  MED_BOOK_DOCUMENT_TITLE,
} from "@/lib/med-book-document";
```

After line 124 (`const isUvRuntimeJournal = ...`), add:
```typescript
  const isMedBookJournal = templateCode === MED_BOOK_TEMPLATE_CODE;
```

After line 172 (`const [fpFooterNote, setFpFooterNote] = ...`), add:
```typescript
  const [medBookIncludeVaccinations, setMedBookIncludeVaccinations] = useState(true);
```

- [ ] **Step 2: Add med_books to title default**

In the `title` useState initializer (around line 137), add a case for med_books. Before the `isSourceStyleTrackedJournal` ternary branch:
```typescript
                : templateCode === MED_BOOK_TEMPLATE_CODE
                  ? MED_BOOK_DOCUMENT_TITLE
```

- [ ] **Step 3: Add med_books to the compact modal path**

The med_books creation dialog should use the compact (source-style) modal path. Update `isCompactSourceModal`:
```typescript
  const isCompactSourceModal = isStaffJournal || isSourceStyleTrackedJournal || isMedBookJournal;
```

- [ ] **Step 4: Add med_books config to handleSubmit**

In the `handleSubmit` function, in the config building section, add a case for med_books. Before the `isAcceptanceJournal` ternary branch in the JSON body:
```typescript
          config: isMedBookJournal
            ? {
                examinations: undefined, // will use defaults
                vaccinations: undefined,
                includeVaccinations: medBookIncludeVaccinations,
              }
            : isAcceptanceJournal
```

- [ ] **Step 5: Add med_books UI fields in the compact modal section**

Inside the compact modal `<>` block, add a condition for med_books. After the doc-title input block (around line 326), add the vaccinations toggle. The simplest approach: add a med_books-specific block after the title input when `isMedBookJournal` is true:

```tsx
              {isMedBookJournal && (
                <label className="flex items-center gap-3 text-[16px]">
                  <input
                    type="checkbox"
                    checked={medBookIncludeVaccinations}
                    onChange={(e) => setMedBookIncludeVaccinations(e.target.checked)}
                    className="size-5 rounded accent-[#5b66ff]"
                  />
                  включить &quot;Прививки&quot;
                </label>
              )}
```

- [ ] **Step 6: Hide date/responsible fields for med_books**

Med books don't need date range or responsible title selection. Wrap the date and responsible sections to skip when `isMedBookJournal`:

The responsible title `<Select>` section and date section should be hidden for med books. Add `!isMedBookJournal &&` before rendering those sections in the compact modal path.

- [ ] **Step 7: Commit**

```bash
git add src/components/journals/create-document-dialog.tsx
git commit -m "feat: add med_books creation mode to create-document-dialog"
```

---

### Task 4: Document List Page - Med Books Client

**Files:**
- Create: `src/components/journals/med-book-documents-client.tsx`

- [ ] **Step 1: Create med-book-documents-client.tsx**

This follows the same pattern as `hygiene-documents-client.tsx` but simplified - no period labels, just title and three-dot menu.

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpenText, Ellipsis, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDocumentDialog } from "@/components/journals/create-document-dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MED_BOOK_TEMPLATE_CODE } from "@/lib/med-book-document";

type MedBookListDocument = {
  id: string;
  title: string;
  status: "active" | "closed";
};

type Props = {
  activeTab: "active" | "closed";
  templateCode: string;
  templateName: string;
  users: { id: string; name: string; role: string }[];
  documents: MedBookListDocument[];
};

function SettingsDialog({
  open,
  onOpenChange,
  document,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  document: MedBookListDocument | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  function handleOpen(isOpen: boolean) {
    if (isOpen && document) setTitle(document.title);
    onOpenChange(isOpen);
  }

  async function handleSave() {
    if (!document) return;
    setSaving(true);
    try {
      await fetch(`/api/journal-documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      onOpenChange(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] rounded-[24px] border-0 p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[20px] font-medium text-black">
            Настройки документа
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label htmlFor="settings-title">Название документа</Label>
            <Input
              id="settings-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-12 rounded-xl border-[#dfe1ec] px-4"
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="h-10 rounded-xl bg-[#5b66ff] px-5 text-white hover:bg-[#4b57ff]"
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MedBookDocumentsClient({
  activeTab,
  templateCode,
  templateName,
  users,
  documents,
}: Props) {
  const router = useRouter();
  const [settingsDoc, setSettingsDoc] = useState<MedBookListDocument | null>(null);
  const heading = "Медицинские книжки";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{heading}</h1>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            className="gap-2 text-[#5b66ff]"
            onClick={() => {
              const el = document.getElementById("med-book-reference");
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <BookOpenText className="size-4" />
            Инструкция
          </Button>
          <CreateDocumentDialog
            templateCode={templateCode}
            templateName={templateName}
            users={users}
            triggerLabel="Создать документ"
            triggerIcon={<Plus className="size-4" />}
            triggerClassName="bg-[#5b66ff] text-white hover:bg-[#4b57ff]"
          />
        </div>
      </div>

      <div className="flex gap-6 border-b">
        <button
          className={`pb-3 text-sm font-medium ${activeTab === "active" ? "border-b-2 border-[#5b66ff] text-[#5b66ff]" : "text-muted-foreground"}`}
          onClick={() => router.push(`/journals/${templateCode}`)}
        >
          Активные
        </button>
        <button
          className={`pb-3 text-sm font-medium ${activeTab === "closed" ? "border-b-2 border-[#5b66ff] text-[#5b66ff]" : "text-muted-foreground"}`}
          onClick={() => router.push(`/journals/${templateCode}?tab=closed`)}
        >
          Закрытые
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">
          Документов пока нет
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-lg border bg-card px-5 py-4"
            >
              <Link
                href={`/journals/${templateCode}/documents/${doc.id}`}
                className="flex-1 text-[16px] font-medium hover:underline"
              >
                {doc.title}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-8">
                    <Ellipsis className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSettingsDoc(doc)}>
                    Настройки
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      <SettingsDialog
        open={!!settingsDoc}
        onOpenChange={(v) => { if (!v) setSettingsDoc(null); }}
        document={settingsDoc}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journals/med-book-documents-client.tsx
git commit -m "feat: add med-book-documents-client for document list page"
```

---

### Task 5: Document List Page Routing

**Files:**
- Modify: `src/app/(dashboard)/journals/[code]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add:
```typescript
import { MedBookDocumentsClient } from "@/components/journals/med-book-documents-client";
import {
  MED_BOOK_TEMPLATE_CODE,
  MED_BOOK_DOCUMENT_TITLE,
  getDefaultMedBookConfig,
} from "@/lib/med-book-document";
```

- [ ] **Step 2: Add med_books routing block**

After the `if (resolvedCode === "hygiene" || resolvedCode === "health_check")` block (around line 487), add:

```typescript
  if (resolvedCode === MED_BOOK_TEMPLATE_CODE) {
    // Auto-seed one active sample document if none exist
    const existingCount = await db.journalDocument.count({
      where: {
        organizationId: session.user.organizationId,
        templateId: template.id,
      },
    });

    if (existingCount === 0) {
      const now = new Date();
      await db.journalDocument.create({
        data: {
          templateId: template.id,
          organizationId: session.user.organizationId,
          title: MED_BOOK_DOCUMENT_TITLE,
          status: "active",
          dateFrom: now,
          dateTo: now,
          createdById: session.user.id,
          config: getDefaultMedBookConfig(),
        },
      });
    }

    const documents = await db.journalDocument.findMany({
      where: {
        organizationId: session.user.organizationId,
        templateId: template.id,
        status: activeTab,
      },
      orderBy: { createdAt: "asc" },
    });

    return (
      <MedBookDocumentsClient
        activeTab={activeTab}
        templateCode={resolvedCode}
        templateName={template.name}
        users={orgUsers}
        documents={documents.map((doc) => ({
          id: doc.id,
          title: doc.title || MED_BOOK_DOCUMENT_TITLE,
          status: doc.status as "active" | "closed",
        }))}
      />
    );
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/journals/[code]/page.tsx
git commit -m "feat: add med_books routing to document list page with auto-seed"
```

---

### Task 6: Main Document Client Component

**Files:**
- Create: `src/components/journals/med-book-document-client.tsx`

This is the largest component. It renders the two tables (examinations + vaccinations), handles inline cell editing, row add/edit/delete, and column management.

- [ ] **Step 1: Create the full med-book-document-client.tsx**

```tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Plus, Trash2, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import {
  type MedBookDocumentConfig,
  type MedBookEntryData,
  type MedBookExamination,
  type MedBookVaccination,
  type MedBookVaccinationType,
  VACCINATION_TYPE_LABELS,
  EXAMINATION_REFERENCE_DATA,
  VACCINATION_REFERENCE_DATA,
  MED_BOOK_VACCINATION_RULES,
  emptyMedBookEntry,
  formatMedBookDate,
  isExaminationExpired,
  isExaminationExpiringSoon,
} from "@/lib/med-book-document";
import { toast } from "sonner";

type EmployeeRow = {
  id: string;
  employeeId: string;
  name: string;
  data: MedBookEntryData;
};

type Props = {
  documentId: string;
  title: string;
  templateCode: string;
  organizationName: string;
  status: string;
  config: MedBookDocumentConfig;
  employees: { id: string; name: string; role: string }[];
  initialRows: EmployeeRow[];
};

function getPositionLabel(role: string): string {
  switch (role) {
    case "owner": return "Управляющий";
    case "technologist": return "Шеф-повар";
    case "operator": return "Повар";
    default: return "Сотрудник";
  }
}

export function MedBookDocumentClient({
  documentId,
  title,
  templateCode,
  organizationName,
  status,
  config,
  employees,
  initialRows,
}: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<EmployeeRow[]>(initialRows);
  const [examColumns, setExamColumns] = useState<string[]>(config.examinations);
  const [vaccColumns, setVaccColumns] = useState<string[]>(config.vaccinations);
  const [saving, setSaving] = useState(false);

  // Dialogs
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [addExamOpen, setAddExamOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Exam cell editing
  const [editingExamCell, setEditingExamCell] = useState<{ rowId: string; examName: string } | null>(null);
  const [editExamDate, setEditExamDate] = useState("");
  const [editExamExpiry, setEditExamExpiry] = useState("");

  // Vaccination cell editing
  const [editingVaccCell, setEditingVaccCell] = useState<{ rowId: string; vaccName: string } | null>(null);
  const [editVaccType, setEditVaccType] = useState<MedBookVaccinationType>("done");
  const [editVaccDose, setEditVaccDose] = useState("");
  const [editVaccDate, setEditVaccDate] = useState("");
  const [editVaccExpiry, setEditVaccExpiry] = useState("");

  // Add row form state
  const [newRowEmployeeId, setNewRowEmployeeId] = useState("");
  const [newRowPosition, setNewRowPosition] = useState("");
  const [newRowBirthDate, setNewRowBirthDate] = useState(new Date().toISOString().slice(0, 10));
  const [newRowGender, setNewRowGender] = useState<"male" | "female" | null>(null);
  const [newRowHireDate, setNewRowHireDate] = useState(new Date().toISOString().slice(0, 10));
  const [newRowMedBookNumber, setNewRowMedBookNumber] = useState("");

  // Settings dialog
  const [settingsTitle, setSettingsTitle] = useState(title);

  const availableEmployees = useMemo(
    () => employees.filter((emp) => !rows.some((r) => r.employeeId === emp.id)),
    [employees, rows]
  );

  const saveEntries = useCallback(
    async (updatedRows: EmployeeRow[], updatedConfig?: Partial<MedBookDocumentConfig>) => {
      setSaving(true);
      try {
        const entries = updatedRows.map((row) => ({
          employeeId: row.employeeId,
          date: new Date().toISOString().slice(0, 10),
          data: row.data,
        }));

        await fetch(`/api/journal-documents/${documentId}/entries`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries }),
        });

        if (updatedConfig) {
          await fetch(`/api/journal-documents/${documentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              config: {
                ...config,
                examinations: updatedConfig.examinations ?? examColumns,
                vaccinations: updatedConfig.vaccinations ?? vaccColumns,
                includeVaccinations: updatedConfig.includeVaccinations ?? config.includeVaccinations,
              },
            }),
          });
        }
      } catch {
        toast.error("Ошибка сохранения");
      } finally {
        setSaving(false);
      }
    },
    [documentId, config, examColumns, vaccColumns]
  );

  function handleAddRow() {
    if (!newRowEmployeeId) return;
    const emp = employees.find((e) => e.id === newRowEmployeeId);
    if (!emp) return;

    const newRow: EmployeeRow = {
      id: `row-${Date.now()}`,
      employeeId: emp.id,
      name: emp.name,
      data: {
        ...emptyMedBookEntry(newRowPosition || getPositionLabel(emp.role)),
        birthDate: newRowBirthDate || null,
        gender: newRowGender,
        hireDate: newRowHireDate || null,
        medBookNumber: newRowMedBookNumber || null,
      },
    };

    const updated = [...rows, newRow];
    setRows(updated);
    saveEntries(updated);
    setAddRowOpen(false);
    resetAddRowForm();
  }

  function resetAddRowForm() {
    setNewRowEmployeeId("");
    setNewRowPosition("");
    setNewRowBirthDate(new Date().toISOString().slice(0, 10));
    setNewRowGender(null);
    setNewRowHireDate(new Date().toISOString().slice(0, 10));
    setNewRowMedBookNumber("");
  }

  function handleDeleteRow(rowId: string) {
    const updated = rows.filter((r) => r.id !== rowId);
    setRows(updated);
    saveEntries(updated);
  }

  function openExamCellEdit(rowId: string, examName: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const exam = row.data.examinations[examName];
    setEditingExamCell({ rowId, examName });
    setEditExamDate(exam?.date || "");
    setEditExamExpiry(exam?.expiryDate || "");
  }

  function saveExamCell() {
    if (!editingExamCell) return;
    const { rowId, examName } = editingExamCell;
    const updated = rows.map((r) => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        data: {
          ...r.data,
          examinations: {
            ...r.data.examinations,
            [examName]: {
              date: editExamDate || null,
              expiryDate: editExamExpiry || null,
            },
          },
        },
      };
    });
    setRows(updated);
    saveEntries(updated);
    setEditingExamCell(null);
  }

  function openVaccCellEdit(rowId: string, vaccName: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const vacc = row.data.vaccinations[vaccName];
    setEditingVaccCell({ rowId, vaccName });
    setEditVaccType(vacc?.type || "done");
    setEditVaccDose(vacc?.dose || "");
    setEditVaccDate(vacc?.date || "");
    setEditVaccExpiry(vacc?.expiryDate || "");
  }

  function saveVaccCell() {
    if (!editingVaccCell) return;
    const { rowId, vaccName } = editingVaccCell;
    const updated = rows.map((r) => {
      if (r.id !== rowId) return r;
      return {
        ...r,
        data: {
          ...r.data,
          vaccinations: {
            ...r.data.vaccinations,
            [vaccName]: {
              type: editVaccType,
              dose: editVaccDose || null,
              date: editVaccDate || null,
              expiryDate: editVaccExpiry || null,
            },
          },
        },
      };
    });
    setRows(updated);
    saveEntries(updated);
    setEditingVaccCell(null);
  }

  function handleAddExamColumn(name: string) {
    if (!name.trim() || examColumns.includes(name.trim())) return;
    const updated = [...examColumns, name.trim()];
    setExamColumns(updated);
    saveEntries(rows, { examinations: updated });
    setAddExamOpen(false);
  }

  function handleSaveSettings() {
    if (!settingsTitle.trim()) return;
    fetch(`/api/journal-documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: settingsTitle.trim() }),
    }).then(() => {
      setSettingsOpen(false);
      router.refresh();
    });
  }

  // Edit row dialog
  const editRow = rows.find((r) => r.id === editRowId);

  function handleSaveEditRow(data: Partial<MedBookEntryData>) {
    if (!editRowId) return;
    const updated = rows.map((r) => {
      if (r.id !== editRowId) return r;
      return { ...r, data: { ...r.data, ...data } };
    });
    setRows(updated);
    saveEntries(updated);
    setEditRowId(null);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/journals/${templateCode}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-2xl font-bold">{title}</h1>
        </div>
        <Button
          variant="ghost"
          className="text-[#5b66ff]"
          onClick={() => {
            setSettingsTitle(title);
            setSettingsOpen(true);
          }}
        >
          Настройки журнала
        </Button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          onClick={() => {
            resetAddRowForm();
            setAddRowOpen(true);
          }}
          className="bg-[#5b66ff] text-white hover:bg-[#4b57ff]"
        >
          <Plus className="mr-1 size-4" />
          Добавить сотрудника
        </Button>
        <Button
          onClick={() => setAddExamOpen(true)}
          className="bg-[#5b66ff] text-white hover:bg-[#4b57ff]"
        >
          <Plus className="mr-1 size-4" />
          Добавить исследование
        </Button>
      </div>

      {/* Examinations table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-2 py-2 text-center">
                № п/п
              </th>
              <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                Ф.И.О. сотрудника
              </th>
              <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                Должность
              </th>
              <th
                colSpan={examColumns.length}
                className="border border-gray-300 bg-gray-50 px-3 py-2 text-center"
              >
                Наименование специалиста / исследования
              </th>
            </tr>
            <tr>
              {examColumns.map((col) => (
                <th
                  key={col}
                  className="border border-gray-300 bg-gray-50 px-2 py-2 text-center text-xs font-medium"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className="group">
                <td className="border border-gray-300 px-2 py-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-gray-300"
                    />
                    {idx + 1}
                  </div>
                </td>
                <td className="border border-gray-300 px-3 py-2">
                  <div className="flex items-center justify-between gap-1">
                    {row.name}
                    <button
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => setEditRowId(row.id)}
                    >
                      <Pencil className="size-3 text-gray-400" />
                    </button>
                  </div>
                </td>
                <td className="border border-gray-300 px-3 py-2">
                  {row.data.positionTitle}
                </td>
                {examColumns.map((col) => {
                  const exam = row.data.examinations[col];
                  const expired = exam ? isExaminationExpired(exam) : false;
                  const expiringSoon = exam ? isExaminationExpiringSoon(exam) : false;

                  return (
                    <td
                      key={col}
                      className={`cursor-pointer border border-gray-300 px-2 py-1 text-center text-xs ${
                        expired
                          ? "bg-red-100 text-red-800"
                          : expiringSoon
                            ? "bg-yellow-50 text-yellow-800"
                            : ""
                      }`}
                      onClick={() => openExamCellEdit(row.id, col)}
                    >
                      {exam?.date ? (
                        <div>
                          <div>{formatMedBookDate(exam.date)}</div>
                          {exam.expiryDate && (
                            <div className="text-[10px] text-gray-500">
                              до {formatMedBookDate(exam.expiryDate)}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Static: Список специалистов и исследований */}
      <div id="med-book-reference">
        <h2 className="mb-4 text-lg font-bold">Список специалистов и исследований</h2>
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                Наименование специалиста / исследование
              </th>
              <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                Периодичность
              </th>
              <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                Примечание
              </th>
            </tr>
          </thead>
          <tbody>
            {EXAMINATION_REFERENCE_DATA.map((item) => (
              <tr key={item.name}>
                <td className="border border-gray-300 px-3 py-2">{item.name}</td>
                <td className="border border-gray-300 px-3 py-2">{item.periodicity}</td>
                <td className="border border-gray-300 px-3 py-2">{item.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vaccinations table */}
      {config.includeVaccinations && (
        <>
          <h2 className="text-center text-lg font-bold">Прививки</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr>
                  <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-2 py-2 text-center">
                    № п/п
                  </th>
                  <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                    Ф.И.О. сотрудника
                  </th>
                  <th rowSpan={2} className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                    Должность
                  </th>
                  <th
                    colSpan={vaccColumns.length + 1}
                    className="border border-gray-300 bg-gray-50 px-3 py-2 text-center"
                  >
                    Наименование прививки:
                  </th>
                </tr>
                <tr>
                  {vaccColumns.map((col) => (
                    <th
                      key={col}
                      className="border border-gray-300 bg-gray-50 px-2 py-2 text-center text-xs font-medium"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="border border-gray-300 bg-gray-50 px-2 py-2 text-center text-xs font-medium">
                    Примечание
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.id}>
                    <td className="border border-gray-300 px-2 py-2 text-center">
                      {idx + 1}
                    </td>
                    <td className="border border-gray-300 px-3 py-2">{row.name}</td>
                    <td className="border border-gray-300 px-3 py-2">
                      {row.data.positionTitle}
                    </td>
                    {vaccColumns.map((col) => {
                      const vacc = row.data.vaccinations[col];
                      const isExpired = vacc?.expiryDate
                        ? vacc.expiryDate < new Date().toISOString().slice(0, 10)
                        : false;

                      return (
                        <td
                          key={col}
                          className={`cursor-pointer border border-gray-300 px-2 py-1 text-center text-xs ${isExpired ? "bg-red-100" : ""}`}
                          onClick={() => openVaccCellEdit(row.id, col)}
                        >
                          {vacc ? (
                            vacc.type === "refusal" ? (
                              <span className="text-gray-500">Отказ сотрудника</span>
                            ) : vacc.type === "exemption" ? (
                              <span className="text-gray-500">Мед. отвод</span>
                            ) : (
                              <div>
                                {vacc.dose && <div>{vacc.dose}: {formatMedBookDate(vacc.date || null)}</div>}
                                {vacc.expiryDate && (
                                  <div className="text-[10px] text-gray-500">
                                    до {formatMedBookDate(vacc.expiryDate)}
                                  </div>
                                )}
                              </div>
                            )
                          ) : null}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-2 py-2 text-center text-xs">
                      {row.data.note || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Static: Список прививок */}
          <h2 className="text-lg font-bold">Список прививок</h2>
          <p className="text-sm leading-relaxed">
            Вакцинация всех сотрудников проводится в соответствии Приказом Минздрава России от 06.12.2021 N 1122н
            «Об утверждении национального календаря профилактических прививок, календаря профилактических прививок
            по эпидемическим показаниям и порядка проведения профилактических прививок»:
          </p>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead>
              <tr>
                <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                  Наименование прививок
                </th>
                <th className="border border-gray-300 bg-gray-50 px-3 py-2 text-left">
                  Периодичность
                </th>
              </tr>
            </thead>
            <tbody>
              {VACCINATION_REFERENCE_DATA.map((item) => (
                <tr key={item.name}>
                  <td className="border border-gray-300 px-3 py-2">{item.name}</td>
                  <td className="border border-gray-300 px-3 py-2">{item.periodicity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 space-y-1 text-sm font-bold">
            {MED_BOOK_VACCINATION_RULES.map((rule) => (
              <p key={rule}>{rule}</p>
            ))}
          </div>
        </>
      )}

      {/* ===== DIALOGS ===== */}

      {/* Add Row Dialog */}
      <AddRowDialog
        open={addRowOpen}
        onOpenChange={setAddRowOpen}
        employees={availableEmployees}
        employeeId={newRowEmployeeId}
        onEmployeeChange={(id) => {
          setNewRowEmployeeId(id);
          const emp = employees.find((e) => e.id === id);
          if (emp) setNewRowPosition(getPositionLabel(emp.role));
        }}
        position={newRowPosition}
        onPositionChange={setNewRowPosition}
        birthDate={newRowBirthDate}
        onBirthDateChange={setNewRowBirthDate}
        gender={newRowGender}
        onGenderChange={setNewRowGender}
        hireDate={newRowHireDate}
        onHireDateChange={setNewRowHireDate}
        medBookNumber={newRowMedBookNumber}
        onMedBookNumberChange={setNewRowMedBookNumber}
        onSave={handleAddRow}
      />

      {/* Edit Row Dialog */}
      {editRow && (
        <EditRowDialog
          open={!!editRowId}
          onOpenChange={(v) => { if (!v) setEditRowId(null); }}
          row={editRow}
          onSave={handleSaveEditRow}
          onDelete={() => handleDeleteRow(editRow.id)}
        />
      )}

      {/* Add Examination Dialog */}
      <AddColumnDialog
        open={addExamOpen}
        onOpenChange={setAddExamOpen}
        dialogTitle="Добавление нового специалиста / исследования"
        placeholder="Введите название исследования"
        onSave={handleAddExamColumn}
      />

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] rounded-[24px] border-0 p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[20px] font-medium">
              Настройки документа
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>Название документа</Label>
              <Input
                value={settingsTitle}
                onChange={(e) => setSettingsTitle(e.target.value)}
                className="h-12 rounded-xl border-[#dfe1ec] px-4"
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleSaveSettings}
                className="h-10 rounded-xl bg-[#5b66ff] px-5 text-white hover:bg-[#4b57ff]"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exam Cell Edit Dialog */}
      <Dialog open={!!editingExamCell} onOpenChange={(v) => { if (!v) setEditingExamCell(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[400px] rounded-[24px] border-0 p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[18px] font-medium">
              {editingExamCell?.examName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>Дата осмотра</Label>
              <Input
                type="date"
                value={editExamDate}
                onChange={(e) => setEditExamDate(e.target.value)}
                className="h-12 rounded-xl border-[#dfe1ec] px-4"
              />
            </div>
            <div className="space-y-2">
              <Label>Действует до</Label>
              <Input
                type="date"
                value={editExamExpiry}
                onChange={(e) => setEditExamExpiry(e.target.value)}
                className="h-12 rounded-xl border-[#dfe1ec] px-4"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  // Clear the cell
                  if (editingExamCell) {
                    const { rowId, examName } = editingExamCell;
                    const updated = rows.map((r) => {
                      if (r.id !== rowId) return r;
                      const exams = { ...r.data.examinations };
                      delete exams[examName];
                      return { ...r, data: { ...r.data, examinations: exams } };
                    });
                    setRows(updated);
                    saveEntries(updated);
                  }
                  setEditingExamCell(null);
                }}
                className="h-10 rounded-xl px-4"
              >
                Очистить
              </Button>
              <Button
                onClick={saveExamCell}
                className="h-10 rounded-xl bg-[#5b66ff] px-5 text-white hover:bg-[#4b57ff]"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vaccination Cell Edit Dialog */}
      <Dialog open={!!editingVaccCell} onOpenChange={(v) => { if (!v) setEditingVaccCell(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-[400px] rounded-[24px] border-0 p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="text-[18px] font-medium">
              {editingVaccCell?.vaccName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>Тип</Label>
              <Select value={editVaccType} onValueChange={(v) => setEditVaccType(v as MedBookVaccinationType)}>
                <SelectTrigger className="h-12 rounded-xl border-[#dfe1ec]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(VACCINATION_TYPE_LABELS) as [MedBookVaccinationType, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
            {editVaccType === "done" && (
              <>
                <div className="space-y-2">
                  <Label>Доза (V1, V2...)</Label>
                  <Input
                    value={editVaccDose}
                    onChange={(e) => setEditVaccDose(e.target.value)}
                    placeholder="V1"
                    className="h-12 rounded-xl border-[#dfe1ec] px-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата прививки</Label>
                  <Input
                    type="date"
                    value={editVaccDate}
                    onChange={(e) => setEditVaccDate(e.target.value)}
                    className="h-12 rounded-xl border-[#dfe1ec] px-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Действует до</Label>
                  <Input
                    type="date"
                    value={editVaccExpiry}
                    onChange={(e) => setEditVaccExpiry(e.target.value)}
                    className="h-12 rounded-xl border-[#dfe1ec] px-4"
                  />
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (editingVaccCell) {
                    const { rowId, vaccName } = editingVaccCell;
                    const updated = rows.map((r) => {
                      if (r.id !== rowId) return r;
                      const vaccs = { ...r.data.vaccinations };
                      delete vaccs[vaccName];
                      return { ...r, data: { ...r.data, vaccinations: vaccs } };
                    });
                    setRows(updated);
                    saveEntries(updated);
                  }
                  setEditingVaccCell(null);
                }}
                className="h-10 rounded-xl px-4"
              >
                Очистить
              </Button>
              <Button
                onClick={saveVaccCell}
                className="h-10 rounded-xl bg-[#5b66ff] px-5 text-white hover:bg-[#4b57ff]"
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ===== Sub-components ===== */

function AddRowDialog({
  open,
  onOpenChange,
  employees,
  employeeId,
  onEmployeeChange,
  position,
  onPositionChange,
  birthDate,
  onBirthDateChange,
  gender,
  onGenderChange,
  hireDate,
  onHireDateChange,
  medBookNumber,
  onMedBookNumberChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employees: { id: string; name: string; role: string }[];
  employeeId: string;
  onEmployeeChange: (id: string) => void;
  position: string;
  onPositionChange: (v: string) => void;
  birthDate: string;
  onBirthDateChange: (v: string) => void;
  gender: "male" | "female" | null;
  onGenderChange: (v: "male" | "female" | null) => void;
  hireDate: string;
  onHireDateChange: (v: string) => void;
  medBookNumber: string;
  onMedBookNumberChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] rounded-[24px] border-0 p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[20px] font-medium">
            Добавление новой строки
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <div className="space-y-2">
            <Label>Должность</Label>
            <Select value={position} onValueChange={onPositionChange}>
              <SelectTrigger className="h-12 rounded-xl border-[#dfe1ec]">
                <SelectValue placeholder="- Выберите значение -" />
              </SelectTrigger>
              <SelectContent>
                {["Управляющий", "Шеф-повар", "Повар", "Кондитер", "Официант", "Бармен"].map(
                  (p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {employees.length > 0 && (
            <div className="space-y-2">
              <Label>Сотрудник</Label>
              <Select value={employeeId} onValueChange={onEmployeeChange}>
                <SelectTrigger className="h-12 rounded-xl border-[#dfe1ec]">
                  <SelectValue placeholder="- Выберите сотрудника -" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Дата рождения</Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => onBirthDateChange(e.target.value)}
              className="h-12 rounded-xl border-[#dfe1ec] px-4"
            />
          </div>

          <div className="space-y-2">
            <Label>Пол</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender-new"
                  checked={gender === "male"}
                  onChange={() => onGenderChange("male")}
                />
                Мужской
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender-new"
                  checked={gender === "female"}
                  onChange={() => onGenderChange("female")}
                />
                Женский
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Дата приема на работу</Label>
            <Input
              type="date"
              value={hireDate}
              onChange={(e) => onHireDateChange(e.target.value)}
              className="h-12 rounded-xl border-[#dfe1ec] px-4"
            />
          </div>

          <div className="space-y-2">
            <Input
              value={medBookNumber}
              onChange={(e) => onMedBookNumberChange(e.target.value)}
              placeholder="Введите номер мед. книжки"
              className="h-12 rounded-xl border-[#dfe1ec] px-4"
            />
          </div>

          <div className="flex justify-center pt-2">
            <Button
              onClick={onSave}
              disabled={!employeeId}
              className="h-11 rounded-xl bg-[#5b66ff] px-8 text-white hover:bg-[#4b57ff]"
            >
              Добавить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditRowDialog({
  open,
  onOpenChange,
  row,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: EmployeeRow;
  onSave: (data: Partial<MedBookEntryData>) => void;
  onDelete: () => void;
}) {
  const [birthDate, setBirthDate] = useState(row.data.birthDate || "");
  const [gender, setGender] = useState(row.data.gender);
  const [hireDate, setHireDate] = useState(row.data.hireDate || "");
  const [medBookNumber, setMedBookNumber] = useState(row.data.medBookNumber || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] rounded-[24px] border-0 p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[20px] font-medium">
            Редактирование строки
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <div>
            <div className="text-sm font-semibold">Должность</div>
            <div className="text-sm">{row.data.positionTitle}</div>
          </div>
          <div>
            <div className="text-sm font-semibold">Сотрудник</div>
            <div className="text-sm">{row.name}</div>
          </div>
          <div className="space-y-2">
            <Label>Дата рождения</Label>
            <Input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-12 rounded-xl border-[#dfe1ec] px-4"
            />
          </div>
          <div className="space-y-2">
            <Label>Пол</Label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender-edit"
                  checked={gender === "male"}
                  onChange={() => setGender("male")}
                />
                Мужской
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="gender-edit"
                  checked={gender === "female"}
                  onChange={() => setGender("female")}
                />
                Женский
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Дата приема на работу</Label>
            <Input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              className="h-12 rounded-xl border-[#dfe1ec] px-4"
            />
          </div>
          <div className="space-y-2">
            <Input
              value={medBookNumber}
              onChange={(e) => setMedBookNumber(e.target.value)}
              placeholder="Введите номер мед. книжки"
              className="h-12 rounded-xl border-[#dfe1ec] px-4"
            />
          </div>
          <div className="flex justify-between pt-2">
            <Button
              variant="ghost"
              className="text-red-500 hover:text-red-600"
              onClick={() => {
                onDelete();
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-1 size-4" />
              Удалить
            </Button>
            <Button
              onClick={() =>
                onSave({
                  birthDate: birthDate || null,
                  gender,
                  hireDate: hireDate || null,
                  medBookNumber: medBookNumber || null,
                })
              }
              className="h-11 rounded-xl bg-[#5b66ff] px-8 text-white hover:bg-[#4b57ff]"
            >
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddColumnDialog({
  open,
  onOpenChange,
  dialogTitle,
  placeholder,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dialogTitle: string;
  placeholder: string;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setName("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[560px] rounded-[24px] border-0 p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-[20px] font-medium">
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 px-6 py-5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            className="h-12 rounded-xl border-[#dfe1ec] px-4"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onSave(name.trim());
                setName("");
              }
            }}
          />
          <div className="flex justify-end">
            <Button
              onClick={() => {
                if (name.trim()) {
                  onSave(name.trim());
                  setName("");
                }
              }}
              disabled={!name.trim()}
              className="h-10 rounded-xl bg-[#5b66ff] px-5 text-white hover:bg-[#4b57ff]"
            >
              Добавить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/journals/med-book-document-client.tsx
git commit -m "feat: add med-book-document-client with tables, dialogs, and cell editing"
```

---

### Task 7: Document Page Routing

**Files:**
- Modify: `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx`

- [ ] **Step 1: Add imports**

At the top of the file, add:
```typescript
import { MedBookDocumentClient } from "@/components/journals/med-book-document-client";
import {
  MED_BOOK_TEMPLATE_CODE,
  normalizeMedBookConfig,
  normalizeMedBookEntryData,
} from "@/lib/med-book-document";
```

- [ ] **Step 2: Add med_books routing block**

After the `if (document.template.code === "health_check")` block (around line 188), add:

```typescript
  if (document.template.code === MED_BOOK_TEMPLATE_CODE) {
    const config = normalizeMedBookConfig(document.config);

    // Group entries by employeeId (one entry per employee)
    const rowMap = new Map<
      string,
      { id: string; employeeId: string; data: ReturnType<typeof normalizeMedBookEntryData> }
    >();
    for (const entry of document.entries) {
      if (!rowMap.has(entry.employeeId)) {
        rowMap.set(entry.employeeId, {
          id: entry.id,
          employeeId: entry.employeeId,
          data: normalizeMedBookEntryData(entry.data),
        });
      }
    }

    const rows = Array.from(rowMap.values()).map((entry) => {
      const emp = enrichedEmployees.find((e) => e.id === entry.employeeId);
      return {
        id: entry.id,
        employeeId: entry.employeeId,
        name: emp?.name || "Сотрудник",
        data: entry.data,
      };
    });

    return (
      <MedBookDocumentClient
        documentId={document.id}
        title={document.title}
        templateCode={code}
        organizationName={organization?.name || 'ООО "Тест"'}
        status={document.status}
        config={config}
        employees={enrichedEmployees}
        initialRows={rows}
      />
    );
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx
git commit -m "feat: add med_books routing to document page"
```

---

### Task 8: Seed Sample Data on First Visit

**Files:**
- Modify: `src/app/(dashboard)/journals/[code]/page.tsx` (the auto-seed block from Task 5)

- [ ] **Step 1: Enhance the auto-seed to add sample employee entries**

Update the med_books auto-seed block (added in Task 5) to also create sample entries for org employees:

Replace the `if (existingCount === 0)` block with:

```typescript
    if (existingCount === 0) {
      const now = new Date();
      const doc = await db.journalDocument.create({
        data: {
          templateId: template.id,
          organizationId: session.user.organizationId,
          title: MED_BOOK_DOCUMENT_TITLE,
          status: "active",
          dateFrom: now,
          dateTo: now,
          createdById: session.user.id,
          config: getDefaultMedBookConfig(),
        },
      });

      // Add sample entries for each org user
      if (orgUsers.length > 0) {
        const { emptyMedBookEntry: emptyEntry } = await import("@/lib/med-book-document");
        const positionLabels: Record<string, string> = {
          owner: "Управляющий",
          technologist: "Шеф-повар",
          operator: "Повар",
        };

        const sampleExamDate = "2025-04-19";
        const sampleExamExpiry = "2026-04-19";
        const expiredExamDate = "2025-03-25";
        const expiredExamExpiry = "2026-03-25";

        await db.journalDocumentEntry.createMany({
          data: orgUsers.slice(0, 5).map((user) => ({
            documentId: doc.id,
            employeeId: user.id,
            date: now,
            data: {
              ...emptyEntry(positionLabels[user.role] || "Сотрудник"),
              birthDate: "2010-03-19",
              gender: "female" as const,
              hireDate: "2025-03-19",
              examinations: {
                "Гинеколог": { date: sampleExamDate, expiryDate: sampleExamExpiry },
                "Стоматолог": { date: null, expiryDate: null },
                "Психиатр": { date: expiredExamDate, expiryDate: expiredExamExpiry },
                "Оториноларинголог": { date: null, expiryDate: null },
                "Терапевт": { date: "2025-06-14", expiryDate: "2026-06-14" },
                "Невролог": { date: "2025-06-14", expiryDate: "2026-06-14" },
                "Нарколог": { date: "2025-06-14", expiryDate: "2026-06-14" },
                "Флюорография": { date: expiredExamDate, expiryDate: expiredExamExpiry },
              },
              vaccinations: {
                "Дифтерия": { type: "refusal" as const },
                "Дизентерия Зонне": { type: "done" as const, dose: "V1", date: "2024-01-01", expiryDate: "2025-01-01" },
                "Краснуха": { type: "refusal" as const },
                "Гепатит B": { type: "refusal" as const },
                "Гепатит A": { type: "refusal" as const },
                "Грипп": { type: "refusal" as const },
                "Коронавирус": { type: "done" as const, dose: "V1", date: "2025-04-01", expiryDate: null },
              },
              note: null,
            },
          })),
          skipDuplicates: true,
        });
      }
    }
```

- [ ] **Step 2: Also import emptyMedBookEntry at the top**

Update the import statement for med-book-document to include `emptyMedBookEntry`:
```typescript
import {
  MED_BOOK_TEMPLATE_CODE,
  MED_BOOK_DOCUMENT_TITLE,
  getDefaultMedBookConfig,
  emptyMedBookEntry,
} from "@/lib/med-book-document";
```

And remove the dynamic import inside the seed block (use the static import instead).

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/journals/[code]/page.tsx
git commit -m "feat: add sample employee data seeding for med_books journal"
```

---

### Task 9: Build and Verify

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: Successful build with no TypeScript errors.

- [ ] **Step 2: Fix any build errors**

If there are errors, fix them based on the output.

- [ ] **Step 3: Run the seed to ensure the template exists in DB**

```bash
npx tsx prisma/seed.ts
```

Expected: Outputs including `Done: med_books: Медицинские книжки`

- [ ] **Step 4: Test locally**

```bash
npm run dev
```

Navigate to `/journals/med_books` in browser. Verify:
- Document list page shows with Active/Closed tabs
- Auto-seeded document "Мед. книжки" appears
- Clicking it opens the document page with tables
- Sample employee data is populated
- Exam cells are clickable and editable
- Vaccination cells are clickable and editable
- Add employee row works
- Add examination column works
- Settings dialog works

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address build issues for med_books journal"
```
