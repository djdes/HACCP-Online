# Medical Books Journal ("Медицинские книжки") - Design Spec

## Overview

A new journal type `med_books` for tracking employee medical books, health examinations, and vaccinations. Unlike existing staff journals (employee x date grids), this journal uses employee x specialist/vaccination grids.

## Data Model

### Template Code
```
med_books
```

### Document Config (`JournalDocument.config`)
```typescript
type MedBookDocumentConfig = {
  examinations: string[];      // column names: ["Гинеколог", "Стоматолог", ...]
  vaccinations: string[];      // column names: ["Дифтерия", "Корь", ...]
  includeVaccinations: boolean; // toggle from creation dialog
};
```

Default examinations: Гинеколог, Стоматолог, Психиатр, Оториноларинголог, Терапевт, Невролог, Нарколог, Дерматовенеролог, Флюорография, Маммография

Default vaccinations: Дифтерия, Корь, Дизентерия Зонне, Краснуха, Гепатит B, Гепатит A, Грипп, Коронавирус

### Entry Data (`JournalDocumentEntry.data`)

One entry per employee (using a fixed date = document dateFrom). The `employeeId` field links to an org user.

```typescript
type MedBookExamination = {
  date: string | null;       // exam date "2025-04-19"
  expiryDate: string | null; // expiry "2026-04-19"
};

type MedBookVaccination = {
  type: "done" | "refusal" | "exemption"; // Вакцинация / Отказ / Мед. отвод
  dose?: string;              // "V1", "V2", etc.
  date?: string | null;       // vaccination date
  expiryDate?: string | null; // expiry date
};

type MedBookEntryData = {
  positionTitle: string;
  birthDate: string | null;
  gender: "male" | "female" | null;
  hireDate: string | null;
  medBookNumber: string | null;
  photoUrl: string | null;
  examinations: Record<string, MedBookExamination>; // key = examination name
  vaccinations: Record<string, MedBookVaccination>;  // key = vaccination name
  note: string | null;
};
```

## UI Components

### 1. Document List Page
Reuses existing `DocumentListUi` pattern (Active/Closed tabs, create button). Uses "Инструкция" button to show reference info.

### 2. Create Document Dialog
- Title input (default: "Мед. книжки")
- Toggle: "включить Прививки" (default: on)
- "Создать" button

### 3. Main Document Page - Two tables:

**Examinations table:**
- Fixed columns: № п/п, ФИО сотрудника, Должность
- Dynamic columns: one per examination from config
- Each cell: exam date + expiry date, red highlight if expired
- "+ Добавить исследование" button to add columns
- "+ Добавить сотрудника" button to add rows

**Vaccinations table** (if enabled):
- Fixed columns: № п/п, ФИО сотрудника, Должность
- Dynamic columns: one per vaccination from config + Примечание
- Each cell: vaccination info or status text

**Static reference sections:**
- "Список специалистов и исследований" - required examinations table with periodicity (per Приказ 29Н от 28.01.2021)
- "Список прививок" - vaccination schedule details per type

### 4. Edit Row Dialog
Fields: Должность (readonly), Сотрудник (readonly), Дата рождения, Пол (radio M/F), Дата приема на работу, Номер мед. книжки, Фото upload

### 5. Add Row Dialog  
Fields: Должность (select from org users), Дата рождения, Пол (radio M/F), Дата приема на работу, Номер мед. книжки, Фото upload

### 6. Document Settings Dialog
- Title rename only

### 7. Add Examination/Vaccination Dialog
- Simple text input for name

## Files to Create

1. `src/lib/med-book-document.ts` - Types, constants, defaults, normalization, reference data
2. `src/components/journals/med-book-document-client.tsx` - Main document page UI (both tables, dialogs, static sections)
3. `src/components/journals/med-book-documents-client.tsx` - Document list page wrapper

## Files to Modify

1. `src/lib/journal-document-helpers.ts` - Add `med_books` to `isDocumentTemplate()`, add title/period functions
2. `src/components/journals/create-document-dialog.tsx` - Add med_books creation mode (title + vaccinations toggle)
3. `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx` - Add routing for med_books
4. `src/app/(dashboard)/journals/[code]/page.tsx` - Add med_books to document list + auto-seed sample data
5. `prisma/seed.ts` - Add med_books template if not exists

## Seed / Test Data

Auto-create one active sample document when user first visits the page (following existing pattern). Populate with org employees and sample examination dates.

## Cell Editing

Clicking a cell in the examinations or vaccinations table opens inline editing. For examinations: two date inputs (exam date + expiry). For vaccinations: type selector (done/refusal/exemption) + dose + dates.

## Expiry Highlighting

Red background on cells where `expiryDate < today`. Yellow for cells expiring within 30 days.
