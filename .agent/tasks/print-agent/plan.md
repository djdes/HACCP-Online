# План: PrintAgent для Wesetup — печать журнала с телефона в один клик

Статус: план (код не менялся). Исполнителю: перед правкой UI — invoke
`design-system` (wesetup-design) skill; перед нетривиальными кусками —
`karpathy-guidelines`. Все user-facing тексты — на русском.

## 0. Общая картина

```
Телефон (любая страница с журналом)
  └─ кнопка «На принтер» → POST /api/print/jobs {documentId | templateCode}
                              │ (session-auth, org-scoped, ACL)
                              ▼
                        PrintJob (pending)  ← Postgres, наша БД
                              ▲
     ┌────────────────────────┘ HTTP-поллинг раз в 5с (агент за NAT — решено ранее)
     │
Windows-машина с принтером: Wesetup PrintAgent (Electron tray + node-воркер)
  1. GET  /api/print/agent/poll        (Authorization: Bearer <agentToken>)
  2. GET  /api/print/jobs/<id>/pdf     — скачивает готовый PDF (не base64 в очереди — решено ранее)
  3. SumatraPDF -silent -print-to "<принтер>"
  4. POST /api/print/jobs/<id>/complete | /fail
```

Референс протокола — Magday `C:\www\magday-backend\api\manager\print.php`
(poll помечает printing, complete/fail, зависшие printing → pending) и
`C:\www\managermagday\print-agent\print-agent.js` (цикл, логи, waitForNetwork,
SumatraPDF). Что НЕ берём из Magday: puppeteer/Edge (PDF уже генерирует
сервер — `src/lib/document-pdf.ts`), base64 файла в строке очереди, токен в
query-строке, общий захардкоженный AGENT_TOKEN на всех.

Скоуп v1: **document-based журналы** (`JournalDocument`) — именно они лежат
в блоке «Обязательные журналы» и именно у них есть серверный PDF
(`/api/journal-documents/[id]/pdf`). Field-based (`JournalEntry`) PDF-движка
не имеют — в v1 не печатаем (честно указать в UI недоступность, если кнопку
там вообще показывать; см. §4).

---

## 1. Модели Prisma (`prisma/schema.prisma`)

Добавить рядом с `TasksFlowOutbox` (стиль enum'ов в проекте — lowercase
значения, см. `enum TasksFlowOutboxStatus { pending delivered failed }`).

```prisma
enum PrintJobStatus {
  pending
  printing
  done
  error
  cancelled
}

/// Установленный экземпляр программы «Онлайн принтер». Одна строка =
/// одна машина с принтером. Токен хранится ТОЛЬКО хешем (паттерн
/// InspectorToken.tokenHash / invite-tokens.ts — sha256, plaintext не
/// хранится; bcrypt не нужен: токен высокоэнтропийный).
model PrintAgent {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  /// Кто подключил (userId управляющего) — для аудита «кто поставил агент».
  createdById    String?
  /// Имя машины (hostname), задаётся агентом при auth. Показывается в дашборде.
  name           String
  tokenHash      String       @unique
  /// Принтер по умолчанию, выбранный в настройках агента. Агент присылает
  /// его в heartbeat — дашборд показывает «HP LaserJet …».
  printerName    String?
  /// Список принтеров машины (JSON string[]) — присылает агент, дашборд
  /// может показать в подсказке.
  printers       Json?
  agentVersion   String?
  /// Обновляется при poll (с троттлингом ~30с, чтобы не писать в БД
  /// каждые 5с). online = lastSeenAt новее 90с.
  lastSeenAt     DateTime?
  /// «Отозвать» из дашборда: токен перестаёт работать, строка остаётся
  /// (audit trail — паттерн InspectorToken.revokedAt).
  revokedAt      DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  jobs           PrintJob[]

  @@index([organizationId])
}

/// Задание печати. Храним ССЫЛКУ на документ, не содержимое (решено
/// ранее: base64 журнала за месяц распухнет; у Magday в print_jobs
/// base64 — для чека ок, нам нет). PDF агент забирает отдельным GET.
model PrintJob {
  id             String         @id @default(cuid())
  organizationId String
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  /// null пока не забрал ни один агент; при claim в poll проставляется.
  agentId        String?
  agent          PrintAgent?    @relation(fields: [agentId], references: [id], onDelete: SetNull)
  documentId     String?
  document       JournalDocument? @relation(fields: [documentId], references: [id], onDelete: SetNull)
  /// Снапшот названия («Гигиенический журнал — май 2026») для истории
  /// печати: документ могут удалить/архивировать, история должна читаться.
  docTitle       String
  createdById    String
  /// Снапшот имени — история «кто отправил» не должна ломаться при
  /// удалении пользователя (тот же приём, что AuditLog.userName).
  createdByName  String?
  status         PrintJobStatus @default(pending)
  attempts       Int            @default(0)
  claimedAt      DateTime?
  printedAt      DateTime?
  errorMsg       String?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@index([organizationId, status, createdAt])
  @@index([agentId, status])
  @@index([status, claimedAt])           // самолечение зависших printing
  @@index([status, createdAt])           // чистка старых
}
```

