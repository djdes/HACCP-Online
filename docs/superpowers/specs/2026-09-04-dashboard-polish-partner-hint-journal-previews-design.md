# Дашборд: нейтральные бумажные карточки, тумблер журналов в /journals, мобильная шапка секции, подсказка о партнёрстве, живые превью журналов

Дата: 2026-09-04. Согласовано с владельцем в чате («го, делай всё как предложил»).

## 1. Бумажные карточки на дашборде — нейтральный цвет

Файл: `src/app/(dashboard)/dashboard/page.tsx` (ветка бумажных карточек).

- Рамка `border-[#ececf4]`, подложка подписи `bg-[#fafbff]`, hover `hover:border-[#5566f6]/40`.
- Бейдж «Бумажный · распечатать»: `bg-[#f5f6ff] text-[#3848c7]`, иконка `Printer`.
- Электронные карточки не меняются: зелёная (заполнен сегодня) / красная (не заполнен).

## 2. Включить/выключить журнал прямо в `/journals`

Файл: `src/components/journals/journals-browser.tsx`. API уже есть:
`PATCH /api/settings/journals { disabledCodes }` (management-only), библиотека
`src/lib/disabled-journals.ts`.

- Только менеджеру (`canBulkCreate` уже отражает роль; добавляем явный проп
  `canToggle`). Новый проп `disabledCodes` не нужен: у карточек уже есть
  `template.disabled`.
- В правом верхнем углу активной карточки — иконка-кнопка `EyeOff` 28px,
  `rounded-full bg-white/90 text-[#9b9fb3]`, на десктопе появляется на hover
  (`opacity-0 group-hover:opacity-100 focus-visible:opacity-100`), на мобиле
  видна всегда. `title="Скрыть с дашборда"`.
- Клик → `ConfirmDialog` variant `warn`: заголовок «Скрыть журнал с дашборда»,
  последствия списком: журнал исчезнет с дашборда и из Mini App у сотрудников,
  записи и документы сохраняются, включить можно здесь же или в настройках.
- Подтверждение → `PATCH` с полным списком `disabledCodes` (текущие + код) →
  `router.refresh()` → toast «Журнал скрыт: <название>».
- Отключённая карточка (уже существует, пунктир + «Включить») получает кнопку
  «Включить» как действие (без confirm), а не ссылку в настройки. PATCH с
  `disabledCodes` без кода → refresh → toast «Журнал включён».
- Клиент получает `disabledCodes` из `templates.filter(t => t.disabled)`.

## 3–4. Мобильная шапка секции «Обязательные журналы»

Файлы: `src/components/dashboard/dashboard-section.tsx`,
`src/components/dashboard/close-day-card.tsx`, `dashboard/page.tsx`.

- Мобиль (`< sm`): строка 1 — иконка секции, заголовок, пилюля счётчика,
  затем справа `titleAside` и шеврон. `titleAside` для этой секции на мобиле
  рендерится как круглая иконка-кнопка 36px (`SlidersHorizontal`, `aria-label`
  «Настройка»), на `sm+` — текущая текстовая кнопка.
- Строка 2 — `actions`: `CloseDayCard compact` на мобиле — `grid grid-cols-2
  gap-2`, кнопки `h-11`, текст «Закрыть день» / «Выборочно» (короткая подпись
  через `sm:hidden` / `hidden sm:inline`).
- Десктоп без изменений.

## 5. Подсказка о партнёрстве у логотипа

Файлы: `src/components/layout/header.tsx`, `src/app/(dashboard)/layout.tsx`,
новый `src/components/partner/partner-hint.tsx` (client), новый
`src/lib/partners/partner-hint.ts` (server helper), Mini App шапка.

- Иконка `Handshake` 16px, `text-[#c5c8d9] hover:text-[#5566f6]`, справа от
  логотипа, `aria-label="Партнёрская программа"`, `title` тот же.
- Показывать, если `showPartnerHint === true`. Helper
  `shouldShowPartnerHint({ organizationId, userId })` возвращает `false`, если:
  - у организации есть `PartnerClient` с `detachedAt = null`;
  - у пользователя есть `PartnerUser` (он партнёр; в шапке уже есть
    «Партнёрский кабинет»);
  - организация white-label (`organizationLogoUrl` задан);
  - организация `platform` (ROOT без impersonation).
