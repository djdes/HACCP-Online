# Multi-org: несколько организаций под одним аккаунтом

Статус: дизайн зафиксирован 2026-08-27 в brainstorming-сессии с владельцем.
Источник — часть H единого плана `velvety-plotting-nova.md`; скопировано в
репозиторий перед началом реализации, чтобы решения жили рядом с кодом.

Связанные принципы CLAUDE.md: П-18 (multi-org isolation, `Organization` ↔ TF
`company` 1:1) — каждая организация аккаунта связывается с TasksFlow
независимо, своим `TasksFlowIntegration`.

---


Статус: черновик дизайна (brainstorming 2026-08-27). При старте реализации — скопировать в `docs/superpowers/specs/2026-08-27-multi-org-design.md`, закоммитить, затем `superpowers:writing-plans`.

### Решения владельца
- Режим: **только быстрое переключение** между организациями (страницы остаются одно-организационными; агрегации нет).
- Членство: **владелец + приглашённые руководители** могут быть в нескольких организациях; линейные сотрудники — в одной.
- Создание: мини-форма (название + сфера) + галочка «скопировать должности и набор журналов из текущей»; после создания сразу переключаемся в новую.
- Модель: **Account + OrganizationMember**. Тариф и лимит «5 человек суммарно» — на Account.
- Место в UI: меню профиля (справа вверху), там же тариф, список организаций и «+ Добавить организацию».

### Контекст в коде (сегодня)
- `User.organizationId` — единственный жёсткий FK (`schema.prisma:337`); junction-таблиц нет.
- Единственный swap-механизм — `actingAsOrganizationId` в JWT, закрыт `isRoot` в 4 местах: `auth.ts:184,207`, `auth-helpers.ts:96-105`, `api/root/impersonate/route.ts:52,97`.
- Tenant-scoping централизован: `getActiveOrgId(session)` — 776 вызовов; прямых `session.user.organizationId` — 39 (список на аудит).
- `JournalTemplate` глобальны → новая организация не требует seed журналов; per-org seed только `JobPosition` + `JobPositionJournalAccess` (образец `api/root/seed-demo-org/route.ts:140-212`).
- Пилюля «ООО БФС ▾» в шапке (`header.tsx:216-262`) — nav-меню, не переключатель.

---

### 1. Модель данных

```prisma
model Account {
  id                 String   @id @default(cuid())
  ownerUserId        String   @unique
  owner              User     @relation("AccountOwner", fields: [ownerUserId], references: [id])
  subscriptionPlan   String   @default("trial")   // переезжает с Organization
  subscriptionEnd    DateTime?
  planAutoUpgradedAt DateTime?
  createdAt          DateTime @default(now())
  organizations      Organization[]
}

model Organization {
  accountId  String?          // nullable на время миграции, потом обязательный
  account    Account? @relation(fields: [accountId], references: [id])
  // subscriptionPlan / subscriptionEnd — остаются как legacy-зеркало на 1 релиз, читаем через Account
}

model OrganizationMember {
  id             String @id @default(cuid())
  userId         String
  organizationId String
  role           String   // "owner" | "manager"
  createdAt      DateTime @default(now())
  @@unique([userId, organizationId])
  @@index([organizationId])
}
```

- `User.organizationId` **остаётся** = «домашняя» организация (где человек создан, где его позиция/ACL/журналы). Для линейных сотрудников это единственная. Для владельца/руководителей — одна из; остальные — через `OrganizationMember`.
- Инвариант: у владельца `OrganizationMember(role="owner")` на каждую организацию своего Account. Создаётся автоматически при создании организации.
- Лимит: `activeHeadcount(accountId) = count(DISTINCT User.id WHERE isActive AND organizationId IN account.orgs)`. Один человек в двух организациях (руководитель) считается один раз.

#### Миграция (скрипт `scripts/migrate-multi-org.ts`, идемпотентный)
1. Для каждой `Organization` без `accountId`: владелец = первый `User` с `role in (owner, manager)` по `createdAt`; создать `Account { ownerUserId, subscriptionPlan: org.subscriptionPlan, subscriptionEnd }`; `org.accountId = account.id`; `OrganizationMember(owner, org, "owner")`.
2. Платформенная org ROOT — Account с `ownerUserId` = root-пользователь.
3. Проверка: `count(Organization where accountId is null) == 0`. После — `accountId` делаем `String` (not null) во втором `db push`.

### 2. Сессия и переключение

- JWT: добавить `activeOrganizationId: string | null` (для всех), `actingAsOrganizationId` оставить только ROOT-impersonation (семантика не меняется).
- `getActiveOrgId(session)`: `isRoot && actingAs` → actingAs; иначе `activeOrganizationId ?? organizationId`. **Единственная точка**; 39 прямых `session.user.organizationId` — заменить на `getActiveOrgId` (аудит-список из исследования).
- `POST /api/me/active-organization { organizationId }`: проверяет `OrganizationMember(userId, organizationId)` (или `User.organizationId === id`), пишет `User.lastActiveOrganizationId`, переиздаёт cookie тем же приёмом, что `api/root/impersonate/route.ts` (`rewriteSessionToken`), но без `isRoot`-гейта — с гейтом на членство. Ответ → клиент `router.refresh()`.
- `jwt` callback при логине: `activeOrganizationId = user.lastActiveOrganizationId` если членство ещё есть, иначе `organizationId`.
- `hasFullWorkspaceAccess` / права: в чужой (не домашней) организации руководитель получает `permissionPreset` из `OrganizationMember.role` (`owner` → admin.full, `manager` → как `manager` role). Реализация — в `session` callback при вычислении `presetCapabilities` для активной организации.
- Mini App: тот же `getActiveOrgId`; переключатель в `/mini` — в профиле (П-3: зеркало сайта).

