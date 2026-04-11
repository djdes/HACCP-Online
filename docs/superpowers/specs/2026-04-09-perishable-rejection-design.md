# Perishable Rejection Journal Design

Template code: `perishable_rejection`
Title: "Журнал бракеража скоропортящейся пищевой продукции"

## Row Data

```typescript
type PerishableRejectionRow = {
  id: string;
  arrivalDate: string;       // "2026-04-09"
  arrivalTime: string;        // "20:14"
  productName: string;
  productionDate: string;
  manufacturer: string;
  supplier: string;
  packaging: string;          // фасовка/кол-во
  quantity: string;           // кол-во поступившего продукта
  documentNumber: string;
  organolepticResult: "compliant" | "non_compliant";
  storageCondition: "2_6" | "minus18" | "minus2_2";
  expiryDate: string;
  actualSaleDate: string;
  actualSaleTime: string;
  responsiblePerson: string;
  note: string;
};
```

## Config

```typescript
type PerishableRejectionConfig = {
  rows: PerishableRejectionRow[];
  productLists: Array<{ id: string; name: string; items: string[] }>;
  manufacturers: string[];
  suppliers: string[];
};
```

## Files to create/modify

Same pattern as finished_product journal.
