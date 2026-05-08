# Audit per-journal — implementation status vs spec

**Date:** 2026-05-08
**Source:** контракт-тест + ручной просмотр кода + spec'и в этой папке

Цель: показать на одной странице **где каждый журнал стоит** относительно
эталонного pattern'а. Зелёные метки = готово, жёлтые = частично/легаси,
красные = существенный gap.

## Унифицированный pattern (что должен иметь каждый journal)

| Уровень | Артефакт | Где |
|---------|----------|-----|
| Spec | per-journal markdown | `docs/superpowers/specs/journals/<code>.md` |
| Schema | `JournalTemplate` row (code+name+fields) | DB seed |
| Adapter | `JournalAdapter` interface | `src/lib/tasksflow-adapters/<code>.ts` |
| Document client | UI form для журнала | `src/components/journals/<code>-document-client.tsx` |
| getTaskForm | pipeline / fields для TF Mini App | в adapter |
| applyRemoteCompletion | webhook handler | в adapter |
| Tests | unit для critical paths | `src/domain/journal/<code>.test.ts` (Phase 2) |
| Compliance rule | в `today-compliance.ts` | constants + DEEP_INSPECT для сложных |

## Tier A — обязательные СанПиН

| Code | Spec | Adapter | getTaskForm | Tests | Ритм | Comment |
|------|------|---------|-------------|-------|------|---------|
| `hygiene` | ✅ | ✅ specific | ✅ | ⚠️ только generic | daily per-employee | STRICT_COMPLETENESS_CODES |
| `cold_equipment_control` | ✅ | ✅ specific | ✅ | ⚠️ только integration | daily per-equipment | DEEP_INSPECT_CODES (temperatures{}) |
| `climate_control` | ✅ | ✅ specific | ✅ | ⚠️ только integration | daily per-room×slot | DEEP_INSPECT (measurements{}) |
| `fryer_oil` | ✅ | generic | — | — | event-driven | при наличии фритюра, generic OK |

## Tier B — соц.учр.

| Code | Spec | Adapter | getTaskForm | Tests | Ритм |
|------|------|---------|-------------|-------|------|
| `finished_product` | ✅ | ✅ specific | ✅ | — | event-driven |
| `perishable_rejection` | ✅ | ✅ specific | ✅ | — | event-driven |

## Tier C — ХАССП-рекомендуемые

### Уборка / гигиена

| Code | Spec | Adapter | getTaskForm | Tests | Status |
|------|------|---------|-------------|-------|--------|
| `cleaning` | ✅ unified | ✅ specific | ✅ T/G по матрице | ✅ schedule + config | UNIFIED 2026-05-08, основной reference |
| `general_cleaning` | ✅ | generic | — | — | можно слить с cleaning через monthly schedule |
| `cleaning_ventilation_checklist` | ✅ | ✅ specific | ⚠️ есть | — | DEEP_INSPECT (procedures{}) |
| `sanitary_day_control` | ✅ | ✅ specific | ❌ **нет** | — | **gap: getTaskForm missing** |
| `equipment_cleaning` | ✅ | ✅ specific | ✅ | — | daily per-equipment |
| `disinfectant_usage` | ✅ | ✅ specific | ✅ | — | event-driven |
| `pest_control` | ✅ | ✅ specific | ✅ | — | monthly |
| `uv_lamp_runtime` | ✅ | ✅ specific | ✅ | — | event-driven |

### Персонал

| Code | Spec | Adapter | getTaskForm | Tests | Status |
|------|------|---------|-------------|-------|--------|
| `health_check` | ✅ | ✅ specific | ✅ | — | per-employee daily |
| `med_books` | ✅ | generic | — | — | per-employee yearly |
| `staff_training` | ✅ | ✅ specific | ✅ | — | event-driven |
| `training_plan` | ✅ | ✅ specific | ✅ | — | yearly plan |
| `ppe_issuance` | ✅ | ✅ specific | ✅ | — | event-driven |

### Оборудование

| Code | Spec | Adapter | getTaskForm | Tests | Status |
|------|------|---------|-------------|-------|--------|
| `equipment_maintenance` | ✅ | ✅ specific | ❌ **нет** | — | **gap: getTaskForm missing** |
| `equipment_calibration` | ✅ | ✅ specific | ✅ | — | event-driven |
| `breakdown_history` | ✅ | ✅ specific | ✅ | — | event-driven |

### Производство и качество

