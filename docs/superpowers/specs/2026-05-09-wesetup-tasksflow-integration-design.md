# Wesetup ↔ TasksFlow integration design

**Дата:** 2026-05-09
**Статус:** утверждённая спецификация
**Автор:** brainstorming-сессия с владельцем проекта
**Основание:** жалоба «race-mode siblings не убираются у других уборщиков», расширенная до полного аудита архитектуры.

## Цель

Зафиксировать единую архитектуру взаимодействия двух независимых проектов
(`Wesetup` и `TasksFlow`), чтобы:

1. Закрыть текущий bug «после закрытия одной задачи в TF, sibling-задачи у других уборщиков не помечаются как выполненные».
2. Устранить системную причину дрейфа данных между проектами.
3. Записать архитектурные принципы в `CLAUDE.md`, чтобы любая будущая
   правка (моя или владельца) велась по одной модели.

## Принципы (короткий список — для CLAUDE.md)

| # | Принцип |
|---|---------|
| П-1 | TasksFlow — независимый standalone-сервис. Wesetup — клиент его API. |
| П-2 | Race-siblings cleanup — auto-claim (помечаем «сделано другим»), не delete. |
| П-3 | Wesetup web (`wesetup.ru`) и Mini App (`@wesetupbot`) — full mirror, один функционал. |
| П-4 | Права в Wesetup — централизованные, настраиваются админом организации. |
| П-5 | TasksFlow имеет свои отдельные права, Wesetup в них не лезет. |
| П-6 | Один человек = два аккаунта (Wesetup + TF), связанных через `TasksFlowUserLink`. |
| П-7 | Вход в TasksFlow — только по номеру телефона (SMS/Telegram), без пароля. |
| П-8 | Связка аккаунтов — авто по номеру телефона. Ручная привязка как fallback. |
| П-9 | Sync TF → Wesetup — гибрид: webhook (быстрый) + polling раз в 10 мин (страховочный). |
| П-10 | Источник правды: TF владеет статусами задач, Wesetup владеет содержимым журналов. |
| П-11 | Единая дизайн-система в обоих проектах (палитра, токены, компоненты). |
| П-12 | Связь только через TF REST API. Никаких cross-imports, никаких прямых запросов в чужую БД. |
| П-13 | Создание задач — гибрид: cron в Wesetup в 00:01 + ручной override в UI. |
| П-14 | Verify-flow — гибрид: заведующая может подтвердить и в TF, и в Wesetup. Дедуп через `verifiedAt`. |
| П-15 | Failure mode — graceful degradation: outbox + idempotency-keys. Никто никого не блокирует. |
| П-16 | Cleanup старых задач — Wesetup управляет: cron 03:00 удаляет TF tasks старше 30 дней. |
| П-17 | Audit log — раздельный. Wesetup объединяет в отчётах через TF API в момент рендера. |
| П-18 | Multi-org isolation: Wesetup organization ↔ TF company связаны 1:1 через `tasksflowCompanyId`. |
| П-19 | Idempotency-Key (UUID-v7) на каждой команде Wesetup→TF. Защита от дубликатов и race-conditions. |

## Архитектурный обзор

```
┌─────────────────────────┐         API-only         ┌──────────────────────────┐
│    Wesetup (HACCP)       │ ◄──────────────────────► │  TasksFlow (task engine) │
│                          │   webhook + REST          │                          │
│  Postgres + Prisma       │                           │  MySQL + Drizzle          │
│                          │                           │                          │
│  • Журналы               │                           │  • Задачи                │
│  • Документы (matrix)    │                           │  • Workflow              │
│  • Compliance-отчёты     │                           │   (open→done→verified)   │
│  • Multi-tenant orgs     │                           │  • Multi-tenant companies│
│                          │                           │                          │
│  Frontends:              │                           │  Frontends:              │
│   - wesetup.ru (web)     │                           │   - tasksflow.ru (web)   │
│   - @wesetupbot Mini App │                           │   - native app (планы)   │
└─────────────────────────┘                           └──────────────────────────┘
```

### Кто куда ходит

| Роль | Основное место | Дополнительное |
|---|---|---|
| **Worker** (повар, уборщица) | TasksFlow web | — |
| **Manager** (заведующая) | Wesetup web | Wesetup Mini App, опционально TF для verify |
| **Owner** (владелец) | Wesetup web | Wesetup Mini App |

Worker в Wesetup технически может зайти, но `permissionPreset = "cook"`
ограничивает практически всё — ему там делать нечего.

## Идентификация (П-6, П-7, П-8)

