# locations-2026-09 — evidence (2026-09-05)

Дизайн: `docs/superpowers/specs/2026-09-05-locations-design.md`. Спека и AC: `spec.md`.

## Команды

| Проверка | Результат |
| --- | --- |
| `npx prisma validate` + `npx prisma db push` (локальная БД) | схема валидна, «Your database is now in sync», предупреждений о потере данных нет |
| `npm run typecheck` | чисто |
| `npm test` | 570 тестов, 0 падений (в т.ч. новые `building-scope.test.ts`, обновлённые `journal-obligations.test.ts`, `journal-auto-create-broken-chains.test.ts`) |
| `npx eslint <изменённые файлы>` | 0 ошибок, 24 предупреждения (существовавшие правила `no-unused-vars` / `set-state-in-effect` в соседнем коде) |
| e2e `e2e/verify.ts` + `e2e/mini-check.ts` (dev 3020, Chrome) | см. ниже, `e2e/results.json`, `shots/` |

## e2e (организация «Кафе «Тестовое 1»», две точки «E2E Точка А» (ул. Ленина, 5) и «E2E Точка Б», флаг включён сидом)

| AC | Шаг | Результат |
| --- | --- | --- |
| AC3 | пилюля в шапке `/journals/hygiene` | «E2E Точка А» (`shots/01-header-pill.png`) |
| AC3 | меню точек | «E2E Точка А · ул. Ленина, 5», «E2E Точка Б» (`shots/02-location-menu.png`) |
| AC3, AC2 | клик «E2E Точка Б» | cookie `wesetup.building = <orgId>:<buildingB>`, пилюля «E2E Точка Б» |
| AC4 | `GET /api/journal-documents?templateCode=hygiene` на точке Б | только «E2E точка Б» (+ общие документы без точки), «E2E точка А» скрыт; страница показывает Б и не показывает А (`shots/03-list-at-B.png`) |
| AC4 | `POST /api/me/active-building` → А | 200, список — «E2E точка А» |
| AC4 | шапка документа | «Кафе «Тестовое 1» · E2E Точка А, ул. Ленина, 5» (`shots/04-document-header.png`) |
| AC12 | `POST /api/me/active-building {buildingId:"nope"}` | 403 |
| AC7 | `/settings/buildings` | заголовок «Точки и помещения», тумблер «Вести журналы отдельно по точкам» виден и включён (`shots/05-settings-buildings.png`) |
| AC10 | `/api/mini/home` | `location.canSwitch = true`, две точки, активная = А |
| AC10 | `/mini/me` | блок «Точка» с обеими точками, переключение ставит cookie (`shots/06-mini-me.png`); на главной Mini App чип точки (`shots/08-mini-home-chip.png`) |
| AC8, AC2 | `PUT /api/users/<id> {buildingIds:[B]}` | 200; `location` — одна точка Б, `canSwitch=false`; переключение на А → 403; список документов — только Б; пилюли в шапке нет (`shots/07-restricted-no-pill.png`); сброс `buildingIds:[]` → 200 |

Юнит-тестами покрыты: cookie/область точки (`building-scope.test.ts`, 7 тестов), восстановление цепочек по точкам (`journal-auto-create-broken-chains.test.ts` — старые сценарии с `[null]`), обязательства с новым депом `getBuildingTargets` (ключи без точки не изменились).

Не проверено вручную (покрыто логикой/типами): рассылка TasksFlow по каждому документу дня (интеграция на dev не подключена), анкета регистрации с «Точек» ≥ 2 (функция `ensureLocationBuildings` идемпотентна, вызывается из `complete/route.ts`).

## Ограничения v1 (в спеке)

Уникальные ключи `JournalCloseEvent`/`JournalPreview` не менялись (деплой через `prisma db push` без флагов); поле-ориентированные журналы не делятся по точкам; режима «Все точки» нет.

## Деплой

- `ded6fc8b` фича, `094473e1` SHA заметок, `1b697534` фикс относительного Location в `/api/me/active-building/go` (за nginx `request.url` = localhost).
- Прод после `094473e1`: `.build-sha` совпадает, PM2 online (перезапуск 2026-09-05T10:21:17Z), `/` → 200, `POST /api/me/active-building` без сессии → 401, `GET /api/me/active-building/go` → 307, `/settings/buildings` без сессии → 307 на вход.

## Круг 2 (2026-09-05, после дыма)

Сделано: пилюля точки в мобильной шапке и ссылка «Настроить точки» в меню; «Разделы» в меню-шторке; точка запоминается в аккаунте (`User.lastActiveBuildingId`); название и адрес точки правятся в карточке; «Скопировать помещения из…» (`POST /api/settings/buildings/[id]/copy-rooms`); подтверждение выключения режима; консультант «просмотр» видит точки без кнопок изменения; новый сотрудник по умолчанию привязан к активной точке; баннер «N сотрудников без точки»; чипы точек сворачиваются при 5+ точках и стали компактнее (диалог добавления 627/780 px вместо 664); заметка «Точек: N» на странице автосоздания; точка в верхней панели Mini App; «Общий» у документов без точки в меню крошек; точка в подсказке поиска.

`e2e/verify2.ts` (dev 3020): все 16 проверок прошли — `e2e/verify2-results.json`, снимки `smoke/r2-*.png`. `npm run typecheck`, `npm test` (570) — зелёные.

Деплой второго круга: `80d3aa82` (фича), `13a3add3` (SHA заметок), `95bfddc4` и `aadca4ec` (точка на телефоне — отдельной строкой под шапкой). Прод после `aadca4ec`: пилюля точки 137 px с полным названием (`e2e/prod-mobile-check.ts`), «Настроить точки» в меню, точка в панели Mini App; тестовые точки удалены, флаг тестовой организации возвращён.
