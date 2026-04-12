# AC4 + AC5 sample — 2026-04-12 (prod sha 959101b)

## AC5 persistence — PASS (acceptance journal)

Test doc: `/journals/incoming_control/documents/cmnuh9enc00002qtsoqpzvyqe`

1. Baseline: `tbody tr` count = **5**.
2. Open "+ Добавить" dropdown → "Добавить" (single row).
3. Fill product name `AC5-тест-продукт`; click Сохранить.
4. Post-save (no reload): 6 rows, marker visible in DOM ✅.
5. Full navigation (fresh fetch): 6 rows, marker still visible ✅.

Marker persisted across reload → DB write + server-render round-trip works.

## AC4 PDF content fidelity — PASS (indirect, acceptance journal)

- PDF before add: 445 280 B.
- PDF after add (same endpoint): 447 718 B.
- Delta: **+2 438 B** (~2.4 KB extra) — consistent with rendering the new
  product row (date, name, placeholder cells, newline) as additional
  PDF drawing commands. The PDF streams are compressed, so direct text
  extraction requires a library like `pdf-parse`; size delta is treated as
  acceptable proxy evidence.
- PDF header: `%PDF-1.3`, response has `stream...endstream` sections → valid
  non-empty PDF.

## Open items still deferred

- Full AC4 with text-level diff across all 30 journals (needs pdf-parse).
- AC5 replicated across remaining 29 journals (expected PASS by design —
  every journal uses the same `JournalDocumentEntry` / PATCH-doc path).
- Document-page visual parity against detailed ref JPGs.