Не забыть обратные relation-поля: `printAgents PrintAgent[]` и
`printJobs PrintJob[]` в `model Organization`, `printJobs PrintJob[]` в
`model JournalDocument` (Prisma требует обе стороны).

**Мультиарендность (П-18):** изоляция обеспечивается тем, что
(а) `POST /api/print/jobs` пишет `organizationId = getActiveOrgId(session)`
и проверяет, что документ принадлежит этой организации;
(б) poll агента выбирает задания строго `WHERE organizationId = agent.organizationId`
(организация берётся из строки `PrintAgent`, найденной по tokenHash, —
клиент её не передаёт вообще). Задание одной организации физически не
может уехать на принтер другой: у чужого агента другой organizationId в
токен-строке.

Деплой: `npx prisma db push` локально; прод-деплой уже гоняет его сам
(CLAUDE.md → Deployment).

Критерии приёмки:
- `npx prisma validate` и `npx tsc --noEmit --skipLibCheck` зелёные.
- В сиде ничего менять не нужно (фича opt-in).

Риски: `onDelete: SetNull` для documentId требует nullable поля — учтено;
если сделать Cascade, история печати будет молча исчезать при удалении
документов (плохо для «истории печати в дашборде»).

---

## 2. Обмен «логин/пароль → токен агента»

Требование задачи: вход в программе по логину/паролю Wesetup; автологин
после перезагрузки без повторного ввода пароля. Значит: пароль
используется РОВНО ОДИН РАЗ, в момент установки, только в памяти
процесса и в одном HTTPS-запросе; на диск ложится только выданный токен.

NextAuth напрямую переиспользовать нельзя (cookie-флоу + CSRF не для
десктоп-агента), но в проекте уже есть готовый REST-образец проверки
пароля: `src/app/api/auth/login/route.ts` (bcrypt.compare +
`DUMMY_BCRYPT_HASH` против user-enumeration + `loginRateLimiter` из
`src/lib/rate-limit.ts`). Копируем его схему проверки, но вместо выдачи
сессии выдаём долгоживущий agent-токен.

Новый эндпоинт `src/app/api/print/agents/auth/route.ts`:

```
POST /api/print/agents/auth
body: { email, password, deviceName, agentVersion }
```

Логика:
1. Rate-limit: `loginRateLimiter.consume("print-agent:" + ip)` → 429.
2. Поиск юзера + bcrypt.compare с DUMMY-хешем (скопировать блок из
   `/api/auth/login`; лучше — вынести общий helper
   `verifyEmailPassword(email, password)` в `src/lib/credentials.ts` и
   переиспользовать в обоих роутах, чтобы anti-enumeration не разъехался).
3. Роль: только management (`hasAnyUserRole(role, ["owner","manager","technologist","head_chef"])`
   — как в `/api/settings/external-token`). Повару агент ставить незачем,
   а его токен давал бы принтеру задания всей организации.
4. Организация: `user.organizationId` (у агента нет понятия
   activeOrganization; агент привязывается к домашней организации
   вошедшего. Для сетей с несколькими точками — по одному агенту на
   точку, каждый входит логином сотрудника этой точки; отметить это в
   подсказке UI).
5. Генерация токена: `crypto.randomBytes(32).toString("base64url")`
   (паттерн `generateInviteToken` в `src/lib/invite-tokens.ts`);
   `tokenHash = sha256(raw)`; `db.printAgent.create({...})`.