### 3. Создание организации

`POST /api/organizations { name, sphere, copyFrom?: organizationId }` (только owner аккаунта):
1. Транзакция: `Organization { name, type: sphere, accountId, disabledJournalCodes: defaultDisabledCodesFor(sphere) }` (правила из Части G); `OrganizationMember(owner)`.
2. Если `copyFrom`: скопировать `JobPosition` (+ `JobPositionJournalAccess` по кодам), `disabledJournalCodes`, `autoJournalCodes`, `timezone`, `brandColor/logoUrl`. Людей **не** копируем.
3. Ответ `{ organizationId }` → клиент вызывает switch → `/dashboard?welcome-org=1` (быстрый старт новой организации, без модалки регистрации).
Общий helper `src/lib/create-organization.ts` — им же заменить 4 копипасты создания (instant-register, register/confirm, payment-fulfillment, seed-demo-org).

### 4. UI

#### Меню профиля (header.tsx, расширяет Часть E2 этого плана)
```
[D] Дениска · djtaang@gmail.com
    Бесплатный · 3/5 сотрудников (по всем организациям)
────────
ОРГАНИЗАЦИИ
 ● ООО БФС            ✓   ← активная
 ○ Кафе на Ленина
 + Добавить организацию   ← только owner аккаунта
────────
↑ Улучшить тариф · ◐ Тема ▸ · ⚙ Настройки
────────
⎋ Выйти
```
- Клик по организации → `POST /api/me/active-organization` → `router.refresh()`; toast «Переключено: Кафе на Ленина».
- Пилюля «ООО БФС ▾» в шапке остаётся nav-меню, но при ≥2 организациях получает первый пункт-группу «Сменить организацию» с тем же списком (быстрее, чем лезть в аватар).
- «Добавить организацию» → модалка (по `shell()` из `staff-dialogs`): Название*, Сфера (select, дефолт = текущая), чекбокс «Скопировать должности и набор журналов из «ООО БФС»» (вкл. по умолчанию), кнопка «Создать и перейти». Под формой прогноз: «После создания: 2 организации · лимит сотрудников общий».
- На `/settings/users` (Часть F4 этого плана) — кнопка «+ Добавить организацию» под списком (как на скрине) открывает ту же модалку.

#### Доступ руководителей к организациям
- В карточке сотрудника-руководителя (`/settings/users/[id]`): блок «Доступ к организациям» — чипы организаций аккаунта с переключателями; пишет/удаляет `OrganizationMember(role="manager")`. Только owner аккаунта видит блок.
- Для линейных ролей блок скрыт.

### 5. Тариф и лимит (переезд с Organization на Account)
- `plan-limits.ts` (этот план, E3): `ensurePlanForHeadcount(accountId)` считает по аккаунту; вызовы из staff/invite получают `accountId` через активную организацию.
- `/settings/subscription`, меню профиля, `organization-info-form` «Тариф» — читают `Account`. Robokassa/YooKassa fulfillment пишут в `Account` (по `org.accountId`).
- ROOT `/root/organizations`, метрики: колонка «Аккаунт» (владелец, число организаций).

### 6. Безопасность
- Все проверки членства — серверные, в одном helper `assertOrgMembership(userId, organizationId)`; `POST /api/me/active-organization` — единственный способ сменить активную; JWT не принимает `activeOrganizationId` из клиента.
- Rate-limit на switch (10/мин) — cookie переиздаётся.
- Аудит: `AuditLog action="org.switched"` / `"org.created"` / `"org.member.added|removed"`.
- Тест на изоляцию: пользователь без членства → 403 на switch; после удаления членства при следующем запросе `session` callback сбрасывает `activeOrganizationId` на домашнюю.

### 7. Что НЕ делаем (YAGNI)
- Агрегированные страницы «все организации».
- Перенос сотрудника между организациями.
- Удаление организации из UI (только ROOT).
- Отдельные тарифы на организацию.

### 8. Тестирование
- Unit: `activeHeadcount` (руководитель в 2 организациях = 1), `getActiveOrgId` матрица (root/acting, member/active, non-member fallback), миграционный скрипт на фикстуре из 3 организаций.
- E2E (Playwright, по инструкции из `simplifications`): создать организацию из меню → переключение → дашборд показывает новое имя → добавить сотрудника в новой → счётчик в меню «4/5 (по всем)» → выдать заведующей доступ ко второй → войти под ней, увидеть обе.
- `npx tsc`, `lint`, `prisma db push` локально; grep `session.user.organizationId` → 0 вне `auth*`.

### 9. Порядок реализации (для writing-plans)
1. Схема + миграция + `create-organization.ts` (без UI).
2. `getActiveOrgId` generalization + switch endpoint + аудит 39 мест.
3. Меню профиля: список организаций, переключение, модалка создания.
4. Тариф/лимит на Account (переезд из E3/E4 этого плана).
5. Доступ руководителей к организациям.
6. Mini App зеркало + What's New.


---