- Модалка (Radix `Dialog`, `max-w-[560px] max-h-[90vh] overflow-hidden`,
  header/footer `shrink-0`, середина `overflow-y-auto`):
  1. Заголовок «Ваш бренд в WeSetup», абзац: клиенты видят ваш логотип и
     контакты, вы получаете вознаграждение с их подписки и оборудования.
  2. Блок «Как это выглядит»: CSS-макет шапки кабинета с плейсхолдером
     «Ваш логотип» и акцентным цветом, под ним CSS-макет подвала PDF с
     подписью «Подготовлено: <Ваша компания> · тел.». Никаких растровых
     скриншотов.
  3. Три плитки ставок из `getCurrentRewardRule()`: `subscriptionPercent`%
     с подписки `subscriptionMonths` мес., `hardwarePercent`% с оборудования,
     `bonusAmountRub` ₽ бонус после `bonusAfterPayments`-го платежа.
  4. Список «Что можно настроить»: логотип, цвет, приветствие при входе,
     контакты поддержки, подпись в PDF.
  5. Footer: primary «Стать партнёром» → `/settings/partner`, ссылка
     «Подробнее о программе» → `/partners`.
- Ставки передаются в Header как проп `partnerHint: { subscriptionPercent,
  subscriptionMonths, hardwarePercent, bonusAmountRub, bonusAfterPayments } |
  null` (только plain-числа, без Decimal).
- Mini App: тот же `PartnerHint` в `src/app/mini/layout.tsx` рядом с
  логотипом, тот же helper (П-3).

## 6. Живые превью журналов

### Рендер
- Зависимости: `pdfjs-dist` и `@napi-rs/canvas` (prebuilt, без системных
  библиотек). Модуль `src/lib/journal-preview/render.ts`:
  `renderPdfFirstPageToPng(pdf: Buffer, { width: 1228 }) → { png: Buffer,
  width, height }`. Использует `pdfjs-dist/legacy/build/pdf.mjs` с canvas
  factory на `@napi-rs/canvas`. Кадрируем к пропорции 1228×862 (как у
  образцов) сверху.
- Источник PDF — та же функция, что отдаёт `/api/journal-documents/[id]/pdf`
  (вынести генерацию в общий helper, если она сейчас внутри роута).

### Хранение
```prisma
model JournalPreview {
  id              String       @id @default(cuid())
  organizationId  String
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  code            String
  documentId      String
  png             Bytes
  width           Int
  height          Int
  sourceUpdatedAt DateTime
  renderedAt      DateTime     @default(now())
  @@unique([organizationId, code])
  @@index([renderedAt])
}
```

### Cron `GET /api/cron/journal-previews`
- Авторизация `checkCronSecret`. Внешний crontab каждые 10 минут (`*/10`),
  `-m 280`.
- Для каждой организации (кроме `platform`, кроме приостановленных если есть
  такой флаг) и каждого включённого электронного журнала: активный документ
  (тот же выбор, что у дашборда — `ensureActiveDocument`/поиск активного
  документа на сегодня без создания). Рендерить, если превью нет или
  `document.updatedAt > preview.sourceUpdatedAt` или `documentId` сменился.
- Лимит 60 рендеров за прогон, общий бюджет времени 240 с, порядок — самые
  старые `renderedAt` первыми (сначала организации без превью).
- Чистка в том же прогоне: удалить `JournalPreview`, у которых код в
  `disabledJournalCodes` организации или документ удалён/архивирован и
  `renderedAt < now − 30 дней`.
- Ответ `{ ok, rendered, skipped, deleted, ms }`. Ошибка рендера одного
  документа логируется и не останавливает прогон.

### Раздача `GET /api/journal-previews/[code]`
- `requireAuth`, `getActiveOrgId`, поиск по `(orgId, code)`. 404 → нет
  превью. Заголовки `Content-Type: image/png`,
  `Cache-Control: private, max-age=31536000, immutable`. URL всегда с
  `?v=<renderedAt.getTime()>`.

### Потребители
- Helper `getJournalPreviewMap(orgId) → Map<code, { url }>` (одна выборка
  `select { code, renderedAt }`).
- `dashboard/page.tsx`, `journals/page.tsx` → `journals-browser.tsx`,
  `settings/journals/page.tsx` → `journals-settings-client.tsx`: если есть
  `previewUrl` — `<img src={previewUrl}>`, иначе `/journal-samples/<code>.png`.
  Бумажные — всегда образец.

## Тесты
- `render.test.ts`: рендер маленького PDF из jsPDF → PNG сигнатура, размеры.
- `partner-hint.test.ts`: helper возвращает false при активном PartnerClient /
  PartnerUser / white-label; true иначе (моки db).
- Ручная проверка через Playwright-скрипт: дашборд мобиль 390px, /journals
  hide/unhide, модалка партнёрства.

## Что не входит
- Превью для бумажных бланков и для журналов без активного документа.
- Настоящие скриншоты в модалке партнёрства.
- Chromium на проде.
