# journals-full-audit — блокеры

## BLOCKER-1: sanitary_day_control без выделенного PDF drawer

Код шаблона: `sanitary_day_control` (title «Чек-лист (памятка) проведения санитарного дня»).

UI-клиент: `src/components/journals/sanitary-day-checklist-document-client.tsx` — полноценный чек-лист с зонами и пунктами (config.zones, config.items).

PDF: падает в generic `drawTrackedPdf`, template.fields = [] → PDF только с колонками «Дата / Ответственный», пустой.

### Что нужно сделать

1. Написать `src/lib/sanitary-day-checklist-pdf.ts` с функцией `drawSanitaryDayChecklistPdf(doc, params)`.
2. Прочитать эталонный JPG из `c:/www/Wesetup.ru/journals/Чек-лист (памятка) проведения санитарного дня/` для структуры.
3. Отрисовать шапку (drawJournalHeader / собственная), затем таблицу по зонам с пунктами.
4. Добавить ветку в `generateJournalDocumentPdf` (`document-pdf.ts`) для template.code === SANITARY_DAY_CHECKLIST_TEMPLATE_CODE.
5. Верифицировать через /api/journal-documents/[id]/pdf.

Ориентировочно: 150-200 строк, 30-60 минут.