```
              ┌─────────────────────────────────────────┐
              │  Иван Петров, +7 999 123 45 67          │
              ├─────────────────────────────────────────┤
              │  ┌─────────────────────┐  ┌─────────┐  │
              │  │ Wesetup User        │  │ TF User │  │
              │  │ id: usr_abc         │  │ id: 42  │  │
              │  │ phone: +7999...     │  │ phone:  │  │
              │  │ role: cook          │  │ +7999...│  │
              │  │ permissions: {...}  │  │         │  │
              │  └──────────┬──────────┘  └─────┬───┘  │
              │             │                   │      │
              │   TasksFlowUserLink (Wesetup БД) │      │
              │   wesetupUserId ↔ tasksflowUserId│      │
              └─────────────────────────────────────────┘
```

**Auto-link flow:**

1. Управляющая создаёт сотрудника в Wesetup, обязательно вводит номер.
2. Wesetup вызывает `GET /api/users?phone=+7999...` в TF.
3. Найден TF user — `INSERT TasksFlowUserLink (wesetupUserId, tasksflowUserId)`.
4. Не найден — Wesetup предлагает кнопку «Отправить приглашение в TF».
5. Сотрудник принимает инвайт в TF → регистрируется по своему номеру → cron Wesetup'а раз в час повторяет lookup и доустанавливает связь.

**Старые аккаунты без номера**: управляющая в любой момент добавляет
номер в карточку сотрудника, авто-lookup срабатывает заново.

## Источник правды (П-10)

| Что | Главный | Отражает |
|---|---|---|
| Статус задачи (open/in_progress/done/verified/claimed_by_other) | TasksFlow | Wesetup в `TasksFlowTaskLink.remoteStatus` |
| Содержимое журнала (T/G/«/», коды С1/С2, фото) | Wesetup | TF не знает |
| Связка task ↔ ячейка журнала | Wesetup | таблица `TasksFlowTaskLink` |
| `completedAt` | TF | Wesetup пишет в `JournalDocumentEntry.completedAt` |
| `verifiedAt` | First write wins (см. П-14) | обе системы |

## Sync (П-9, П-15, П-19)

### TF → Wesetup (inbound)

```
Worker нажал «Готово» в TF, task 100
       │
       ▼
TF status=done
       │
       ├──► (быстрый) POST https://wesetup.ru/api/integrations/tasksflow/event
       │     Headers: X-TasksFlow-Signature: <hmac>, X-Event-Id: <uuid>
       │     Body: { eventType: "task.completed", taskId: 100, workerId: 42, completedAt }
       │
       └──► (страховочный) Wesetup-cron каждые 10 мин:
             GET /api/tasks?company_id=<>&changed_since=<lastPolledAt>
             Догоняет события которые webhook потерял
             
Дедупликация: Wesetup пишет каждый event_id в `tasksflow_event_log`.
Повторный event с тем же id → no-op.
```

### Wesetup → TF (outbound через outbox)

```
Wesetup хочет послать команду (например «закрой задачу 42»)
       │
       ▼
INSERT INTO tasksflow_outbox 
   (idempotency_key=UUID-v7, action="completeTask", payload={taskId:42}, status='pending')
       │
       ▼
worker-cron каждые 30 сек:
    SELECT * FROM tasksflow_outbox WHERE status='pending' LIMIT 50
    foreach row: 
       PUT /api/tasks/42 + Idempotency-Key: <uuid>
       on success → UPDATE outbox SET status='delivered', delivered_at=NOW()
       on 5xx/network → exponential backoff (5s, 30s, 5min, 30min, 4h, 24h)
       on 4xx → UPDATE status='failed' + alert админу через @wesetupbot
```

## Domain logic (Section 4 из brainstorming)

### Race-siblings cleanup (П-2) — текущий bug

Полный flow в `## Bug-fix race-siblings` ниже.

### Verify flow (П-14)

```
Worker закрыл task 100
       │
       ▼
TF: assignNextWorkerId(100) → verifierWorkerId=99
TF: status=submitted (ждёт верификации)
       │
       ▼
Wesetup webhook → JournalDocumentEntry.update({ status: "submitted" })
       │
       ├──► Анна в TF → нажимает «Принято» 
       │      → TF: status=verified, verifiedAt=ISO
       │      → webhook → Wesetup пишет verifiedAt в JournalDocumentEntry
       │
       └──► Анна в Wesetup → открыла журнал, нажала «Подтвердить»
              → Wesetup пишет verifiedAt
              → outbox: PUT /api/tasks/100 { status: "verified" }
              
Дедуп: Wesetup при второй верификации видит verifiedAt уже выставлен → no-op.
```

### Cleanup (П-16)

