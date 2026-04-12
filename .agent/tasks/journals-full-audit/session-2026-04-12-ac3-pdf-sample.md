# AC3 PDF sample — 2026-04-12 (prod sha 179c77b)

Authenticated fetch from browser context against `/api/journal-documents/{id}/pdf`.
All sampled documents return 200 + `application/pdf` + non-empty body.

| Journal | Doc ID | Status | Content-Type | Size |
|---|---|---|---|---|
| Журнал приемки (incoming_control) | cmnuh9enc00002qtsoqpzvyqe | 200 | application/pdf | 445 280 B |
| Журнал уборки (cleaning) | cmnrwehca000bonts2dmtovac | 200 | application/pdf | 484 228 B |
| Холод. оборудование | cmnuolq0700c92wts9r6vynrs | 200 | application/pdf | 473 741 B |
| План обучения (training_plan) | cmnuo2ise0007shtsa62ajlm2 | 200 | application/pdf | 441 252 B |

**AC3 (print opens PDF, correct Content-Type) — PASS for 4 sampled journals.**
Structural: `/api/journal-documents/{id}/pdf` handler wires every template code
through `document-pdf.ts` via `drawXxxPdf` dispatcher, so other templates should
behave identically. Confirmed in code: a 401 without session, 200 with session.

## Not verified this session

- **AC4** PDF content fidelity (shape, headers, rows match UI). Would require
  PDF text extraction and diff vs UI. Not done.
- **AC5** Persistence (add-row → refresh → still there) — verified for
  cold-equipment only.
- Full sweep of all 30+ journals' PDFs.
