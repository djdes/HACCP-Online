# TG Bot Stage 1 — Evidence

**Scope:** first shippable slice of the Telegram Mini App plumbing + auth.
**Spec:** [./spec.md](./spec.md) · **Design:** [../../../docs/superpowers/specs/2026-04-18-telegram-mini-app-v1-design.md](../../../docs/superpowers/specs/2026-04-18-telegram-mini-app-v1-design.md)

## Files created

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` (edit) | New `BotInviteToken` model + back-refs on `User` and `Organization`. |
| `src/lib/bot-invite-tokens.ts` | Token gen (prefixed `inv_`), SHA-256 hash, 7-day TTL, `buildBotInviteUrl()`. |
| `src/lib/telegram-init-data.ts` | HMAC-SHA256 verification of `Telegram.WebApp.initData`, 24 h replay window. |
| `src/lib/bot/bot-app.ts` | Grammy `Bot` + `Composer` singleton with DNS/apiRoot overrides mirroring outbound path. |
| `src/lib/bot/handlers/start.ts` | `/start inv_<token>` handler: validate, bind `telegramChatId`, activate, reply with Web App button. |
| `src/app/api/telegram/webhook/route.ts` | POST handler, validates `X-Telegram-Bot-Api-Secret-Token` vs `TELEGRAM_WEBHOOK_SECRET`, dispatches to grammy. |
| `src/app/api/users/invite/tg/route.ts` | POST invite endpoint; creates `User` + `BotInviteToken`, returns `{ inviteUrl, qrPngDataUrl, expiresAt }`. |
| `src/lib/auth.ts` (edit) | New NextAuth Credentials provider `"telegram"` — verifies initData, looks up User by `telegramChatId`. |
| `src/app/(mini)/layout.tsx` | Mini App layout: loads `telegram-web-app.js`, wraps in `MiniSessionProvider`. |
| `src/app/(mini)/_components/mini-session-provider.tsx` | SessionProvider tolerating `null` session (needed before first sign-in). |
| `src/app/(mini)/_components/telegram-web-app.ts` | Minimal typed surface + `getTelegramWebApp()` helper; augments `Window` type. |
| `src/app/(mini)/page.tsx` | Client page: detect TG, call `signIn("telegram", { initData })`, greet by name; fallback screens for no-TG / sign-in error. |
| `src/components/settings/invite-user-dialog.tsx` (edit) | Added "Telegram без пароля" mode tab; on submit shows QR + copyable URL. |
| `package.json` / `package-lock.json` (edit) | Added `qrcode` + `@types/qrcode`. |

## Acceptance-criteria validation

| AC | Status | How |
|----|--------|-----|
| **AC1** Manager issues TG-only invite and gets URL + QR | PASS (code-level) | `POST /api/users/invite/tg` validates role/name, creates `User{isActive=false, passwordHash=""}` + `BotInviteToken{tokenHash, expiresAt=now+7d}` in a transaction, returns `{ inviteUrl, qrPngDataUrl, expiresAt }`. |
| **AC2** `/start inv_<token>` binds `telegramChatId`, activates, marks token consumed, replies with Web App button | PASS (code-level) | `src/lib/bot/handlers/start.ts` does all four in a single transaction, then replies with an inline `web_app` button whose URL is derived from `MINI_APP_BASE_URL` or `NEXTAUTH_URL`. |
| **AC3** Direct browser access to `/mini` shows a clean "Откройте в Telegram" screen | PASS (code-level) | Client `page.tsx` checks `getTelegramWebApp()?.initData`; absence path renders a centred advisory and stops. No crash, no redirect to `/login`. |
| **AC4** Valid initData yields a NextAuth session, `getServerSession(authOptions)` returns bound User | PASS (code-level) | `authOptions.providers[]` now includes a `telegram` `CredentialsProvider` that calls `verifyTelegramInitData`, looks up `User` by `telegramChatId`, returns the standard `{ id, email, name, role, organizationId, organizationName, isRoot }` shape consumed by existing `jwt` / `session` callbacks. |
| **AC5** `prisma generate` succeeds, `tsc --noEmit` clean | PASS | `prisma generate` exit code 0 (background task `bdmsrhif3` completed). `npx tsc --noEmit` exit code 0 with zero output. |

## Verifications run

- `npx prisma generate` — exit 0.
- `npx tsc --noEmit` — exit 0, no errors.
- `npm run lint` — 8 errors total, **all pre-existing** (none under `src/app/(mini)`, `src/lib/bot*`, `src/app/api/telegram`, `src/app/api/users/invite/tg`, or the edited `invite-user-dialog.tsx`). Delta from baseline: −1 error (−1 in mini/page.tsx after fixing the React 19 `set-state-in-effect` finding).

## What's NOT done and belongs to Stage 2+

- Webhook registration (`setWebhook` call) — one-time manual task per `docs/superpowers/specs/2026-04-18-telegram-mini-app-v1-design.md §8`.
- Any journal / document / photo / push functionality — explicitly out of scope.
- End-to-end test with a live Telegram account — requires production env (bot token, public HTTPS endpoint). Plan: exercise during Stage 1 deploy rehearsal on `master`.

## Known open items (carried forward to Stage 2)

- `Organization.timezone` column — not present in schema. Morning digest cron will default to Europe/Moscow in Stage 5; confirm or add column at that stage.
- `clientRequestId` unique index on `JournalEntry` / `JournalDocumentEntry` — deferred to Stage 3 (when offline queue lands).

## Env keys required for a live smoke test

- `TELEGRAM_BOT_TOKEN` (existing)
- `TELEGRAM_BOT_USERNAME` (existing)
- `TELEGRAM_WEBHOOK_SECRET` (existing)
- `NEXTAUTH_URL` (existing) — fallback for `MINI_APP_BASE_URL`
- `MINI_APP_BASE_URL` (new, optional) — if set, used instead of `${NEXTAUTH_URL}/mini`

## Post-deploy manual steps

1. Set webhook: `POST https://api.telegram.org/bot<TOKEN>/setWebhook` with `url=https://wesetup.ru/api/telegram/webhook`, `secret_token=<TELEGRAM_WEBHOOK_SECRET>`.
2. Optional: `setChatMenuButton` → Web App button labelled "Кабинет" → `https://wesetup.ru/mini`.
3. Create a TG-only employee via the Users page invite dialog → tap link from a test TG → confirm Mini App greets by name.
