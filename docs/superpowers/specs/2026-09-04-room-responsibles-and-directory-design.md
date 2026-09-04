# Уборщики и проверяющие у помещения + единый справочник помещений

Дата: 2026-09-04. Статус: фазы 1 и 2 реализованы.

## Проблема

У помещения (`Room`, `/settings/buildings`) не было связи с сотрудниками. «Кто убирает зону» задавалось в каждом документе журнала уборки (`config.cleanerByRoomId`, сетка «Закрепить зоны»), «кто проверяет зону» (`config.verifierByRoomId`) не имело UI. Настройку приходилось повторять в каждом документе, под названием помещения не было видно, кто проверяет.

Помещения живут в нескольких справочниках: `Room` (уборка), `Area` (оборудование, сидирование), `config.rooms` климата, `config.rows` графика ген. уборок.

## Решения владельца

1. Нижние строки журнала уборки — «Старший по уборке» / «Контролёр» (как слоты в `/settings/journal-responsibles`).
2. Единственное место закрепления — карточка помещения. Сетка «Закрепить зоны» в документе убрана; старые закрепления переносятся скриптом `scripts/migrate-room-responsibles-from-docs.ts`.
3. Несколько проверяющих: первый — verifier задачи в TasksFlow, все — вечерняя сводка по своим помещениям.
4. Все журналы с помещениями используют общий справочник `Room`; из журнала доступна быстрая настройка (то же окно); недостающие поля (нормы климата) добавляются в карточку помещения.

## Фаза 1 — уборщики и проверяющие (реализовано)

### Данные
- `Room.cleanerUserIds String[]`, `Room.verifierUserIds String[]`. Порядок = приоритет (первый проверяющий уходит в TF). Без join-таблицы: сотрудники архивируются, читатели пересекают массивы с активными пользователями; при hard-delete сотрудника id вычищается (`api/staff/[id]`).
- `config.verifierByRoomId` расширен до `Record<string, string[]>` (legacy string коэрцится в нормализаторе и zod).

### Одна точка слияния
`src/lib/cleaning-room-responsibles.ts` → `applyRoomResponsiblesToConfig(config, rooms, knownUserIds)` возвращает эффективный конфиг: для выбранных комнат с `Room.cleanerUserIds` → `cleanerByRoomId` (DB wins над legacy), пул = raw + новые уборщики (коды С1..СN стабильны), `verifierByRoomId` из `Room.verifierUserIds`. Вызывается после `normalizeCleaningDocumentConfig` в TF-адаптере, cell-override-sync, PDF, cron сводки, валидации PATCH документа и на клиенте (только для отображения; в сохранение уходит raw `config`).

Приоритет уборщиков комнаты: `Room.cleanerUserIds` → legacy `config.cleanerByRoomId` → пул (race / round-robin). Проверяющие: `resolveRoomControllers` — комната → `controlUserId` → `controlResponsibles[0]`.

### UI
- `MultiUserPicker` (`src/components/shared/multi-user-picker.tsx`): чипы выбранных (первый — «основной», стрелка поднимает), inline-панель с поиском и группами «Рекомендуем / Можно / Не рекомендуем» (`src/lib/room-responsible-candidates.ts`), подсказка нагрузки «убирает N помещений».
- Карточка помещения (`RoomEditorDialog`): карточки «Кто убирает» и «Кто проверяет (необязательно)». Используется из `/settings/buildings` и из журнала уборки (десктоп и Mini App).
- `/settings/buildings`: строка помещения показывает «Убирает: …» / «Проверяет: …» или «Уборщики не назначены»; после «Добавить помещение» сразу открывается карточка.
- Журнал уборки: под помещением «Уборка: …» и «Проверяет: …» (последнее только при своих проверяющих), клик → карточка помещения. В «Настроить race-режим» вместо сетки закрепления — сводка по помещениям с кнопкой «Изменить»; пул уборщиков остаётся для помещений без назначенных.

### TasksFlow
- Строка адаптера: `verifierUserId` = первый проверяющий помещения (через резолвер).
- Cron `cleaning-control-digest`: каждому проверяющему — своя сводка по его помещениям. rowKey контролёра документа — `control::{doc}::{date}` (legacy), своих проверяющих — `control::{doc}::{date}::{verifierId}`. Webhook (`applyControlCompletion`) штампует `controllerCompletedAt` только по помещениям этого проверяющего (`controllerScopeRoomIds`).
- Ограничение: смена уборщиков помещения не перераздаёт уже созданные сегодня задачи (rowKey содержит cleanerId).

## Фаза 2 — единый справочник помещений (реализовано)

- 2a. `Room`↔`Area`: переименование `Room` переименовывает зеркальную `Area`; удаление — удаляет `Area`, если к ней не привязано оборудование/записи. Климат и ген. уборки сидируются из `Room`, а не `Area`.
- 2b. Климат: `Room.climateNorms Json?` (`{ temperature: {enabled,min,max}, humidity: {…} }`), `ClimateRoomConfig.roomId`, `buildClimateConfigFromRooms`, имя и нормы из `Room` при наличии `roomId`; ключи `measurements` не меняются; из журнала — пикер из справочника + `RoomEditorDialog` с секцией «Климат»; сопоставление датчиков по `Room.id` / имени.
- 2c. График ген. уборок: `SanitationRoomRow.roomId`, сидирование из `Room`, `RoomEditorDialog` из журнала, ответственный строки = уборщик помещения, шаги TF-формы из `Room.generalScope`.

### Как реализовано (фаза 2)
- `src/lib/room-directory.ts` — один select и форма `DirectoryBuilding/DirectoryRoom` для страниц журналов; `src/components/cleaning/room-editor-initial.ts` — маппер в `RoomEditorInitial`.
- `RoomDirectoryPickerDialog` (`src/components/cleaning/room-directory-picker-dialog.tsx`) — «Добавить помещение из справочника» + «Создать новое» (POST /api/settings/rooms), после создания открывается карточка.
- `RoomEditorDialog`: секция «Климат» (`Room.climateNorms`), prop `focus` ("cleaning" | "climate") — секция «Уборка» сворачивается, когда карточку открыли из журнала климата.
- Климат: `ClimateRoomConfig.roomId`, `buildClimateConfigFromRooms`, `applyRoomDirectoryToClimateConfig` (Room wins по имени/нормам, ключи строк не меняются), «Связать» для legacy-строк (по совпадению имени или из legacy-диалога; нормы строки переносятся в Room, если там пусто), сопоставление датчиков по `Room.id`/имени (`external/dispatch.ts`), `journal-task-pool` по Room, TF-адаптер и PDF — по эффективному конфигу.
- График ген. уборок: `SanitationRoomRow.roomId`, `buildSanitationDayConfigFromRooms` (закрыт баг с демо-строками), под названием — «Убирает / Проверяет» из карточки, TF-адаптер: ответственный = первый уборщик помещения, проверяющий = первый проверяющий, шаги формы — из `Room.generalScope`, день месяца — из `Room.generalMonthDays`.
- `Room`↔`Area`: переименование Room переименовывает зеркальную Area; удаление Room удаляет Area без оборудования/записей. Создание документов климата и графика — из Room (`api/journal-documents/route.ts`, `journal-default-configs.ts`, `journal-responsibles-cascade.ts`).
- Скрипт `scripts/migrate-journal-rooms-to-directory.ts` (dry-run / `--apply` / `--create`) связывает существующие строки по имени.
