# Telegram Mini App for HACCP-Online — v1 Design

**Date:** 2026-04-18
**Status:** Draft (approved section-by-section during brainstorming, awaiting full-spec review)
**Target users v1:** Line workers (role: `cook`, `waiter`) who do daily journal entries on shift
**Explicitly out of scope v1:** Landing, site login/register screens, manager/owner approval flows, ROOT panel, reports/PDF, billing/tariffs, changes/plans/losses/capa/competencies/sanpin/settings pages (v2+)

---

## 1. Goal

Give HACCP-Online line workers a Telegram-native way to do every on-shift task they do today on the web dashboard, without ever touching the desktop site or remembering an email+password. Everything they do in the bot writes to the same database as the web app — no data divergence, no sync layer.

---

## 2. Key decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| D1 | Telegram **Mini App (Web App)**, not a native keyboard-driven bot | Reuses existing Next.js UI and APIs; ~10× less work than replicating every dashboard screen as TG keyboards. Competitor does this too. |
| D2 | v1 built **for the line worker**, not for managers | Biggest volume of daily actions. Managers get v2. |
| D3 | Scope = **Option C** from brainstorming: daily journals + photo/scan capture + push w/ actions + offline retry + batch hygiene + shift view + document (grid) journals | The minimum that covers a full shift end-to-end; anything less forces them back to desktop. |
| D4 | Entry flow = **TG-first invite**: manager generates a `t.me/BOT?start=inv_<token>` link, worker taps once, they're in. No password, no email, no site visit. | One-tap onboarding. Line workers often don't have company email. TG's signed `initData` is our trust anchor. |
| D5 | Mini App lives **inside the same Next.js app** under route group `(mini)` | Single DB, single Prisma, single `hasJournalAccess` ACL, single deploy pipeline. |

---

## 3. Architecture

### 3.1 Route layout (new)

```
src/app/(mini)/
  layout.tsx                              # Mini-App chrome (no dashboard nav, TG-styled)
  page.tsx                                # /mini — home "На сегодня"
  journals/[code]/page.tsx                # journal entry list
  journals/[code]/new/page.tsx            # new dynamic entry
  journals/[code]/document/[docId]/page.tsx  # grid (document) journal
  shift/page.tsx                          # /mini/shift — shift & positions
  me/page.tsx                             # /mini/me — minimal profile + unlink
```

### 3.2 Middleware

`src/middleware.ts` gets an exemption: `/mini/*` is NOT redirected to `/login` when unauthenticated. Auth is validated client-side via `Telegram.WebApp.initData` inside the Mini App layout, then a NextAuth session cookie is issued. Direct browser access (no `initData`) → Mini App shows a short "только внутри Telegram" screen.

### 3.3 Auth

- New NextAuth **Credentials provider** named `"telegram"`. Credential = raw `initData` string.
- Provider verifies the TG `hash` parameter: `HMAC-SHA256(initData_without_hash, SHA256("WebAppData" || TELEGRAM_BOT_TOKEN))`.
- Anti-replay: `initData.auth_date` must be within 24 h; older = reject.
- On success: look up `User` by `telegramChatId` = parsed `tg_user.id` (for private chats `chat_id == user_id`, this field already exists in schema).
- If user not found → return 401 + message "Свяжите аккаунт через приглашение". No auto-provisioning inside Mini App — provisioning only happens in the bot `/start <token>` handler (§4).

### 3.4 Bot webhook

- New directory `src/lib/bot/` with: `handlers/start.ts`, `handlers/index.ts`, `bot-app.ts` (grammy composer).
- Route `src/app/api/telegram/webhook/route.ts` — if it exists, extended; otherwise created. Validates `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` then dispatches to the composer.
- Only handler v1 needs: `/start inv_<token>` — see §4.

### 3.5 Tech choices

- Telegram SDK for client: `@twa-dev/sdk` (official TS wrapper around `window.Telegram.WebApp`) **or** raw `window.Telegram.WebApp`. Pick at implementation time.
- Bot library: `grammy` (already a dep).
- Form validation: reuse existing Zod schemas from `src/lib/validators.ts`.
- No new state library — keep TanStack Query if already used, else `useSWR`. Match existing dashboard.

---

## 4. TG-first invite flow

### 4.1 On the site (manager)

New mode on the existing "Пригласить сотрудника" modal: toggle **"TG-only (без пароля)"**. When selected:

1. Manager enters ФИО + role (`cook`/`waiter`) + journal access list.
2. `POST /api/users/invite?mode=tg` creates:
   - `User` (`isActive=false`, `role` as chosen, `passwordHash=""`, `organizationId` from session, `telegramChatId=null`).
   - `BotInviteToken`: `{ id, organizationId, userId, tokenHash: SHA-256(raw), expiresAt: now+7d, consumedAt: null }`.
3. API returns `{ inviteUrl: "https://t.me/<bot>?start=inv_<raw>", qrPngDataUrl }`.
4. Modal shows URL + QR. Manager shares however (WhatsApp, SMS, show screen). No email sent.

### 4.2 In Telegram (worker)

1. Worker taps the link → TG opens chat with bot → worker taps "Start" (TG auto-injects `/start inv_<raw>`).
2. Bot `/start` handler:
   - Decode `inv_<raw>`, SHA-256, lookup `BotInviteToken` by hash; reject if not found / expired / already consumed.
   - Set `User.telegramChatId = msg.from.id` (as string), `User.isActive = true`.
   - Set `BotInviteToken.consumedAt = now`.
   - Reply with: "Готово, {User.name}. Открой рабочий кабинет:" + inline `web_app` button → `https://wesetup.ru/mini`.
3. Worker taps the Web App button → Mini App opens in TG webview → client reads `window.Telegram.WebApp.initData` → `signIn("telegram", { initData })` → NextAuth session cookie set → redirect to `/mini`.

### 4.3 Existing users (already have password, want to add TG)

Kept unchanged: `/settings/notifications` → "Связать TG" → existing link-token flow (`generateLinkToken` in [src/lib/telegram.ts](../../src/lib/telegram.ts)). No regression.

### 4.4 Edge cases

- Direct browser access to `/mini` without TG → 403 "Откройте этот раздел в Telegram".
- `telegramChatId` not linked to any User → 401 + "Свяжите аккаунт через приглашение".
- TG `initData` older than 24 h → 401 + silent re-auth from client (read fresh initData from WebApp, retry).

---

## 5. Screens

All screens are russian-language, mobile-first, TG-themed (light/dark follows `Telegram.WebApp.colorScheme`). Style inherits from existing `hygiene-document-client.tsx` family but denser for thumbs.

### 5.1 `/mini` — «На сегодня» (home)

- Header: `Привет, {firstName}` + org name small.
- Section **«Сделать сегодня»**: journals where today's scheduled entry is missing/partial. Card per journal, colored status pill: red (не заполнено) / yellow (частично) / green (готово).
- Section **«Все мои журналы»**: everything else in ACL. Flat list.
- Footer: one button "Смена" → `/mini/shift`.

### 5.2 `/mini/journals/[code]` — journal entry list

- Last 7 days of entries, compact cards (date + 1–2 key fields).
- Sticky bottom CTA: "+ Новая запись" → `/mini/journals/[code]/new`.
- If journal is a document-journal → this page redirects to the current-month `document/[docId]` view.

### 5.3 `/mini/journals/[code]/new` — dynamic entry

- Renders `JournalTemplate.fields` (same JSON schema as dashboard) with a mobile-adapted renderer:
  - text → full-width input
  - number → numeric keyboard
  - date → native date picker
  - boolean → large toggle
  - select → bottom-sheet with search
  - equipment / employee → bottom-sheet with search + recent
- "📷 Приложить фото" button → `<input type="file" accept="image/*" capture="environment">` → client downscale (canvas → 1600 px long edge, JPEG q=0.8) → multipart POST `/api/journal-scans` → store returned URL in form state.
- Sticky "Сохранить" bottom. On submit: client generates `clientRequestId` (uuid) → persist payload to IndexedDB → fetch → on 2xx clear IDB; on network error keep in IDB, show "⏳ будет отправлено".

### 5.4 `/mini/journals/[code]/document/[docId]` — grid (hygiene etc.)

- Horizontal-scroll grid: rows = employees in that document, columns = days of month.
- Tap cell → bottom-sheet with the fields (e.g. hygiene has 4–5 booleans) → save → PATCH `/api/journal-documents/[id]/entries`.
- Top toolbar: "Заполнить всех сегодня одинаково" → bottom-sheet → applies to every row's today-column in one batch API call.

### 5.5 `/mini/shift` — shift & positions

- My positions today (from `staff/positions`).
- Coworkers on shift in the org (name + position).
- Read-only v1.