6. Ответ 200: `{ agentToken: raw, agentId, organizationName, userName }`.
   Плейнтекст токена больше нигде не возвращается.

Автологин: агент кладёт `agentToken` в `config.json` (см. §5) и после
перезагрузки просто продолжает поллинг с Bearer-токеном. Пароль на диске
не оседает. «Выход»/переустановка = повторный login → новая строка
PrintAgent; старую управляющая отзывает в дашборде (revokedAt), либо
auth-роут сам ревокает прежние агенты с тем же `name`+`organizationId`
(рекомендую: перелогин на той же машине не плодит призраков).

Ограничение (написать в UI логина агента): вход только email/password.
Пользователи, заходящие в Wesetup исключительно через Telegram, должны
завести пароль (есть `/forgot`). Это соответствует духу П-7 («email/password
как fallback» существует).

Критерии приёмки:
- Неверный пароль → 401 без различий по времени между «нет юзера» и
  «не тот пароль»; 6-я попытка за 5 минут → 429.
- Успех: в БД строка PrintAgent c tokenHash, плейнтекста нет нигде.
- Роль cook → 403.

Риски: если вынести helper из `/api/auth/login`, не сломать его контракт
(прогнать вход на сайте вручную).

---

## 3. API (все новые роуты — `src/app/api/print/...`)

Общий helper `src/lib/print-agent-auth.ts`:

```ts
requirePrintAgent(request): Promise<{ ok:true; agent: PrintAgent } | { ok:false; response: NextResponse }>
```
— читает `Authorization: Bearer <token>` (НЕ query — решено ранее: query
попадает в логи nginx; тот же довод уже реализован в `src/lib/cron-auth.ts`),
`sha256(token)` → `db.printAgent.findUnique({ where: { tokenHash } })`,
отклоняет `revokedAt != null` (401), бампает `lastSeenAt` не чаще раза в
30с (сравнить с текущим значением, чтобы не писать в БД каждый poll).

### 3.1 Агентские (Bearer agent token)

**`GET /api/print/agent/poll`** → `src/app/api/print/agent/poll/route.ts`
- Самолечение (паттерн Magday print.php, строки 52-56): перед выборкой
  `updateMany({ where: { organizationId, status: "printing", claimedAt: { lt: now-10мин } }, data: { status: "pending", agentId: null } })`
  c `attempts: { increment: 1 }`; задания с `attempts >= 3` → `status: "error", errorMsg: "Агент не смог напечатать за 3 попытки"`.
- Атомарный claim (у Magday SELECT+UPDATE не атомарны — у нас может быть
  2 агента в организации): `findFirst pending ORDER BY createdAt ASC`,
  затем `updateMany({ where: { id, status: "pending" }, data: { status: "printing", agentId, claimedAt: now, attempts: { increment: 1 } } })`;
  если `count === 0` — гонка, вернуть `{ job: null }` (следующий tick заберёт).
- Ответ: `{ job: null }` либо
  `{ job: { id, docTitle, pdfUrl: "/api/print/jobs/<id>/pdf" } }`.
  Никакого содержимого файла в ответе (решено ранее).

**`GET /api/print/jobs/[id]/pdf`** → `src/app/api/print/jobs/[id]/pdf/route.ts`
- Auth агентом; проверить `job.agentId === agent.id`,
  `job.organizationId === agent.organizationId`, `status === "printing"`,
  `documentId != null` (404 иначе).
- `generateJournalDocumentPdf({ documentId, organizationId: agent.organizationId })`
  (`src/lib/document-pdf.ts:6009`) — ровно как в
  `src/app/api/journal-documents/[id]/pdf/route.ts`, только auth другой и
  без HTML-обёрток ошибок (агенту нужен JSON).
- ВАЖНО: ACL-проверка `hasJournalAccess` тут не нужна — право проверено
  на этапе создания задания тем, кто нажал кнопку; агент — принтер
  организации, а не пользователь.

**`POST /api/print/jobs/[id]/complete`** и **`.../fail`**
→ `src/app/api/print/jobs/[id]/complete/route.ts`, `.../fail/route.ts`
- complete: `updateMany({ where: { id, agentId: agent.id, status: "printing" }, data: { status: "done", printedAt: now } })`.
  Повторный вызов → no-op 200 (идемпотентно, как verify-flow П-14).
