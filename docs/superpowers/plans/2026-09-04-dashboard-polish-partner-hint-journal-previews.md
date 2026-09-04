# Дашборд-полировка, подсказка о партнёрстве, живые превью — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать спеку `docs/superpowers/specs/2026-09-04-dashboard-polish-partner-hint-journal-previews-design.md` (6 пунктов владельца).

**Architecture:** UI-правки в существующих server/client компонентах дашборда и `/journals`; новый client-компонент `PartnerHint` + server helper; новая модель `JournalPreview`, рендер PDF→PNG через `pdfjs-dist` (legacy build, NodeCanvasFactory на `@napi-rs/canvas`), cron-роут и роут раздачи.

**Tech Stack:** Next.js 16 App Router, Prisma, Tailwind, Radix Dialog, `pdfjs-dist@6`, `@napi-rs/canvas`, тесты `node:test` (`npm test`).

---

### Task 1: Нейтральные бумажные карточки (AC1)

**Files:** Modify `src/app/(dashboard)/dashboard/page.tsx` ветка `paperItems.map`.

- [ ] Заменить классы карточки на `border-[#ececf4] bg-[#fafbff] hover:border-[#5566f6]/40`, картинка `border-b border-[#ececf4]`, бейдж `bg-[#f5f6ff] text-[#3848c7]`, название `text-[#0b1024]`. Обновить комментарий («нейтральные, без статуса»).
- [ ] `npm run typecheck` → OK. Commit: «Бумажные карточки на дашборде — нейтральный цвет вместо янтарного».

### Task 2: Мобильная шапка секции (AC3)

**Files:** `src/components/dashboard/close-day-card.tsx:206-228`, `src/app/(dashboard)/dashboard/page.tsx` (titleAside).

- [ ] В compact-ветке: контейнер `grid w-full grid-cols-2 gap-2 sm:flex sm:items-center`, кнопки `h-11 sm:h-10`, у второй кнопки текст `<span className="sm:hidden">Выборочно</span><span className="hidden sm:inline">Закрыть выборочно</span>`.
- [ ] `titleAside`: `Link` с классами `inline-flex size-9 items-center justify-center rounded-xl border ... sm:w-auto sm:px-3 sm:gap-1.5`, текст «Настройка» в `<span className="hidden sm:inline">`, `aria-label="Настройка журналов"`.
- [ ] Проверить порядок в `dashboard-section.tsx`: на мобиле `titleAside` (order-2) и шеврон (order-2) остаются в первой строке, actions (order-3, basis-full) второй строкой — уже так, менять не нужно.
- [ ] Commit: «Мобильная шапка «Обязательных журналов»: счётчик и настройка в строку, кнопки закрытия дня рядом».

### Task 3: Тумблер журнала в /journals (AC2)

**Files:** `src/components/journals/journals-browser.tsx`, `src/app/(dashboard)/journals/page.tsx`.

- [ ] В `JournalsBrowserProps` добавить `canToggle?: boolean`. Прокинуть в `JournalCard` вместе с `disabledCodes: string[]` (вычислить в `JournalsBrowser`: `templates.filter(t=>t.disabled).map(t=>t.code)`).
- [ ] В `JournalCard`: состояние `confirmOpen`, `pending`; функция `patchDisabled(next: string[])` → `fetch("/api/settings/journals", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ disabledCodes: next }) })`; при `!res.ok` toast.error; иначе toast.success и `router.refresh()`.
- [ ] Активная карточка: в `relative`-обёртке справа сверху `<button type="button" className="absolute right-2 top-2 z-10 flex size-7 items-center justify-center rounded-full bg-white/90 text-[#9b9fb3] shadow-[0_0_0_1px_rgba(220,223,237,0.9)] backdrop-blur transition-opacity hover:text-[#5566f6] sm:opacity-0 sm:group-hover/card:opacity-100 sm:focus-visible:opacity-100" title="Скрыть с дашборда" aria-label={`Скрыть «${name}» с дашборда`}>` (`EyeOff size-3.5`). Внешний `div.relative` получает `group/card`.
- [ ] `ConfirmDialog` variant `warn`, title «Скрыть журнал с дашборда?», description с названием, bullets: «Исчезнет с дашборда и из Mini App у сотрудников», «Записи и документы сохраняются», «Включить обратно можно здесь же или в настройках», confirmLabel «Скрыть».
- [ ] Отключённая карточка: заменить `Link` «Включить» на `<button>` того же вида, `onClick` → `patchDisabled(disabledCodes.filter(c=>c!==code))`, если `canToggle`; иначе прежняя ссылка.
- [ ] В `journals/page.tsx`: `<JournalsBrowser templates={items} canBulkCreate={isManager} canToggle={isManager} />`.
- [ ] `npm run typecheck`, commit: «Скрыть/включить журнал прямо в списке журналов».

