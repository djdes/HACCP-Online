# Бумажные журналы: модалка создания, страница документа, чистый бланк

Заморожено: 2026-09-03. Источник: `c:\www\Temp\https-wesetup-ru-settings-journals-paper-serialized-sketch.md` (решения владельца от 2026-09-02).

## Цель

`/settings/journals/paper/[id]` ведётся как электронный журнал: список документов → модалка (название, период, ответственный, проверяющий) → отдельная страница документа. Корень страницы — быстрый черновик «вбил — скачал — распечатал» с пустым бланком и кнопкой «Подставить сотрудников».

## Критерии приёмки

- **AC1.** `PaperJournalDocument` получает `dateFrom`, `dateTo`, `responsibleUserId`, `verifier`, `verifierUserId` (все nullable, без FK); `prisma generate` проходит.
- **AC2.** `src/lib/paper-journal-columns.ts` экспортирует `isSubjectColumn`, `isResponsibleColumn`, `isVerifierColumn`, `isDateColumn`, `isPositionColumn`, `hasResponsibleColumn`, `hasVerifierColumn`, `personFieldLabels`, `fillRowForStaff`; `isVerifierColumn` проверяется до `isSubjectColumn`, «ФИО проверяющего» в `electrical_safety` не считается колонкой работника.
- **AC3.** Модалка `create-paper-document-dialog.tsx`: название (автоподстановка через `buildJournalDocumentTitle`, пересчёт до ручной правки), даты начала/окончания (дефолт — текущий месяц), ответственный через `PositionEmployeePicker variant="floating"`, проверяющий — только при `hasVerifierColumn`; без активных сотрудников — подсказка со ссылкой на `/settings/users`, создать можно; сабмит → POST → `router.push` на страницу документа.
- **AC4.** Список документов: «Новый документ» открывает модалку; строка документа — ссылка на `/settings/journals/paper/<id>/documents/<docId>`; в подстроке период (`formatJournalPeriodLabel`) и ответственный; табы, закрытие, удаление без изменений.
- **AC5.** Страница списка: `paper-journal-workspace.tsx` удалён; интро вынесено в `paper-journal-intro.tsx`; порядок крошки → интро → список → черновик `PaperJournalEditor mode="draft"` с пустыми строками, кнопкой «Подставить сотрудников», «Пустой бланк», «Скачать и распечатать» и честной подписью «Черновик не сохраняется…».
- **AC6.** Страница `documents/[docId]/page.tsx`: доступ (`requireAuth` + `hasFullWorkspaceAccess`), `notFound` для чужой организации/чужого журнала; крошки, локальная шапка (название, период, ответственный/проверяющий, бейдж «Закрыт»), `PaperJournalEditor mode="document"` с `readOnly` для закрытого.
- **AC7.** Редактор: хелперы из `paper-journal-columns`; пропсы `mode`, `verifier`, `period`; в `document`-режиме с пустыми строками подставляет сотрудников, ответственного, проверяющего и дату начала периода; автосейв 500 мс только в `document`; «Начат / Окончен» из периода; `<select>` «Кто проводит инструктаж» убран; подпись внизу зависит от `mode`.
- **AC8.** API: `POST documents` принимает `title`, `dateFrom`, `dateTo`, `responsible`, `responsibleUserId`, `verifier`, `verifierUserId`, фолбэк названия через `buildJournalDocumentTitle`; `GET documents` отдаёт `dateFrom`, `dateTo`, `responsible`; `PUT [docId]` принимает `verifier`.
- **AC9.** PDF: необязательный `period`, печатается строкой «Период: …» под названием; `POST /pdf` пробрасывает `dateFrom`/`dateTo`; черновик и публичный семпл не меняются.
- **AC10.** Демо-организация проставляет `dateFrom`/`dateTo` (месяц `todayKey`) и `verifier` где есть колонка; `paperJournalTitle` удалён в пользу `buildJournalDocumentTitle`. `whats-new-notes.ts`: пункт в «Журналы», `LATEST_NOTES_BUILD_SHA` — отдельным коммитом на sha коммита фичи.
- **AC11.** `npx tsc --noEmit --skipLibCheck` (src) и `npx eslint` по изменённым файлам — чисто; `npm test` зелёный.

## Ограничения

- Режим «Изменить» для готового документа не делаем; ответственный в готовом документе правится в ячейках.
- `journal-automation-staff.ts` не используем: «Подставить сотрудников» = все активные сотрудники организации.