- fail: body `{ error }` → `status: "error"`, `errorMsg: error.slice(0,255)`
  (лимит как у Magday). НО: если это сетевая/временная ошибка, агент сам
  решает, слать ли fail; серверный retry идёт через самолечение poll.

**`POST /api/print/agent/state`** → heartbeat настроек
- body `{ printerName, printers: string[], agentVersion }` — агент шлёт
  при старте и при смене принтера. Обновляет строку PrintAgent. Дашборд
  из этого показывает «какой принтер выбран».

### 3.2 Пользовательские (session-auth)

**`POST /api/print/jobs`** → `src/app/api/print/jobs/route.ts`
- body: `{ documentId }` ИЛИ `{ templateCode }` (второй вариант — для
  кнопок на списках/дашборде, где docId неизвестен: сервер резолвит
  «текущий» документ шаблона — последний по `createdAt`/периоду
  `JournalDocument` организации с этим `template.code`; нет документа → 404
  «Журнал ещё не создан»).
- Auth: `requireApiAuth()` (`src/lib/auth-helpers.ts`), затем в точности
  проверки PDF-роута (`src/app/api/journal-documents/[id]/pdf/route.ts:65-87`):
  `doc.organizationId === getActiveOrgId(session)` и
  `hasJournalAccess(aclActorFromSession(...), template.code)` — иначе
  повар без доступа к журналу напечатал бы его через API.
- Есть ли кому печатать: `printAgent.findFirst({ where: { organizationId, revokedAt: null } })`;
  нет → 409 `{ error: "printer_not_connected" }` — клиент показывает toast
  со ссылкой на блок «Онлайн принтер».
- Дедуп double-tap: если ровно такой же pending job (`documentId`,
  `createdById`) моложе 20с — вернуть его же, не создавать второй
  (идемпотентность в духе П-19, ключ — (documentId, userId, окно)).
- Создание: `docTitle` собрать как `«<template.name> — <период документа>»`,
  `createdByName = session.user.name`. Ответ 201 `{ jobId }`.

**`GET /api/print/jobs/[id]`** (session, org-check) — статус для
живого toast'а на телефоне («Напечатано ✓» / «Ошибка: …»). Кнопка после
отправки поллит его 3-4 раза с интервалом 3с и обновляет toast.

**`GET /api/print/status`** → данные блока дашборда:
`{ agents: [{ id, name, printerName, lastSeenAt, online, agentVersion }], jobs: [последние 20: { id, docTitle, createdByName, status, createdAt, printedAt, errorMsg }] }`.
`online = lastSeenAt > now - 90с` (poll 5с + троттлинг heartbeat 30с +
запас). Роли: management only (`requireApiRole`), как остальные настройки.

**`POST /api/print/agents/[id]/revoke`** (management) — `revokedAt = now`.
Destructive → в UI через `ConfirmDialog` (native confirm запрещён,
CLAUDE.md UX-6), variant "danger", без typeToConfirm (не катастрофа).

**`GET /api/print/agent/download`** (или статическая ссылка, см. §5) —
редирект на инсталлятор (env `PRINT_AGENT_DOWNLOAD_URL`).

Критерии приёмки §3:
- curl-сценарий: auth → создать job из сессии → poll возвращает job и
  метит printing → GET pdf отдаёт `application/pdf` → complete → job done.
- Агент организации A с валидным токеном никогда не получает job
  организации B (проверить руками на двух орг из seed).
- job без агента → 409; job на чужой журнал (cook без ACL) → 403.
- Повторный complete → 200, состояние не меняется.

Риски: `generateJournalDocumentPdf` на больших документах может быть
небыстрым — таймаут запроса агента ставить 60с (у Magday 15с только на
poll; на скачивание PDF — больше).

---

## 4. UI

### 4.1 Блок «Онлайн принтер» на дашборде — ПОД журналами

Файл: `src/app/(dashboard)/dashboard/page.tsx`. Блок «Обязательные
журналы» — это `<DashboardSection storageKey="compliance-grid">` внутри
`<section className="space-y-4">` (~строки 274-424). Новый блок вставить
СРАЗУ ПОСЛЕ закрытия этого DashboardSection (перед ссылкой «Готовность к
проверке Роспотребнадзора», ~строка 425) — буквально «под журналами»,
как в задаче:

```tsx
<DashboardSection
  storageKey="print-agent"
  title="Онлайн принтер"
  subtitle="Печать журналов с телефона в один клик — на случай внезапной проверки."
  icon={Printer}                 // уже импортирован в этом файле
  defaultOpen={false}
  badge={/* online → {text:"онлайн", tone:"ok"}; установлен, но офлайн → {text:"офлайн", tone:"danger"}; не установлен → {text:"не установлен", tone:"warn"} */}
>
  <PrintAgentCard />
</DashboardSection>
```

Бейдж требует статуса на сервере — дёшево: один
`db.printAgent.findFirst({ where: { organizationId, revokedAt: null }, select: { lastSeenAt: true } })`
в уже существующем блоке запросов страницы.

Новый клиент-компонент `src/components/dashboard/print-agent-card.tsx`
(образец организации — `LiveClaimsCard`: клиентский fetch + refresh каждые
15с):
- **Статус соединения**: пилюля per-агент (зелёная точка «В сети · HP
  LaserJet M15w», красная «Не в сети — проверьте компьютер с принтером»,
  серым `lastSeenAt` через formatRelativeTime). Кнопка «Отозвать» (иконка)
  → `ConfirmDialog` variant danger.
- **История печати** (за основу — вьювер очереди Magday
  `print.php case 'view'`: цвета статусов pending #fa8c16 / printing
  #1890ff / done #52c41a / error #f5222d, «N мин назад»; перерисовать в
  токены дизайн-системы: done → success-bg/fg, error → warn-bg/fg):
  последние 10 заданий — docTitle, кто, когда, статус; у error — errorMsg
  в title. Пустое состояние: «Ещё ничего не печатали».
- **Ссылка «Онлайн принтер» на скачивание**: primary-кнопка по рецепту
  design-system (`bg-[#5566f6] hover:bg-[#4a5bf0] rounded-2xl shadow-…`)
  «Скачать Онлайн принтер» → `PRINT_AGENT_DOWNLOAD_URL`. Когда агентов
  ещё нет — карточка в onboarding-режиме: пошаговый pipeline (UX-принцип 3):
  «1. Скачайте программу на компьютер, к которому подключён принтер →
  2. Войдите своим логином и паролем Wesetup → 3. Выберите принтер —
  готово, кнопка “На принтер” появится во всех журналах».

### 4.2 Кнопка «На принтер» — везде, где виден журнал

Общий модуль `src/components/journals/print-to-agent.tsx`:
- хук `usePrintToAgent()`: `send({documentId?|templateCode?})` → POST
  `/api/print/jobs`; toast (sonner) «Отправлено на принтер 🖨» → фоновый
  поллинг `GET /api/print/jobs/[id]` → toast.success «Напечатано» /
  toast.error с текстом; 409 printer_not_connected → toast с action-ссылкой
  «Подключить принтер» на `/dashboard` (якорь блока). Печать НЕ
  оборачивать в ConfirmDialog — недеструктивно, и владелец просил один
  клик (UX-принцип 1); правило «кнопка-конфетка» закрывается toast'ом с
  результатом.
- `PrintToAgentIconButton` — компактная иконка-кнопка для списков.

Конкретные места (в порядке покрытия):
1. **`src/components/journals/document-actions-bar.tsx`** — единая шапка
   всех 13+ document-страниц. Добавить в DropdownMenu «⋯» пункт
   «На принтер» (icon Printer, над пунктом «Печать»-PDF), активный при
   `documentId`. Это автоматически покрывает и **Mini App**: страница
   `src/app/mini/documents/[id]/page.tsx` — server-side proxy на ту же
   site-страницу, отдельной правки не нужно (проверить руками в Mini).
2. **`src/components/journals/document-page-header.tsx`** — вторая шапка
   (med-book, tracked, pest-control и др., см. grep `DocumentPageHeader`).
   Кнопка «На принтер» рядом с «Печать».
3. **Дашборд, карточки «Обязательные журналы»** (`dashboard/page.tsx`,
   compliance-grid): маленькая icon-кнопка Printer в углу карточки
   (появляется на hover на desktop, всегда видима на touch) →
   `send({templateCode: item.code})`. Карточка — `<Link>`; кнопке нужен
   `e.preventDefault()/stopPropagation()`. Это и есть «жмякнул с
   телефона — готово» из комментария владельца.
