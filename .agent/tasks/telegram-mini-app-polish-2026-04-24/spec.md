# Task Spec: Telegram Mini App Polish

Task ID: `telegram-mini-app-polish-2026-04-24`
Date: 2026-04-24
Status: Frozen for implementation

## Goal

Make the Telegram bot and Mini App feel like the primary mobile WeSetup surface:
links from Telegram should open inside the Mini App whenever Telegram supports it,
the bot profile/menu should be configurable from the repo, and the Mini App shell
should look like a polished WeSetup product instead of a plain mobile fallback.

## Constraints

- Preserve existing invite, bind, `/start`, `/stop`, Mini App auth, and obligation flows.
- Do not attempt to set a Telegram chat background; the Bot API does not expose that.
- Do not rebuild the entire dashboard in one pass. Add the mobile parity layer that already
  fits the existing Mini App routes.
- Keep all new user-facing text in Russian.
- Keep changes scoped to Telegram bot, Mini App UI, and their focused tests/scripts.

## Acceptance Criteria

### AC1
All first-party Telegram CTAs that open WeSetup use Telegram `web_app` buttons where supported,
including bot start replies, employee notifications, staff rebind invites, and inline-query
results. Plain `url` buttons remain only for non-Mini-App `t.me` deep links.

### AC2
The repo contains an idempotent bot setup script that configures:
bot name, short description, long description, command menu, default Web App menu button,
and a WeSetup profile image through Bot API methods.

### AC3
Mini App navigation stays inside the Mini App for first-party pages. Dashboard-only links are
routed through a `/mini/open` bridge that explains when a section is available only in the full
web cabinet instead of silently throwing the user into an external browser.

### AC4
The Mini App shell has a WeSetup-branded visual refresh:
top brand bar, better bottom nav with lucide icons, theme-aware Telegram setup, refined loading
and error states, and softer WeSetup color tokens.

### AC5
Focused tests cover the new Telegram Web App markup and Mini App URL helpers. Targeted lint,
TypeScript check, and production build complete successfully or any unavoidable failure is
recorded with exact cause.

## Out of Scope

- Full feature parity for every dashboard page in Mini App.
- Payment flow inside Telegram.
- Telegram chat wallpaper/background customization.
- Real-device Telegram WebView QA.

## Verification Plan

- Unit tests for bot reply builders, inline result builders, Telegram markup helpers, and Mini
  URL helpers.
- Targeted ESLint on touched files.
- `npx tsc --noEmit --pretty false`.
- `npm run build`.
- Evidence files under `.agent/tasks/telegram-mini-app-polish-2026-04-24/`.
