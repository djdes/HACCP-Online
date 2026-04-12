# Defect Propagation Ledger

| Defect class | Scope rechecked | Current state | Proof |
| --- | --- | --- | --- |
| Missing list-page dispatch | Active 35 journal routes | Fixed for `complaint_register`, `audit_protocol`, `audit_report` | `inventory.md`, `src/app/(dashboard)/journals/[code]/page.tsx` |
| Missing source/live alias | Active live mapping | Fixed for `sanitation1journal -> cleaning_ventilation_checklist` | `src/lib/source-journal-map.ts`, `raw/visual-matrix.json` |
| Missing explicit PDF branch | Current PDF generator coverage | Fixed for `audit_plan`, `audit_protocol`, `audit_report`, `metal_impurity`, `hygiene` | `src/lib/document-pdf.ts` |
| Raw list print without helper | Cross-journal list print surface | Partially reduced; helper now used in audit, metal, hygiene, pest, equipment, staff batches | `raw/print-scan-2.txt`, `raw/print-matrix.md` |
| List/detail print divergence | Cross-journal print surface | Code-level divergence closed after removing dead detail-side legacy print handlers | `raw/print-scan-2.txt`, `raw/print-matrix.md` |
| Mutation success path without `response.ok` gate | Touched mutation-heavy clients | Reduced in equipment, hygiene, staff, pest paths; full 35-journal proof still incomplete | `raw/error-handling-scan.txt`, touched client files |