```
Cron в Wesetup ежедневно в 03:00:
  1. SELECT FROM TasksFlowTaskLink 
       WHERE remoteStatus IN ('done','verified','claimed_by_other')
         AND completedAt < NOW() - INTERVAL '30 days'
  2. outbox: DELETE /api/tasks/<id> для каждой
  3. После delivered — DELETE FROM TasksFlowTaskLink

Compliance-данные в JournalDocumentEntry остаются навсегда.
```

## UX & design (Section 5)

### Mini App full mirror

Текущие функции `/mini/journals/[code]/new` (worker-flow заполнения) —
**удалить** в Фазе 2. Уборщица закрывает задачи только в TF.

Mini App после реформы содержит:
- Dashboard
- Журналы (read-only + verify)
- Документы (read-only + verify)
- Отчёты
- Управление сотрудниками
- Настройки журналов
- Уведомления (push на manager-action)

### Дизайн-токены (П-11)

Источник: `.claude/skills/design-system` (Wesetup). Переносится в TF при правке UI.

```
--primary: #5566f6
--primary-press: #4a5bf0
--primary-deep: #3848c7
--text-primary: #0b1024
--text-secondary: #3c4053
--text-muted: #6f7282
--text-faint: #9b9fb3
--border: #ececf4
--border-strong: #dcdfed
--radius-sm: 16px (rounded-2xl)
--radius-lg: 24px (rounded-3xl)
--shadow-card: 0 0 0 1px rgba(240,240,250,0.45)
--shadow-primary: 0 10px 30px -12px rgba(85,102,246,0.55)
--ring-focus: ring-4 ring-[#5566f6]/15
--transition: 150-200ms
```

## Audit log (П-17)

- TF audit: своя таблица в TF БД, события task lifecycle.
- Wesetup audit: `AuditLog` модель, события journal lifecycle и manager-actions.
- Объединённый отчёт: Wesetup рендерит ленту, подтягивая TF events через `GET /api/audit?taskIds=...&since=...`.
- **Никаких физически объединённых таблиц.** Объединение только в момент рендера.

## Multi-org isolation (П-18)

```
Wesetup Organization (orgId=org_abc)
   │
   │ TasksFlowIntegration (organizationId=org_abc, tasksflowCompanyId=42, apiKey=...)
   │
   ▼
TasksFlow Company (id=42, name="Кафе ABC")
   │
   ├── Tasks
   ├── Workers (TF users in this company)
   └── Webhook endpoint: https://wesetup.ru/api/integrations/tasksflow/event
       (с per-company secret для HMAC verify)
```

При любом запросе Wesetup в TF: `companyId=<integration.tasksflowCompanyId>`
автоматически. Никто чужих задач не увидит.

## Bug-fix race-siblings (Фаза 1)

### Текущее поведение

Race-mode: 1 комната × 3 уборщика = 3 TF-задачи (одинаковый `rowKey`,
разные `workerId`). Уборщик-1 закрыл — у других ничего не происходит.

### Корневая причина

В `src/app/api/integrations/tasksflow/event/route.ts` (или его
эквиваленте) при обработке `task.completed` event:
1. ✓ Wesetup пишет `JournalDocumentEntry`.
2. ✗ **Не вызывается** siblings cleanup.

`src/lib/tasksflow-claim-mirror.ts` имеет mirror только для одной задачи
(передаваемой через args), не ходит к siblings.

### Исправление

Создать `src/lib/cleaning-siblings-cleanup.ts`:

```ts
export async function markSiblingsAsClaimedByOther(args: {
  organizationId: string;
  documentId: string;
  rowKey: string;          // "room::hol_id::cleaner::42"
  excludeTaskId: number;   // tfTaskId который только что закрылся
  claimedByName: string;
  claimedByWorkerId: number;
}): Promise<{ marked: number }> {
  // 1. Извлечь roomId из rowKey
  const roomMatch = /^room::([^:]+)::cleaner::/.exec(args.rowKey);
  if (!roomMatch) return { marked: 0 };
  const roomId = roomMatch[1];
  const roomPrefix = `room::${roomId}::cleaner::`;

  // 2. Найти все siblings (тот же documentId, та же комната, другой taskId)
  const siblings = await db.tasksFlowTaskLink.findMany({
    where: {
      // organizationId через integration scope
      journalDocumentId: args.documentId,
      rowKey: { startsWith: roomPrefix },
      tasksflowTaskId: { not: args.excludeTaskId },
      remoteStatus: { in: ["pending", "in_progress", "submitted"] },
    },
  });

  // 3. Для каждого sibling: добавить outbox-команду
  let marked = 0;
  for (const sibling of siblings) {
    await db.tasksFlowOutbox.create({
      data: {
        idempotencyKey: crypto.randomUUID(),
        action: "markClaimedByOther",
        payload: JSON.parse(JSON.stringify({
          taskId: sibling.tasksflowTaskId,
          claimedByWorkerId: args.claimedByWorkerId,
          claimedByName: args.claimedByName,
          statusText: `Сделал: ${args.claimedByName}`,
        })),
        organizationId: args.organizationId,
        status: "pending",
      },
    });
    marked += 1;
  }

  return { marked };
}
```