| Code | Spec | Adapter | getTaskForm | Tests | Status |
|------|------|---------|-------------|-------|--------|
| `incoming_control` | ✅ | acceptance.ts | ✅ | — | event-driven (ветка acceptance) |
| `incoming_raw_materials_control` | ✅ | acceptance-raw.ts | ✅ | — | event-driven (расширенная) |
| `intensive_cooling` | ✅ | ✅ specific | ✅ | — | event-driven, rolling |
| `metal_impurity` | ✅ | ✅ specific | ✅ | — | daily per-смена |
| `glass_items_list` | ✅ | ✅ specific | ✅ | — | event-driven (реестр) |
| `glass_control` | ✅ | ✅ specific | ✅ | — | weekly |
| `traceability_test` | ✅ | ✅ specific | ✅ | — | auto-aggregate |

### Происшествия

| Code | Spec | Adapter | getTaskForm | Tests | Status |
|------|------|---------|-------------|-------|--------|
| `complaint_register` | ✅ | ✅ specific | ✅ | — | event-driven |
| `accident_journal` | ✅ | ✅ specific | ✅ | — | event-driven |
| `product_writeoff` | ✅ | ✅ specific | ✅ | — | event-driven |

### Аудит

| Code | Spec | Adapter | getTaskForm | Tests | Status |
|------|------|---------|-------------|-------|--------|
| `audit_plan` | ✅ | ✅ specific | ✅ | — | yearly plan |
| `audit_protocol` | ✅ | ✅ specific | ✅ | — | event-driven |
| `audit_report` | ✅ | ✅ specific | ✅ | — | event-driven |

## Identified gaps (priority order)

### P1 — критичные

1. **getTaskForm missing for `sanitation_day_control` и `equipment_maintenance`** — сотрудник в TF Mini App видит «форма не требует заполнения». Большой ХАССП-журнал (санитарный день — куча шагов) без чек-листа.
2. **`fryer_oil` использует generic adapter** — а это Tier A (СанПиН-обязательный). Нужен specific с правильной формой замены (% окисления, marka, объём).
3. **`med_books` тоже generic** — а должен быть per-employee с просрочками-reminders.
4. **`general_cleaning` — generic** — может быть слит с `cleaning` через monthly-schedule (Stage 8 cleaning-unification).

### P2 — желательные

5. **Per-journal regression tests** — у каждого journal должен быть test файл вида `<code>.test.ts` с минимум 3 кейсами:
   - empty config defaults
   - happy path completion
   - edge case (отклонение, validation)
6. **DEEP_INSPECT_CODES расширить** — сейчас только cleaning, climate, cold_equipment имеют точный rollup. Остальные считают «1 запись = filled» что слишком relaxed для multi-row журналов.
7. **TasksFlow Mini App rendering**: убедиться что pipeline-шаги корректно отображаются для каждого журнала (особенно те где много полей в шаге — climate, finished_product, intensive_cooling).

### P3 — оптимизация

8. **Generic adapter уменьшить scope** — для journals которые покрыты specific'ами, generic не нужен (в `index.ts` уже есть SPECIFIC_BY_CODE.has check).
9. **Spec ↔ adapter cross-validation test** — отдельный тест: для каждого spec-файла найти соответствующий adapter и убедиться что meta.label соответствует названию из spec'а.

## Phase плана

**Phase 1 (закрыт)** — anti-regression фундамент:
- npm test, baseline gate, pre-commit + CI gate
- Zod-схема для cleaning config
- Regression-тесты для recent fixes
- См. `4ee82748`

**Phase 2 (текущий, наполовину)** — unified per-journal pattern:
- ✅ Adapter contract test (этот audit)
- ✅ Все 33 spec'а написаны
- 🔜 Закрыть P1 gaps:
  1. Добавить getTaskForm в sanitation_day_control + equipment_maintenance
  2. Заменить generic на specific для fryer_oil + med_books
  3. Слить general_cleaning в cleaning через monthly-toggle (или оставить как отдельный — решает юзер)
- 🔜 Per-journal regression tests (минимум по 3 теста на каждый Tier A)

**Phase 3 (планирование)** — observability + полировка:
- Sentry-style error tracking
- Snapshot tests для критичных UI-компонентов
- Layered restructure (`src/domain/*` для всех модулей)
- Branded types (UserId, OrgId, JournalCode)

## Workflow ad-hoc → systematic

**Раньше:** «у журнала X баг → правлю код → ломается журнал Y»

**Теперь:**
1. Открыть `docs/superpowers/specs/journals/<code>.md` — что должно быть
2. Сверить с реальностью (audit row выше)
3. Найти gap → spec правится ИЛИ код правится (одно из двух)
4. Тест на конкретный сценарий ПЕРЕД фиксом
5. Pre-commit + CI блокирует регрессию
6. Deploy с уверенностью

## How to use this audit

Каждый раз когда трогаем cleaning/hygiene/любой журнал — открыть этот
файл, проверить status, обновить если нашли gap. Файл — living document.
Update'ы commit'ятся вместе с code-изменениями.