### 5.6 `/mini/me` — profile

- Name, email (if any), role, org.
- Button "Отвязать TG" → DELETE current user's `telegramChatId`, sign out of NextAuth, reply "готово, закройте Mini App".

---

## 6. Integration

### 6.1 ACL

Reused without changes: every journal read/write inside Mini App goes through existing API routes, which call `hasJournalAccess(userId, journalId)` from [src/lib/journal-acl.ts](../../src/lib/journal-acl.ts). LRU cache works as-is.

### 6.2 Photos / scans

- Client-side compression: 1600 px long edge, JPEG q=0.8.
- POST multipart → existing `POST /api/journal-scans` (create if missing). Storage backend unchanged.
- Scan URL is included in the journal entry payload as a normal `attachments: string[]` field (verify schema during implementation).

### 6.3 Push notifications

- New function `notifyEmployee(userId, text, action?: { label, miniAppPath })` in [src/lib/telegram.ts](../../src/lib/telegram.ts). Thin wrapper over `sendTelegramMessage` that adds an inline `reply_markup` with a `web_app` button when `action` is provided.
- Cron triggers v1 (two only):
  1. **Morning digest** — 08:00 local time of org (use `Organization.timezone` if present; default Europe/Moscow). Per worker: list of journals with pending entries for today.
  2. **Pre-deadline reminder** — 1 h before a journal's daily deadline. One message per worker per journal with the "Заполнить сейчас" WebApp button deep-linking to `/mini/journals/<code>/new`.
- Existing `notifyOrganization` (managers) untouched.
- v2 triggers (temperature deviations, expired acts, ACL changes) — not in v1.

### 6.4 Offline retry

Lightweight, no Service Worker:
- New client util `src/lib/mini/offline-queue.ts`:
  - `enqueue(request)` — stash `{ url, method, body, clientRequestId, createdAt }` in IndexedDB store `pendingEntries`.
  - `flush()` — iterate entries, POST each, on 2xx delete.
- Submit flow: always `enqueue()` first, then `flush()`. If `flush()` throws (offline), toast "⏳ будет отправлено при появлении связи".
- `window.addEventListener("online", flush)` + 30 s interval while Mini App is open.
- Server dedupes on `clientRequestId`: if a row with the same `(userId, clientRequestId)` exists, return it instead of inserting a duplicate.

### 6.5 Rate limit / anti-abuse

- initData verified in NextAuth provider (once per session).
- Additionally: critical mutations (new journal entry, document-entry update) accept an optional `initData` re-submission and re-verify if present. Not mandatory v1 — session is enough.
- `auth_date` within 24 h window enforced.

### 6.6 Telemetry

- New table `TelegramWebAppLog` (optional v1, can be deferred):
  - `id`, `userId`, `event` (`open`, `journal_submit`, `document_submit`, `scan_upload`), `payload` (jsonb), `createdAt`.
- Existing `TelegramLog` unchanged (it logs outbound messages).

---

## 7. Database changes

Additions only, no destructive migrations:

1. `BotInviteToken` table (§4).
2. (Optional v1) `TelegramWebAppLog` table (§6.6).
3. New column on `JournalEntry` / `JournalDocumentEntry`: `clientRequestId String?` + unique index `(userId, clientRequestId)` where `clientRequestId IS NOT NULL`. Used for idempotent submission from the Mini App offline queue (§6.4).

No changes to `User.telegramChatId` — already there.

---

## 8. Environment / configuration

New env vars:

- `TELEGRAM_BOT_USERNAME` — already present, reused for invite URL.
- `TELEGRAM_WEBHOOK_SECRET` — already present, reused.
- `MINI_APP_BASE_URL` — e.g. `https://wesetup.ru/mini`. Used by bot to construct Web App buttons.

Bot setup (one-time, manual or via script):

1. `setWebhook` → `https://wesetup.ru/api/telegram/webhook` with secret header.
2. `setChatMenuButton` → Web App button labelled "Кабинет", URL = `MINI_APP_BASE_URL`.
3. Bot profile: short description + commands list.

---

## 9. Out of scope for v1 (explicit)

To keep the first release shippable:

- Manager/owner approval and finalize flows
- Reports / PDF export / charts
- `/changes`, `/plans`, `/losses`, `/capa`, `/competencies`, `/sanpin`, `/reports`
- Full `/settings` (notification preferences, tariff page, etc.) — only `/mini/me` with unlink
- ROOT platform panel
- Impersonation
- Invoice / payments / tariff upgrade UI
- Service Worker (true offline-first)
- Language switching (ru only)
- Deep-linking to specific entry edit (only to "new entry" screens)
- Voice input / OCR of scans from inside the Mini App (OCR API exists server-side; not wired to Mini App)