### Task 4: Helper и модалка партнёрской подсказки (AC4, AC5)

**Files:** Create `src/lib/partners/partner-hint.ts`, `src/lib/partners/partner-hint.test.ts`, `src/components/partner/partner-hint.tsx`. Modify `src/components/layout/header.tsx`, `src/app/(dashboard)/layout.tsx`, `src/app/mini/_components/mini-shell.tsx`, `src/app/mini/layout.tsx`.

- [ ] `partner-hint.ts`:
  ```ts
  export type PartnerHintRates = { subscriptionPercent:number; subscriptionMonths:number; hardwarePercent:number; bonusAmountRub:number; bonusAfterPayments:number };
  export function decidePartnerHint(input:{ hasActivePartnerClient:boolean; isPartnerMember:boolean; hasWhiteLabelLogo:boolean; isPlatformOrg:boolean }): boolean
  export async function getPartnerHintRates(args:{ organizationId:string; userId:string; hasWhiteLabelLogo:boolean }): Promise<PartnerHintRates|null>
  ```
  `getPartnerHintRates` делает `db.partnerClient.count({ where:{ organizationId, detachedAt:null } })`, `db.partnerUser.count({ where:{ userId } })`, сравнивает с `PLATFORM_ORG_ID`, при `decidePartnerHint(...)` → `getCurrentRewardRule()` → числа через `Number(...)`.
- [ ] Тест `decidePartnerHint`: false для каждого из четырёх флагов, true когда все false.
- [ ] `PartnerHint` client: props `rates: PartnerHintRates`, `variant?: "site"|"mini"`. Кнопка-иконка `Handshake` `size-4 text-[#c5c8d9] hover:text-[#5566f6]`, Dialog по спеке (макет шапки + PDF-подвал CSS, три плитки, список, footer «Стать партнёром» → `/settings/partner` (mini: `/settings/partner` тоже — открывается сайт) и «Подробнее» → `/partners`).
- [ ] Header: проп `partnerHint?: PartnerHintRates|null`, рендер `<PartnerHint>` сразу после `</Link>` логотипа. Layout: вычислить `partnerHint` в `Promise.all` через `getPartnerHintRates` (после известного `organizationLogoUrl`; проще вызвать после Promise.all).
- [ ] Mini: `MiniTopBar` получает `partnerHint` проп, layout вычисляет так же (только при сессии).
- [ ] `npm test -- src/lib/partners/partner-hint.test.ts` → pass. Commit: «Подсказка о партнёрской программе у логотипа».

### Task 5: Модель JournalPreview и рендер PDF→PNG (AC6 часть)

**Files:** `prisma/schema.prisma`, Create `src/lib/journal-preview/render.ts`, `src/lib/journal-preview/render.test.ts`.

