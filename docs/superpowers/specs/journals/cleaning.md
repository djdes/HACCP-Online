# Journal `cleaning` — Журнал уборки и дезинфекции

**Tier:** C (ХАССП-рекомендуемый, очень популярный в общепите)
**СанПиН:** не прямо требует журнал, но т. 4.10-4.16 СанПиН 2.3/2.4.3590-20 регулируют уборку
**Status:** **REFERENCE — реализован, см. cleaning-unification spec**

## Назначение

Матрица «помещения × дни» с отметками типа уборки (T = текущая, G =
генеральная, «/» = не проводилась). Фиксация плановых и фактических
уборок per-помещение.

## Колонки

В табличной форме нет привычных колонок — это **матрица**:
- **Строки:** помещения (из `Room` в `/settings/buildings`)
- **Колонки:** дни месяца
- **Ячейки:** T / G / «/» / пусто. После выполнения сотрудником —
  инициалы уборщика (через TasksFlow webhook).

Дополнительно per-помещение:
- Моющие и дезинфицирующие средства
- Шаги текущей уборки (`currentScope: string[]`)
- Шаги генеральной уборки (`generalScope: string[]`)
- Расписание (weekly bitmask или monthly day list)
- Требовать фото (boolean)

## Источник правды (после cleaning-unification 2026-05-08)

`Room` (DB-модель из `/settings/buildings`) — единственный источник
для scope/days/detergent. Per-document config хранит только matrix +
selectedRoomIds + responsiblePairs (legacy).

## Ритм

- **Frequency:** daily (T) + monthly (G) или по weekday-mask
- **Per row:** ОДНО помещение × ОДИН день = одна matrix-ячейка
- **Кто инициирует:** TF auto-fan-out утром, 1 race-задача на каждое
  selectedRoomIds × selectedCleanerUserIds

## Pipeline (TF task)

См. `cleaningAdapter.getTaskForm` в коде. Pipeline собирается ДИНАМИЧЕСКИ:
- Берёт из `Room.currentScope` или `Room.generalScope` зависимо от matrix-значения сегодня (T/G)
- `Room.requirePhoto = true` → photoMode: required на каждом шаге

## Compliance rule

Cleaning — `CONFIG_DAILY_CODES` (matrix-based). Заполнено сегодня = в
matrix хотя бы одна ячейка today имеет значение (relaxed) ИЛИ все
ячейки заполнены (strict) — определяется fillMode.

## Edge cases

- **Override через клик в матрице:** менеджер кликает T→G на ячейке →
  создаётся override-task в TF (`syncCleaningCellOverride`). Не клеймит
  другие ячейки (защита через rowKey-discriminator в TF claim-siblings).
- **Выходные/праздники:** auto-mark «/» если включено в settings.
- **Pairs-mode legacy:** старые документы продолжают работать через
  `responsiblePairs` (1 recurring задача на пару).

## TasksFlow flow

См. cleaning-unification spec (отдельный полный документ). Кратко:
- rooms-mode: rowKey `room::{roomId}::cleaner::{cleanerId}`
- override: rowKey `cell-override::{roomId}::{dateKey}`
- verifier-summary: rowKey `verifier-summary:{documentId}` (контролёр)
- pairs-mode (legacy): rowKey `{pair.id}` (recurring 1 на пару)

## Sources

- [Cleaning unification spec](../2026-05-08-cleaning-unification.md)
- СанПиН 2.3/2.4.3590-20 п. 4.10-4.16