4. **Списки документов `/journals/[code]`**: не править 30 файлов
   `*-documents-client.tsx` по одному. Минимум v1 — печать «текущего»
   журнала из шапки списка: страница `src/app/(dashboard)/journals/[code]/page.tsx`
   рендерит клиентов; добавить `PrintToAgentIconButton` с templateCode в
   общую шапку страницы (или в `tracked-documents-client.tsx` как самый
   переиспользуемый). Пер-строчная печать конкретного месяца — фаза 2.
5. **Mini App `/mini/journals/[code]`** (document-based ветка — список
   документов): кнопка «На принтер» в шапке списка, `templateCode`.
   Field-based ветка — кнопку не показывать (PDF нет, см. скоуп).

### 4.3 WhatsNewModal (обязателен по CLAUDE.md)

`src/lib/whats-new-notes.ts`: после деплоя финального среза обновить
`LATEST_NOTES_BUILD_SHA` на sha релизного коммита и добавить категорию
«Интеграции» (иконка уже должна быть в `CATEGORY_ICONS` map в
`whats-new-modal.tsx` — если категории нет, добавить именно туда, НЕ в
notes-файл): «Онлайн принтер: печатайте любой журнал с телефона в один
клик — программа ставится на компьютер с принтером».

Критерии приёмки §4:
- На телефоне (или узком viewport) со страницы документа И с дашборда
  журнал отправляется в очередь ≤2 тапов; toast сообщает результат.
- Блок на дашборде показывает онлайн/офлайн и последние задания без
  перезагрузки страницы (обновление ≤15с).
- Native `window.confirm` нигде не появился; стили — токены дизайн-системы.

Риски: у Mini App proxy-страницы поповеры/тосты sonner должны работать —
проверить, что `<Toaster>` смонтирован в `src/app/mini/layout.tsx` (если
нет — добавить или использовать локальный статус-бейдж на кнопке).

---

## 5. Сам агент (программа PrintAgent)

### Где держать исходники

Рекомендация: **отдельный репозиторий/проект `PrintAgent`** (в ProjectsFlow
проект уже заведён владельцем) — НЕ внутри `d:\www\Wesetup.ru`. Доводы:
- Деплой Wesetup пакует репу в deploy.tar и гоняет `npm install` на
  сервере — Electron-зависимости (сотни МБ, платформозависимые бинарники)
  там не нужны и замедлят каждый деплой.
- Философия границ как П-1/П-12: агент — standalone-клиент HTTP API
  Wesetup со своим релизным циклом; общего кода с Next.js у него нет.
- Инсталлятор ~80-100 МБ — в git Wesetup ему не место.
В Wesetup остаётся только API и ссылка `PRINT_AGENT_DOWNLOAD_URL`
(GitHub Release проекта PrintAgent или файл, вручную положенный на сервер
вне webpack, например `/var/www/.../shared/downloads/`).

### Состав (за основу — Magday `print-agent/` целиком)

```
PrintAgent/
├── agent.js          # воркер: поллинг + печать (из print-agent.js Magday)
├── tray-app/         # Electron: main.js, preload.js, renderer.js, index.html, icon.ico
├── SumatraPDF.exe    # тихая печать PDF (кладём рядом — Magday уже ищет path.join(__dirname))
├── installer/        # electron-builder NSIS-конфиг
└── package.json
```

**agent.js — берём из `print-agent.js` Magday:**
- каркас: uncaughtException/unhandledRejection без выхода, `log()` с
  ротацией по 10МБ, `waitForNetwork()` (критично для автозапуска после
  перезагрузки — сеть поднимается позже нас), одиночный `isProcessing`,
  фильтр сетевых ошибок в логе, `printPdf()` через SumatraPDF
  `-silent -print-to "<printer>"` с PowerShell-fallback.
- **Выкидываем:** puppeteer/edgePath и всю HTML-ветку `printJob` (PDF
  готов на сервере); `printerForSource`/labelSources (у нас один канал);
  base64-декодирование.
- **Меняем протокол:**
  - `pollForJob()` → `GET ${apiUrl}/api/print/agent/poll` c header
    `Authorization: Bearer ${agentToken}` (не query — см. §3);
  - новое `downloadPdf(job)` → GET `pdfUrl` тем же Bearer, сохранить в
    `os.tmpdir()/wesetup-print-<id>.pdf`, напечатать, удалить (finally —
    как в `printFileJob` Magday);
  - complete/fail → `POST /api/print/jobs/<id>/(complete|fail)` c Bearer;
  - 401 от poll → лог «Токен отозван — войдите заново» + IPC-событие в
    tray, чтобы открыть окно логина.

