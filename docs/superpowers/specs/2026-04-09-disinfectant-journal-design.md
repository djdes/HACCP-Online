# Disinfectant Journal — Custom Document Design

## Overview

Convert `disinfectant_usage` from a generic tracked/register document to a fully custom document-style journal with three data tables, matching the source application UX.

**Full Russian title**: Журнал учета получения, расхода дезинфицирующих средств и проведения дезинфекционных работ на объекте

**Template code**: `disinfectant_usage` (existing)
**Source slug**: `disinfectjournal` (existing mapping)

## Data Model

All data stored in `JournalDocument.config` as JSON (`DisinfectantDocumentConfig`).

### DisinfectantDocumentConfig

```typescript
type MeasureUnit = "kg" | "l" | "bottle"; // Кг / Л / Фл

type SubdivisionRow = {
  id: string;
  name: string;                    // Наименование подразделения / объекта
  area: number | null;             // Площадь объекта (кв.м), null when byCapacity=true
  byCapacity: boolean;             // "На ёмкость" toggle
  treatmentType: "current" | "general"; // Текущая / Генеральная
  frequencyPerMonth: number;       // Кратность обработок в месяц
  disinfectantName: string;        // Наименование дез. средства
  concentration: number;           // Концентрация (%)
  solutionConsumptionPerSqm: number; // Расход раб. раствора на 1 кв.м (л)
  solutionPerTreatment: number;    // Кол-во раб. р-ра для однократной обработки (л)
  // Computed on render:
  // needPerTreatment = solutionPerTreatment * (concentration / 100)
  // needPerMonth = needPerTreatment * frequencyPerMonth
  // needPerYear = needPerMonth * 12
};

type ReceiptRow = {
  id: string;
  date: string;                    // Дата получения (ISO date)
  disinfectantName: string;        // Наименование дез. средства
  quantity: number;                // Количество
  unit: MeasureUnit;               // Единица измерения
  expiryDate: string;              // Срок годности до (ISO date)
  responsibleRole: string;         // Должность ответственного
  responsibleEmployee: string;     // ФИО сотрудника
};

type ConsumptionRow = {
  id: string;
  periodFrom: string;              // Начало периода (ISO date)
  periodTo: string;                // Конец периода (ISO date)
  disinfectantName: string;        // Наименование дез. средства
  totalReceived: number;           // Общее кол-во полученного (вкл. остаток)
  totalReceivedUnit: MeasureUnit;
  totalConsumed: number;           // Общее кол-во израсходованного
  totalConsumedUnit: MeasureUnit;
  remainder: number;               // Остаток на конец периода
  remainderUnit: MeasureUnit;
  responsibleRole: string;
  responsibleEmployee: string;
};

type DisinfectantDocumentConfig = {
  responsibleRole: string;         // Default responsible role (document-level)
  responsibleEmployee: string;     // Default responsible employee
  subdivisions: SubdivisionRow[];
  receipts: ReceiptRow[];
  consumptions: ConsumptionRow[];
};
```

## Computed Fields (subdivision table)

- **Потребность на одну обработку** = `solutionPerTreatment * (concentration / 100)`
- **Потребность на один месяц** = `needPerTreatment * frequencyPerMonth`
- **Потребность на один год** = `needPerMonth * 12`
- **Итого row** at bottom = sum of each computed column across all subdivisions

When `byCapacity = true`, area displays "На ёмк." and `solutionConsumptionPerSqm` is not used (user enters `solutionPerTreatment` directly).

## Files to Create

1. `src/lib/disinfectant-document.ts` — types, constants, normalization, defaults, computed helpers
2. `src/components/journals/disinfectant-document-client.tsx` — single document page with 3 tables
3. `src/components/journals/disinfectant-documents-client.tsx` — list page with create/settings/archive/delete

## Files to Modify

1. `src/lib/tracked-document.ts` — remove `disinfectant_usage` from TRACKED_DOCUMENT_TEMPLATE_CODES
2. `src/lib/register-document.ts` — remove `disinfectant_usage` from REGISTER_DOCUMENT_TEMPLATE_CODES
3. `src/lib/journal-document-helpers.ts` — add disinfectant imports and routing
4. `src/app/(dashboard)/journals/[code]/page.tsx` — add DisinfectantDocumentsClient branch
5. `src/app/(dashboard)/journals/[code]/documents/[docId]/page.tsx` — add DisinfectantDocumentClient branch
6. `prisma/seed.ts` — update template name to full title, ensure fields are present

## UI Structure

### List page (disinfectant-documents-client.tsx)

- Header: full journal title + "Инструкция" + "+ Создать документ" buttons
- Active/Closed tabs
- Document cards: title, responsible person, dropdown menu (Настройки, Печать, Отправить в закрытые, Удалить)
- Create dialog: title, responsible role, responsible employee
- Settings dialog: same fields as create
- Archive confirmation dialog

### Document page (disinfectant-document-client.tsx)

- Breadcrumbs: org > journal title > document title
- "Настройки журнала" button (top right)
- Formal header block: org name | СИСТЕМА ХАССП / journal title | page number
- Three sections, each with "+ Добавить" button and data table:

**Section 1: РАСЧЕТ ПОТРЕБНОСТИ В ДЕЗИНФИЦИРУЮЩИХ СРЕДСТВАХ**
- "+ Добавить подразделение" button
- Table with checkboxes, all subdivision fields, computed columns
- Totals row at bottom
- Add dialog: name (textarea), area, byCapacity toggle, treatment type radio, frequency
- Inline editing for disinfectant fields (name, concentration, consumption, solution per treatment)

**Section 2: СВЕДЕНИЯ О ПОСТУПЛЕНИИ ДЕЗИНФИЦИРУЮЩИХ СРЕДСТВ**
- "+ Добавить поступление" button
- Table: date, name, quantity+unit, expiry, responsible
- Totals row (sum of quantities)
- Add/edit dialog: date, name, quantity+unit radio, expiry date, role select, employee select

**Section 3: СВЕДЕНИЯ О РАСХОДОВАНИИ ДЕЗИНФИЦИРУЮЩИХ СРЕДСТВ**
- "+ Добавить расход" button
- Table: period, name, total received+unit, total consumed+unit, remainder+unit, responsible
- Add/edit dialog: name, received+unit, consumed+unit, remainder+unit, role, employee

### Dialogs

All dialogs follow existing project pattern:
- Rounded corners (rounded-[28px])
- Header with title + X close button
- Form fields with labels
- Submit button (bg-[#5563ff])

## Test Data (seed)

Seed with 2-3 subdivisions, 2 receipt rows, 1-2 consumption rows using realistic data:
- "Поверхности в помещениях для гостей (пол)" — 50 кв.м, Текущая, 31/мес
- "Мебель в помещениях для гостей" — На ёмк., Текущая, 31/мес
- Default disinfectant: "Ph средство дезинфицирующее", concentration 0.5%