---

## 10. Risks & open questions

1. **TG webview file upload quirks on iOS** — `<input capture>` mostly works, but specific TG iOS versions may disallow direct camera. Fallback: library picker. Verify at implementation with device test.
2. **initData 24 h TTL vs long shifts** — if a worker opens Mini App at 09:00 and uses it all day, NextAuth session is valid but initData itself will expire. Session-based auth is the source of truth; initData is only for initial sign-in. This is intentional.
3. **Org timezone for morning digest** — the current schema may not carry `Organization.timezone`. Need to verify; if absent, default to Europe/Moscow in v1 and add the column in v2.
4. **`/api/journal-scans` may or may not exist** — verify during plan phase; create if missing using same patterns as other upload endpoints.
5. **Route-group `(mini)` + middleware interaction** — Next.js 16 middleware runs before route groups; rule exemption must use path prefix `/mini`, not group name. Verify.
6. **`BotInviteToken` vs existing `InviteToken`** — intentionally separate because semantics differ. Do not try to consolidate; the two flows will keep coexisting.
7. **Hygiene-client red-line status** — per memory, the "do not touch" rule on `hygiene-*-client.tsx` was lifted 2026-04-17, so the Mini App document journal can reuse hygiene styling/logic without guardrail.

---

## 11. Delivery plan (high-level — detailed plan via writing-plans skill)

Staged to let each stage be independently valuable and testable on prod.

- **Stage 1 — Bot plumbing + auth.** `BotInviteToken` schema, `/api/telegram/webhook` route, `/start <token>` handler, NextAuth `telegram` provider, middleware exemption. Deliverable: an invited worker can tap the link and land on a stub `/mini` page that says "Привет, {name}".
- **Stage 2 — Home + basic journal entry.** `/mini` home, journal list, dynamic entry form (no photos, no offline yet), API reuse. Deliverable: worker can open Mini App and fill a simple journal end-to-end.
- **Stage 3 — Photos + offline queue.** Client-side image compression, upload to `/api/journal-scans`, IndexedDB queue with retry. Deliverable: flaky-connection shift still captures data.
- **Stage 4 — Document (grid) journals + batch.** Grid renderer, cell bottom-sheet, "fill all today" batch API. Deliverable: hygiene journal usable from phone.
- **Stage 5 — Push triggers.** Morning digest cron, pre-deadline reminder cron, `notifyEmployee` helper. Deliverable: worker gets nudges at 08:00 + before deadlines.
- **Stage 6 — Shift + profile screens.** `/mini/shift`, `/mini/me`, "Отвязать TG". Deliverable: v1 done, ready for pilot.

Each stage → its own `.agent/tasks/<id>/` proof-loop cycle per root `CLAUDE.md`.

---

## 12. Acceptance criteria for v1 (what "done" means)

- **AC1** A manager can issue a TG-only invite from the site and share a `t.me/<bot>?start=...` link.
- **AC2** Tapping the link from a fresh Telegram user, once, results in a working Mini App session; no passwords, no email.
- **AC3** Worker can open Mini App and see a home screen listing today's missing journal entries.
- **AC4** Worker can fill and submit a standard journal entry (all field types) from Mini App. Submission appears in the dashboard view for managers immediately.
- **AC5** Worker can attach a photo from the camera; the photo is compressed client-side and stored via the existing scan pipeline; it's visible when the same entry is opened on desktop.
- **AC6** Worker can fill a grid-document journal (hygiene) per cell and via "fill all today" batch.
- **AC7** On flaky network: submitting a journal entry while offline queues it; it submits automatically when connectivity returns; no duplicate row appears if the request briefly succeeded before the client saw the error (dedupe via `clientRequestId`).
- **AC8** Worker receives a morning digest at 08:00 listing today's pending journals; tapping an inline button opens the corresponding Mini App entry screen.
- **AC9** ACL correctness: worker sees and can act only on journals granted via `UserJournalAccess` / management override; parity with web dashboard.
- **AC10** Direct browser access to `/mini` (no TG initData) returns a clean "только в Telegram" screen, not a crash and not the home screen.

Each AC becomes a verifier check during proof-loop stages.