- [ ] Prisma: модель из спеки + `journalPreviews JournalPreview[]` в `Organization`. `npx prisma db push` (локально) + `npx prisma generate`.
- [ ] `render.ts`: `renderPdfFirstPageToPng(pdf: Uint8Array, opts?: { width?: number; aspect?: number })` — `const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")`; `getDocument({ data, disableWorker: true, isEvalSupported:false })`; `page.getViewport({ scale: width / viewport.width })`; `canvasFactory` дефолтный (Node); `page.render({ canvasContext, viewport }).promise`; кроп по aspect 1228/862 сверху через второй canvas; `toBuffer("image/png")`. Возвращает `{ png, width, height }`. `await doc.destroy()` в finally.
- [ ] Тест: `new jsPDF()` → `doc.text("Проба", 10, 10)` → `doc.output("arraybuffer")` → render → PNG сигнатура `89 50 4E 47`, width 1228, height 862.
- [ ] Commit: «JournalPreview: модель и рендер первой страницы PDF в PNG».

### Task 6: Cron и раздача (AC6, AC7)

**Files:** Create `src/lib/journal-preview/service.ts`, `src/app/api/cron/journal-previews/route.ts`, `src/app/api/journal-previews/[code]/route.ts`.

- [ ] `service.ts`:
  - `listPreviewCandidates(now)`: организации `id != platform` с `disabledJournalCodes`; активные документы `status:"active", dateFrom<=now<=dateTo` c `select { id, organizationId, templateId, updatedAt, template:{code} }`; существующие превью `select { organizationId, code, documentId, sourceUpdatedAt, renderedAt }`. Возвращает `{ toRender: Array<{orgId, code, documentId, updatedAt}>, toDelete: string[] }` (сортировка: без превью первыми, потом по `renderedAt asc`; toDelete — код отключён или документа нет и `renderedAt < now-30d`).
  - `renderOne(c)`: `generateJournalDocumentPdf({ documentId, organizationId })` → `renderPdfFirstPageToPng` → `db.journalPreview.upsert` по `organizationId_code`.
  - `runJournalPreviewCron({ limit=60, budgetMs=240_000 })` → `{ rendered, failed, skipped, deleted, ms }`.
  - `getJournalPreviewMap(orgId)` → `Map<string, string>` code→`/api/journal-previews/${code}?v=${renderedAt.getTime()}`.
- [ ] Cron роут по шаблону `print-cleanup`. Раздача: `requireAuth` → `getActiveOrgId` → `findUnique({ organizationId_code })` → 404 / PNG с `Cache-Control: private, max-age=31536000, immutable`.
- [ ] Commit: «Cron рендера превью журналов и раздача PNG».

### Task 7: Потребители превью (AC8)

**Files:** `dashboard/page.tsx`, `journals/page.tsx`, `journals-browser.tsx`, `settings/journals/page.tsx`, `journals-settings-client.tsx`.

- [ ] Во всех трёх страницах: `const previews = await getJournalPreviewMap(orgId)`; в items добавить `previewUrl: previews.get(code) ?? null`.
- [ ] Dashboard: `src={item.previewUrl ?? `/journal-samples/${item.code}.png`}`, условие показа `item.previewUrl || SAMPLE_CODES.has(code)`.
- [ ] Browser: `JournalTemplateListItem.previewUrl?: string|null`; `hasSample || previewUrl`.
- [ ] Settings client: тип items + `renderPreview(item.previewUrl ?? sample, …)`.
- [ ] Commit: «Карточки журналов показывают снимок реального документа».

### Task 8: Финал (AC9, AC10)

- [ ] `npm run typecheck`, `npm run lint`, `npm test`.
- [ ] Playwright-скриншоты: дашборд 390px и 1440px, `/journals`, модалка партнёрства → `.agent/tasks/dashboard-polish-partner-previews-2026-09/`.
- [ ] `whats-new-notes.ts`: пункты + SHA после коммита.
- [ ] Crontab прода: `*/10 * * * * curl -s -m 280 -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3002/api/cron/journal-previews`.
- [ ] Push, дождаться деплоя, `curl` крона на проде → `ok`. Evidence в `.agent/tasks/.../evidence.md`.
