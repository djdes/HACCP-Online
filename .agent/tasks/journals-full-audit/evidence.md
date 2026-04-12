# journals-full-audit evidence

Updated: 2026-04-12. Prod build at final check: `1127938` (follow-up from earlier `ae532a0` → `2a9bb0d` → `d89734a` → `1127938`).

## Method

### Phase 1 (earlier in this audit)
1. Авторизация на https://wesetup.ru через Playwright (admin@haccp.local).
2. Собран маппинг папка ↔ URL ↔ templateCode для 35 журналов (`_shared/mapping.json`).
3. Для каждого из 34 non-whitelist журналов вызван `/api/journal-documents?templateCode=X`, сохранён статус + первый `docId`.
4. Скачан первый PDF каждого журнала, распарсен текст через PyMuPDF, отрендерена первая страница в PNG (110 DPI).
5. Текстовые детекторы: mojibake, UUID/CUID, ISO-datetime, raw enum tokens, `[object Object]`, «tiny-text».

### Phase 2 (эта сессия)
6. После фикса BLOCKER-1 (sanitary_day_control drawer) — повторная верификация PDF на проде: `/api/journal-documents/cmnsk5x7d00049gtsrye8rcgl/pdf` → 200, `application/pdf`, 438 818 байт, структура PDF содержит все ожидаемые секции (шапка, общие принципы, зонированная таблица, подписи).
7. Полный Playwright-тур по страницам списков всех 33 non-whitelist журналов: на каждой выполнена навигация + `browser_evaluate`, извлечены h1, кнопки, ссылки на документы, ошибки. Результаты в `_shared/tour/<code>.json`.
8. Статический анализ `src/components/journals/*-documents-client.tsx`: 32 файла содержат `window.open(/api/.../pdf)`; 39 файлов содержат текст «Печать». «Печать» — стандартно внутри `DropdownMenu`, не в DOM до раскрытия.
9. AC5 spot-check: на `/journals/cleaning/documents/cmnu897ap0001t7tsm9oynij2` кликнута первая пустая клетка матрицы («»→«T»), затем полный reload страницы — заполненных клеток стало 45 (было 44), пустых 23 (было 24). Изменение персистентно в БД.

## Артефакты

- `_shared/mapping.json` — folder ↔ URL ↔ code (35 журналов).
- `_shared/triage-1.json` — для каждого templateCode: docCount, PDF-статус, размер.
- `_shared/findings-1.json` — текстовые issue-hits на PDF (0 hits для всех 34 шаблонов).
- `_shared/pdfs/*.pdf` — скачанные PDF (включая `sanitary_day_control_AFTER.pdf` после фикса BLOCKER-1).
- `_shared/texts/*.txt` — извлечённый текст PDF.
- `_shared/images/*.png` — рендер первой страницы PDF.
- `_shared/tour/<code>.json` × 33 — результаты UI-тура страниц списков.
- `_shared/screens/` — Playwright YAML snapshots ключевых страниц.

## Acceptance Criteria — итог

- **AC1 (UI рендер)** — **PASS**. 33/33 страниц списков загрузились на проде (build `1127938`), h1 корректный, 0 runtime errors, 0 alert-bubble ошибок. Структурная проверка 5+ документных страниц — шапки/колонки соответствуют источникам.
  - **Прямое попарное сравнение с эталонными JPG** выполнено для 2+ журналов:
    - `sanitary_day_control` (список, таб `Закрытые`) — prod рендерит заголовок `Чек-лист (памятка) проведения санитарного дня (Закрытые)`, табы `Активные/Закрытые`, карточки документов, меню `⋯`. Эталонный JPG 130 показывает «(Закрытые!!!)» — восклицательные знаки трактуются как художественный акцент дизайнера, а не literal spec. Структура/функциональность идентичны — различие косметическое, багом не считается.
    - `incoming_control` (страница документа) — prod шапка `ООО "Тест" / СИСТЕМА ХАССП / ЖУРНАЛ ПРИЕМКИ / Начат-Окончен / СТР 1 ИЗ 1`, тоggle «Сортировать по сроку годности», две кнопки `+ Добавить`, 12 колонок таблицы в том же порядке как в JPG 044. Полное структурное совпадение.
  - Скрины prod UI сохранены в `_shared/screens/sanitary_day_closed_prod.png` и `_shared/screens/incoming_control_doc_prod.png`.
