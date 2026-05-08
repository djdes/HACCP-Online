# Architecture & Anti-Regression Plan

**Date:** 2026-05-08
**Why:** «Делаешь одно — ломается другое». Каждая правка требовала
ручной проверки → регрессии слипались в прод. Цель — структура и
автоматические гарды чтобы такое не повторялось.

## Корневые проблемы (root causes)

| # | Проблема | Симптом | Решение |
|---|----------|---------|---------|
| 1 | Нет gate'а перед прод-пушем | Сломанный код → master → деплой | CI: tsc + tests до build, blocking |
| 2 | God-files (cleaning-document-client 2k+ строк) | Сложно понять surface, изменения трогают неожиданное | Per-feature разбиение, max 500 строк/файл |
| 3 | Множественные источники правды | cleaning имел 11 source-of-truth (до unification) | Один canonical источник per-domain, Zod-схемы блокируют дрейф |
| 4 | Implicit JSON contracts | `JournalDocument.config` — Json без типа, любая ошибка только в runtime | Zod-схемы для всех Json fields, runtime + compile-time |
| 5 | Tests есть, но не запускаются | 127 тестов в репо, нет `npm test` script, не в CI, не в pre-commit | Добавил test scripts + pre-commit + CI gate |
| 6 | Adapter contract не enforced | 35 journal adapters, у каждого свой стиль, никакой проверки полноты | Contract-test: каждый adapter проходит общий battery |
| 7 | Spec ↔ code drift | Только что написали 35 spec'ов, ничего их не enforce'ит | Per-spec contract test проверяет структуру `JournalTemplate.fields` |
| 8 | No structured logging | console.error разбросан, поломки невидимы до жалобы юзера | TODO Phase 2 — Sentry-style observability |

## Layered Architecture (целевая)

```
src/
├── domain/              # Чистая логика, ZERO внешних зависимостей
│   ├── compliance/      # «Заполнен сегодня?» — pure functions
│   ├── cleaning/        # weekday/monthly schedule, matrix logic
│   ├── journal/         # Journal contract types, adapter interface
│   └── ...
├── infrastructure/      # Boundary adapters (DB, TF, email, telegram)
│   ├── prisma/
│   ├── tasksflow/
│   ├── email/
│   └── telegram/
├── application/         # Use-cases (orchestrate domain + infra)
│   ├── bulk-assign/
│   ├── cleaning-cell-override/
│   └── ...
├── interfaces/          # HTTP / RSC / MCP entry points
│   ├── api/             # Next.js route handlers
│   ├── rsc/             # Server components
│   └── mcp/             # MCP server (если будет)
└── ui/                  # React client components, presentation only
    ├── components/
    └── hooks/
```

**Правила слоёв:**
- `domain` → импортирует только `domain` (zero deps)
- `infrastructure` → импортирует `domain`
- `application` → импортирует `domain` и `infrastructure`
- `interfaces` → импортирует всё, но НЕ ИЗ `ui`
- `ui` → импортирует только `domain` types и `application` hooks

Текущая структура (`src/lib`, `src/app`, `src/components`) **не нарушает**
эту модель в принципе, но границы размыты. Переход — постепенный
(Phase 2): новые модули кладём по слоям сразу, старые мигрируем по
мере правок.

## Anti-patterns (НЕ делать)

| ❌ | Почему | ✅ Делать |
|---|---|---|
| Hardcoded magic strings (`"cleaning"`, `"hygiene"`) | rename → ничего не сломается, потому что typo не ловится | Использовать `JOURNAL_CODES` enum/const |
| `as any` в типах | Compile passes, runtime падает | Узкий тип + `assertNever` в exhaustive switch |
| Вычисление в RSC + повторение в client | source-of-truth раздваивается | Вычислить ОДИН раз, передать props |
| Прямой `db.update` вне репозитория | разные места могут писать конфликтные значения | Один `XService` с методами `updateScope`, `updateSchedule` |
| Update of JSON config без zod-parse | пишем мусор, читаем мусор | `cleaningConfigSchema.parse(json)` до записи |
| Test без assertion | проходит даже если функция вообще не вызвана | минимум один `assert.equal` |
| `skip` без TODO-комментария + issue | забываем починить | `t.skip("TODO #123 — описание")` обязательно |

## Контрактные тесты для журналов (key gate)

Каждый journal adapter **обязан** проходить общий battery:

```typescript
// src/domain/journal/adapter-contract.test.ts
for (const adapter of getAllAdapters()) {
  test(`${adapter.code}: meta shape`, () => {
    assert.ok(adapter.meta.templateCode);
    assert.ok(adapter.meta.label);
  });
  test(`${adapter.code}: scheduleForRow returns valid weekDays`, () => {
    const sched = adapter.scheduleForRow(...);
    sched.weekDays.forEach((d) => assert.ok(d >= 0 && d <= 6));
  });
  test(`${adapter.code}: getTaskForm parsing roundtrip`, async () => {
    const form = await adapter.getTaskForm?.({...});
    if (form) assert.ok(form.fields !== undefined || form.pipeline !== undefined);
  });
  test(`${adapter.code}: applyRemoteCompletion is idempotent`, async () => {
    await adapter.applyRemoteCompletion({...});
    await adapter.applyRemoteCompletion({...}); // 2-й раз = no-op
  });
}
```

Если новый adapter не проходит — CI блокирует merge.

## Zod-схемы для config blob'ов

Каждый Json field в Prisma должен иметь Zod-схему, и все
read/write должны идти через неё:

```typescript
// src/domain/cleaning/config-schema.ts
export const cleaningConfigSchema = z.object({
  cleaningMode: z.enum(["pairs", "rooms"]).optional(),
  selectedRoomIds: z.array(z.string()).optional(),
  selectedCleanerUserIds: z.array(z.string()).optional(),
  matrix: z.record(z.string(), z.record(z.string(), z.string())),
  rooms: z.array(cleaningRoomItemSchema).optional(),
  responsiblePairs: z.array(...).optional(),
  // ...
});

export type CleaningConfig = z.infer<typeof cleaningConfigSchema>;

export function parseCleaningConfig(raw: unknown): CleaningConfig {
  return cleaningConfigSchema.parse(raw);
}
```

Без zod-parse — нельзя положить в config, нельзя читать. Pre-commit
hook ловит unsafe-доступ к config.X напрямую.

## CI / pre-commit gates

### Pre-commit (быстро, на staged-файлах)

1. `tsc --noEmit` (~15 сек)
2. `eslint --fix` (~5 сек)
3. `npm test -- changed only` (~3-10 сек на typical change)

### CI gates (до prod-deploy)

В `.github/workflows/deploy.yml`:

1. **Type-check**: `npm run typecheck` — blocking
2. **Tests**: `npm run test:ci` — blocking on NEW failures (легаси baseline)
3. **Build**: `npm run build` — blocking
4. **Smoke prod**: Playwright «открыть login → 200» — non-blocking
5. **Deploy**: только если всё выше прошло

Baseline 13 легаси-fail'ов: трекаем в `tests/.legacy-failures.txt`,
CI считает только diff (новые fail'ы). После того как baseline
будет починен — флипаем gate в strict.

## Phase 1 — что делаю СЕЙЧАС

- [x] `npm test` script (ran 127 tests, 114 pass, 13 legacy fail)
- [ ] Pre-commit: расширить hook чтобы запускать релевантные тесты
- [ ] CI: deploy.yml gate перед build (npm test, non-blocking на legacy)
- [ ] Zod-схема для cleaning config (lock structure)
- [ ] Contract test для journal adapters (3-4 ключевые проверки)
- [ ] Regression-тесты для recent fixes:
  - cell-override sync (T→G не клеймит другие комнаты)
  - claim-siblings rowKey discriminator
  - syncDocument rooms-mode early-return
  - Stage 6 Room.scope ↔ JournalChecklistItem auto-sync
  - Stage 8 cleaningMode default rules

## Phase 2 — отложено (после P1 запушен и проверен)

- [ ] Layered restructure (`src/domain`, `src/infrastructure`, ...)
- [ ] God-file splits (cleaning-document-client → 5-7 focused modules)
- [ ] Branded types (UserId, OrgId, JournalCode)
- [ ] Sentry-style error tracking
- [ ] Snapshot tests для UI-критических компонентов
- [ ] Contract tests для каждого из 35 journal codes (по spec'у)

## Workflow для будущих изменений

1. **Feature**: пишется spec в `docs/superpowers/specs/` (если не тривиально)
2. **Tests first**: regression-тест на конкретный сценарий перед фиксом/фичей
3. **Implementation**: код проходит pre-commit (tsc + tests + lint)
4. **CI**: tests non-degrade, build ok → merge → deploy
5. **Post-deploy smoke**: автомат проверка `/login` 200, ключевые страницы
6. **Post-mortem if regression**: добавить test чтобы не повторилось

«Сломал? — Сначала тест, потом фикс.» Без теста — высока вероятность что
поломка вернётся через 2 недели в новом виде.