**tray-app — берём Magday tray-app (main.js: spawn agent.js, лог-буфер
500 строк, single-instance lock, авторестарт воркера через 5с, скрытие в
трей вместо закрытия; preload: contextBridge; `printers:list` через
`Get-Printer`), добавляем:**
- Экран **входа** (email/пароль Wesetup): при отсутствии `agentToken` в
  конфиге окно открывается само с формой; сабмит → main-процесс делает
  `POST /api/print/agents/auth` (`deviceName = os.hostname()`), пишет
  `agentToken` в config, запускает воркер. Пароль живёт только в памяти
  рендерера→IPC→fetch. Ошибки: 401 «Неверный email или пароль», 403
  «Нужны права руководителя», 429 «Слишком много попыток».
- Экран **выбора принтера**: dropdown из `printers:list`, сохранение →
  `config.printerName` + рестарт воркера (механика `config:save` Magday
  уже так делает) + `POST /api/print/agent/state`.
- Вкладка логов — как у Magday (renderer.js готов).
- Стилистика окна — цвета Wesetup (#5566f6, светлые поверхности), иконка
  — своя (не Magday icon.ico).

**Конфиг и логи:** НЕ в папке программы (Program Files не для записи), а
`%APPDATA%\WesetupPrintAgent\config.json` и `%APPDATA%\WesetupPrintAgent\logs\agent.log`.
config: `{ apiUrl: "https://wesetup.ru", agentToken, printerName, pollIntervalMs: 5000 }`.
Это отличие от Magday (у него config рядом со скриптом — там portable-раскладка).

**Автозапуск и автологин:**
- Автологин: токен в config → воркер стартует и поллит без вопросов; в
  начале — `waitForNetwork()` (до ~2.5 мин, как у Magday), затем один
  `POST /api/print/agent/state` (обновить lastSeenAt/printerName сразу).
- Автозапуск: `app.setLoginItemSettings({ openAtLogin: true, args: ["--hidden"] })`
  в Electron (эквивалент Startup-ярлыка, который Magday делает в
  `install-service.bat:68-83`; NSSM-службу Magday сам же выпилил — трей в
  session 0 не живёт). `--hidden` → старт свёрнутым в трей.
- Инсталлятор: electron-builder (NSIS, oneClick) → `WesetupPrintAgent-Setup.exe`.
  Если делать быстрее — допустим v1 «zip + install.bat» по образцу
  `install-service.bat` Magday (ярлык в Startup через PowerShell WScript.Shell),
  но для «скачать по ссылке и поставить» NSIS сильно дружелюбнее.

Критерии приёмки §5:
- Свежая Windows-машина: скачал → поставил → вошёл логином/паролем →
  выбрал принтер → задание с телефона печатается ≤15с.
- Перезагрузка машины: агент сам поднялся в трее, дашборд показывает
  «в сети» без единого действия пользователя (автозапуск + автологин).
- Обрыв интернета на 5 минут: агент не падает, после восстановления
  печатает накопившееся (очередь ждёт в Postgres — graceful degradation
  в духе П-15).
- В config.json нет пароля; токен есть только там и в hash-виде в БД.

Риски: SumatraPDF лицензия GPLv3 — распространение вместе с инсталлятором
допустимо (Magday так и делает), но отметить в README; антивирусы могут
ругаться на неподписанный NSIS — минимально: инструкция в onboarding-блоке
дашборда.

---

## 6. Эксплуатация

- **Зависшие printing** — самолечение в poll-хендлере (см. §3.1): >10 мин
  → pending, 3 попытки → error. Референс: `print.php` строки 52-56
  (cutoff 1 час — у нас короче: журнал нужен к проверке сейчас).
- **Чистка старых заданий** — новый `src/app/api/cron/print-maintenance/route.ts`
  (auth `checkCronSecret` из `src/lib/cron-auth.ts`, паттерн любого
  `/api/cron/*`; расписание — внешний scheduler, как задокументировано в
  `docs/FEATURES_AND_AUTOMATION.md:18`; раз в сутки):
  `deleteMany({ where: { status: { in: ["done","error","cancelled"] }, createdAt: { lt: now-30д } } })`
  — 30 дней, симметрично `TELEGRAM_LOG_RETENTION_DAYS` и П-16. Плюс сюда
  же — фоновый добив «pending старше 24ч → cancelled, errorMsg 'агент не
  забрал задание'» (телефонная кнопка не должна печатать позавчерашнюю
  случайную очередь, когда принтер наконец включат).