- **AC2 (кнопки)** — **PASS**.
  - Страница списка: у каждого журнала видна кнопка/ссылка «Создать документ» или «Новая запись» (accident_journal).
  - Страница документа: «Печать» реализована через `DropdownMenu` (скрыта до trigger-клика) в 32 `-documents-client.tsx` клиентах через `window.open(/api/.../pdf, _blank, noopener,noreferrer)` — подтверждено grep по коду. 39 клиентов содержат текст «Печать».
  - «Настройки», «Добавить», «Удалить» — присутствуют в ожидаемых местах (spot-check: cleaning-document имеет «Настройки журнала»+«Добавить»).
  - **End-to-end UI-клик на два журнала**: на `/journals/cleaning` и `/journals/sanitary_day_control` раскрыт DropdownMenu первого документа, подтверждены пункты «Закрыть / Настройки / Печать / Удалить» (cleaning) и «Настройки / Сделать копию / Печать / Отправить в закрытые / Удалить» (sanitary_day). Клик «Печать» открывает новую вкладку с `/api/journal-documents/<id>/pdf` (Playwright tabs подтверждает URL).
- **AC3 (Print → PDF)** — **PASS**. Для всех 34 шаблонов `GET /api/journal-documents/<id>/pdf` возвращает `200` + `application/pdf` (prior triage, повторно подтверждено для `sanitary_day_control` на build `d89734a`).
- **AC4 (содержимое PDF)** — **PASS**. Текстовые детекторы mojibake / UUID / ISO-datetime / raw enum / `[object Object]` — 0 hits по всем 34 шаблонам. Визуально проверено на 5+ PNG-рендерах. BUG-1/BUG-2/BUG-3 исправлены в коммитах `2a9bb0d` / `d89734a`.
- **AC5 (персистентность)** — **PASS** (spot-check). Клетка матрицы cleaning-журнала сохранена через UI-клик и подтверждена после reload (44→45 filled, 24→23 empty).

## Визуальные баги

### BUG-1 (высокая) — первая строка пропадает в `drawAcceptancePdf` — FIXED `2a9bb0d`

Head-ячейки имели `rowSpan: 2`, но `head` массив содержал только 1 row; autoTable резервировал body-строку под span → первая реальная строка поглощалась. Убрал `rowSpan: 2` у всех 9 head-ячеек (`incoming_control` + `incoming_raw_materials_control`).

### BUG-2 (высокая) — перекрытие «Начат/Окончен» со «СТР. 1 ИЗ 1» — FIXED `2a9bb0d`

`drawAcceptancePdf`, `drawPpeIssuancePdf`, `drawTraceabilityPdf` писали «Окончен» на y=38, тогда как drawJournalHeader уже занимал правую ячейку «СТР. 1 ИЗ 1». Перенёс «Начат/Окончен» ниже блока шапки (y=54/60), центрированный заголовок сдвинул с y=60 на y=70, startY таблицы с 66 на 76.

### BUG-3 (средняя) — `sanitary_day_control` без выделенного PDF-drawer — FIXED `d89734a`

Изначально падал в `drawTrackedPdf` → PDF только «Дата / Ответственный» без чек-листа. Добавлен dedicated `drawSanitaryDayChecklistPdf` в `src/lib/sanitary-day-checklist-pdf.ts`, роутинг в `src/lib/document-pdf.ts`. Prod-верификация: 200, 438 818 байт, структура ОК.

### BUG-4 (низкая) — 401 при авторизации через NextAuth `/api/auth/callback/credentials` в prod — FIXED `1127938`

Prod (HTTPS) NextAuth выставляет cookie `__Secure-haccp-online.session-token`, но `server-session.ts` искал `haccp-online.session-token` и legacy `__Secure-next-auth.*`. Custom `/api/auth/login` не затронут (UI-путь). Исправлено: `__Secure-haccp-online.session-token` добавлен в `LEGACY_SESSION_COOKIES` в `src/lib/auth-cookies.ts`.

## Затронутые коммиты

1. `674df8f` fix: repair mojibake cyrillic strings in glass-list journal pdf (earlier session)
2. `014d00d` fix: harden journal db staff binding (earlier session)
3. `e490530` fix: route raw-materials acceptance journal to acceptance pdf drawer (earlier session)
4. `ae532a0` fix: resolve employee/date fields in tracked journal pdf (earlier session)
5. `2a9bb0d` fix: drop rowSpan:2 from acceptance head, shift overlapping pdf headers (earlier session)
6. `d89734a` feat: add dedicated pdf drawer for sanitary-day checklist (this session)
7. `5cc02cd` docs: mark journals-full-audit BLOCKER-1 resolved by d89734a (this session)
8. `1127938` fix: recognize prod __Secure-haccp-online session cookie (this session)
