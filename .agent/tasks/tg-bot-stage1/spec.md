# TG Bot Stage 1 — Plumbing + Auth

**Source of truth:** [docs/superpowers/specs/2026-04-18-telegram-mini-app-v1-design.md](../../../docs/superpowers/specs/2026-04-18-telegram-mini-app-v1-design.md)

**Goal:** First shippable slice of the Telegram Mini App. A manager can issue a TG-only invite; the invited worker taps a `t.me/<bot>?start=inv_<token>` link and lands on a stub `/mini` page that greets them by name. No journals, no photos, no offline, no push — those are Stages 2–6.

## In scope

- New Prisma model `BotInviteToken`.
- Extend invite UI with a "TG-only (без пароля)" toggle; on submit return URL + QR, no email sent.
- New API route `POST /api/users/invite/tg` — creates User + BotInviteToken, returns `{ inviteUrl, qrPngDataUrl }`.
- New API route `POST /api/telegram/webhook` — grammy dispatcher, secret-token validated.
- New grammy handler for `/start inv_<token>` — validate token, bind `telegramChatId`, activate user, reply with Mini App Web App button.
- New NextAuth Credentials provider `"telegram"` — accepts `initData` string, verifies HMAC against `TELEGRAM_BOT_TOKEN`, looks up User by `telegramChatId`, issues session.
- New route group `(mini)` with minimal `layout.tsx` and `page.tsx`. Stub reads `Telegram.WebApp.initData`, calls `signIn("telegram")`, then displays `Привет, {name}`.
- New lib utilities: `src/lib/bot-invite-tokens.ts` (mirror of `invite-tokens.ts`), `src/lib/telegram-init-data.ts` (HMAC verify), `src/lib/bot/*` (grammy composer + handlers).
- Add `qrcode` dep for server-side QR PNG generation.

## Out of scope (future stages)

Journals, photos, offline retry, push, document grids, shift view, profile page, approval/finalize, reports, everything under `/changes|/plans|/losses|/capa|/competencies|/sanpin|/reports|/settings/*` beyond the invite flow itself.

## Acceptance criteria

- **AC1** Manager issues a TG-only invite via `POST /api/users/invite/tg` and receives `{ inviteUrl, qrPngDataUrl }`. `User` is created with `isActive=false` and `passwordHash=""`, `BotInviteToken` is created with 7-day TTL.
- **AC2** Opening the `t.me/...` URL and tapping `/start inv_<token>` in the bot binds `User.telegramChatId = tg_user.id`, sets `isActive=true`, marks token `consumedAt=now`, and replies with a Web App inline button.
- **AC3** Direct browser access to `/mini` without a Telegram `initData` shows a clean "Откройте внутри Telegram" screen (no crash, no home screen).
- **AC4** Submitting a valid `initData` to the `telegram` NextAuth provider issues a session cookie. `getServerSession(authOptions)` returns the bound User with correct `organizationId` and `role`.
- **AC5** `prisma generate` succeeds and `tsc --noEmit` has zero new errors attributable to this change.

## Non-goals / explicit constraints

- Do NOT touch middleware behaviour for `/root/*`; `/mini/*` is already passed through by the current middleware — no middleware change required.
- Do NOT change the existing `/api/users/invite` route (password-based flow stays as-is). TG invite is a separate sibling route.
- Do NOT change existing NextAuth behaviour for password users — `telegram` provider is additive.
- Do NOT build QR client-side; server returns a PNG data URL so the UI has one source of truth.
- Do NOT add a Service Worker — this stage has no offline requirement.