- **Принтер офлайн**: сервер этого не знает — он видит лишь «агент не
  поллит» (офлайн-бейдж в дашборде) или fail от SumatraPDF. Достаточно:
  (а) красный статус в блоке дашборда; (б) toast отправителю после
  поллинга статуса «Задание в очереди, но принтер не в сети»
  (клиент сравнивает status=pending + agents все offline из
  `/api/print/status`). Спулер-мониторинг как в `Program.cs` (детект
  «зажевало») — осознанно НЕ тащим в v1 (2000 строк ради edge-case).
- **platform-alerts**: НЕ нужен для самой печати — это фича организации,
  её здоровье видно в её дашборде, а `src/lib/platform-alerts.ts` по
  собственной шапке обязан не становиться шумом (принтеры клиентов будут
  выключаться постоянно). Единственное применение — `recordCronRun("print-maintenance", …)`
  + алерт при `failStreak >= FAIL_STREAK_ALERT_THRESHOLD`, как у соседних
  cron'ов: падение чистки — поломка платформы, а не клиента.
- Опционально (фаза 2): notifyOrganization в Telegram при job.status=error.

---

## 7. Порядок работ

**Этап 1 — сервер (последовательно, база всего):**
1. Prisma-модели + `db push` (§1).
2. `verifyEmailPassword` helper + `POST /api/print/agents/auth` (§2).
3. `print-agent-auth.ts` + poll / pdf / complete / fail / state (§3.1).
4. `POST /api/print/jobs` + `GET /api/print/jobs/[id]` + `GET /api/print/status` (§3.2).
   Проверка: полный curl-сценарий из критериев §3.

**Этап 2 — параллельно два трека (API из этапа 1 заморожен):**
- Трек A (агент): консольный agent.js с ручным config.json →
  **минимальный срез, уже дающий владельцу пользу**: он сам вписывает
  токен (полученный curl'ом), а печать с телефона уже работает через
  кнопку из трека B. Затем tray-app + логин-форма + автозапуск + инсталлятор.
- Трек B (веб-UI): `print-to-agent.tsx` + пункт в `DocumentActionsBar` и
  `DocumentPageHeader` (закрывает site + Mini App разом) → блок дашборда
  `PrintAgentCard` → кнопки на карточках дашборда и списках (templateCode).

**Этап 3 — обвязка:** cron print-maintenance + recordCronRun; revoke-кнопка;
`PRINT_AGENT_DOWNLOAD_URL` + выкладка инсталлятора; WhatsNewModal;
`npx tsc --noEmit --skipLibCheck` + `npm run lint`; ручной e2e на проде
(дашборд-статус, печать с телефона, перезагрузка машины).

**Минимальный полезный срез** (можно показать владельцу через ~пол-этапа 2):
модели + auth + poll/pdf/complete + POST jobs + пункт «На принтер» в
DocumentActionsBar + консольный агент. Всё остальное (трей, инсталлятор,
дашборд-блок, история) наращивается, не ломая этот путь.

## Чего в коде не нашёл / открытые вопросы исполнителю

- PDF есть только у document-based журналов; печать field-based
  (`JournalEntry`) потребует отдельного рендера — вынесено из скоупа v1.
- Не проверено, смонтирован ли sonner `<Toaster>` в `src/app/mini/layout.tsx`
  — проверить перед треком B.
- `PRINT_AGENT_DOWNLOAD_URL`: место выкладки инсталлятора (GitHub Release
  репо PrintAgent vs папка на сервере) — согласовать с владельцем; в
  `.env`-раздел CLAUDE.md добавить переменную.
- Мульти-точка (activeOrganizationId): агент привязан к домашней
  организации вошедшего — если владельцу сети нужен агент во второй
  точке, входить должен сотрудник той точки. Зафиксировать в подсказке
  логин-окна; если не устроит — добавить выбор организации в auth-ответ
  (фаза 2).