Вызвать из `src/app/api/integrations/tasksflow/event/route.ts` после
обработки `task.completed`:

```ts
if (eventType === "task.completed") {
  // ...existing journal-write logic...
  
  await markSiblingsAsClaimedByOther({
    organizationId,
    documentId: link.journalDocumentId,
    rowKey: link.rowKey,
    excludeTaskId: link.tasksflowTaskId,
    claimedByName: workerName,
    claimedByWorkerId: workerId,
  });
}
```

### Временный fallback (до Фазы 2)

В TF сейчас может не быть статуса `claimed_by_other`. До добавления
этого статуса — outbox `action: "markClaimedByOther"` фактически делает
`DELETE /api/tasks/<id>` (auto-delete). У уборщиков 2, 3 задача
исчезает мгновенно. Менее красиво («куда делась?»), но функционально.

Когда в TF появится `claimed_by_other` — outbox-handler переключается на
`PUT /api/tasks/<id> { status: "claimed_by_other", ... }`.

### Изменения в этой фазе

- `src/lib/cleaning-siblings-cleanup.ts` (новый, ~50 строк).
- `src/app/api/integrations/tasksflow/event/route.ts` — добавить вызов в обработку `task.completed`.
- `prisma/schema.prisma` — модель `TasksFlowOutbox` (даже если outbox-cron реальный появится в Фазе 2, модель нужна сейчас для записи будущих команд).
- Миграция: `prisma db push` через CI.
- Outbox-cron MVP: `src/app/api/cron/tasksflow-outbox/route.ts` — простой for-loop по pending записям, вызывает `client.deleteTask(taskId)` (fallback на DELETE до Фазы 2).

## План миграции (Фазы 2+ через `/loop`)

| Фаза | Что | Где |
|---|---|---|
| 2.1 | TF: добавить `claimed_by_other` статус | TasksFlow repo |
| 2.2 | Wesetup outbox-handler: переключиться на `PATCH` вместо `DELETE` | этот repo |
| 2.3 | TF: webhook outbound infra (`webhook_endpoints` table per company) | TasksFlow repo |
| 2.4 | Wesetup: страховочный polling cron | этот repo |
| 2.5 | Wesetup: phone-обязательный при создании user, auto-link cron | этот repo |
| 2.6 | Wesetup: удалить `/mini/journals/*/new` (worker-flow в Mini App) | этот repo |
| 2.7 | TF: импорт дизайн-токенов из Wesetup | TasksFlow repo |
| 2.8 | Wesetup: idempotency-key middleware на TF API client | этот repo |
| 2.9 | Wesetup: cleanup-cron (delete TF tasks старше 30 дней) | этот repo |
| 2.10 | Объединённый audit-report (UI + queries в TF API) | этот repo |

## Открытые вопросы / неопределённости

- **TF API: есть ли уже webhook outbound?** Нужно проверить в TasksFlow repo. Если нет — добавляем в Фазе 2.3.
- **TF API: есть ли `claimed_by_other` статус?** Если нет — Фаза 2.1.
- **TF API: есть ли `Idempotency-Key` поддержка?** Если нет — Фаза 2.8.
- Эти три вопроса будут решены при работе в репозитории TasksFlow.

## Acceptance criteria

После Фазы 1 (этот сеанс):
- [ ] Spec написан и закоммичен в `docs/superpowers/specs/`.
- [ ] CLAUDE.md обновлён разделом «Wesetup ↔ TasksFlow integration» с принципами П-1—П-19.
- [ ] `cleaning-siblings-cleanup.ts` создан, вызывается из webhook-handler.
- [ ] `TasksFlowOutbox` модель добавлена в schema.prisma + миграция.
- [ ] Outbox-cron MVP создан (DELETE fallback).
- [ ] Прод проверен: race-mode → один уборщик закрыл → у других задача исчезает.

После Фаз 2.1—2.10:
- [ ] Все принципы П-1—П-19 реализованы в обеих системах.
- [ ] В обоих репозиториях прошёл test-suite.
- [ ] Прод стабилен 7 дней без regression'ов.

## Связанные документы

- `docs/audit/2026-05-08-haccp-methodology-mapping.md` — соответствие методичке СанПиН.
- `docs/superpowers/specs/01-architecture.md` — общая архитектура anti-regression.
- `CLAUDE.md` — корневой файл инструкций (будет обновлён после approval этого spec).
