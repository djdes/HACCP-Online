# PDF parity batch

## Scope
- full journal PDF generator audit against hygiene-style expectations
- focus on title/header presence, visible table body, and print route consistency

## Print route scan
- `?print=1` references in journal UI: none
- `window.print()` references in journal UI: none
- active print flow stays on `/api/journal-documents/{id}/pdf`

## Fixed systemic PDF defects
- `drawClimatePdf`
  - now injects blank printable rows when measurement entries are empty
- `drawAuditReportPdf`
  - removed false fallback based on `.map(...) || ...`
  - now renders blank printable finding rows when findings are empty
- `drawMetalImpurityPdf`
  - removed false fallback based on `.map(...) || ...`
  - now renders blank printable rows when config rows are empty
- `drawTraceabilityPdf`
  - now keeps multiple blank printable rows instead of a single collapsed row
- `drawEquipmentCleaningPdf`
  - now keeps multiple blank printable rows instead of a single collapsed row
- `drawSanitationDayPdf`
  - now renders an explicit empty plan/fact pair before the responsible row when the schedule is empty
- `drawGlassControlPdf`
  - now renders multiple blank printable rows when there are no entries
- `drawIntensiveCoolingPdf`
  - now renders multiple blank printable rows when the journal is empty
- `drawMedBookPdf`
  - main and vaccination tables now render several blank printable rows, not a single skeletal row
- `drawProductWriteoffPdf`
  - empty acts now render several blank printable rows
- `drawPerishableRejectionPdf`
  - empty rejection logs now render several blank printable rows
- `drawGlassListPdf`
  - empty lists now render several blank printable rows

## Verification
- `npx eslint src/lib/document-pdf.ts`: PASS with warnings only
- `npx tsc --noEmit`: PASS
- print scan for legacy browser-print paths: clean
