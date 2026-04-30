# Evidence: Telegram Mini App Polish

Task ID: `telegram-mini-app-polish-2026-04-24`
Date: 2026-04-24
Verdict: PASS

## Acceptance Criteria

### AC1
Status: PASS

Telegram CTAs now use `web_app` markup for first-party Mini App openings:

- `/start` replies use a Mini App button via `buildTelegramWebAppKeyboard`.
- employee task notifications use Telegram Web App markup in `notifyEmployee`.
- legacy staff rebind invite flow sends the Mini App button after successful binding.
- inline query results are built through `buildInlineMiniAppResults` with `web_app` buttons.
- `t.me` deep links remain plain URL links because they are Telegram bot deep links, not Mini App pages.

### AC2
Status: PASS

The repo now includes `scripts/setup-telegram-bot.ts` and `npm run setup:telegram-bot`.
The script configures bot name, short description, long description, command menu,
default Web App menu button, and profile image. Setup functions are idempotent and test-covered.

### AC3
Status: PASS

Mini App first-party navigation remains inside `/mini`. Dashboard-only report links now route
through `/mini/open`, which explains the full-cabinet limitation inside Telegram instead of
forcing an external browser jump.

### AC4
Status: PASS

Mini App shell was refreshed with a WeSetup top brand bar, icon bottom navigation, Telegram
runtime theme setup, refined cards, loading/error states, scanner/staff/equipment styling,
and new Mini App/bot icon assets.

### AC5
Status: PASS

Focused tests and verification checks completed successfully.

## Verification

- Unit tests: PASS, 27/27.
  Raw artifact: `raw/tests.txt`
- Targeted ESLint on touched files: PASS.
  Raw artifact: `raw/lint.txt`
- TypeScript check: PASS.
  Raw artifact: `raw/tsc.txt`
- Production build: PASS.
  Raw artifact: `raw/build.txt`
- Live bot setup attempt: BLOCKED, current local env has no `TELEGRAM_BOT_TOKEN`.
  Raw artifact: `raw/setup-telegram-bot.txt`
- HTTP probe for `/mini/open`: PASS, `200 OK`.
  Raw artifact: `raw/http-mini-open.txt`
- Mobile screenshot captured at 390x844.
  Raw artifact: `raw/mini-open-390.png`
- Git status snapshot and diff captured.
  Raw artifacts: `raw/git-status.txt`, `raw/diff.txt`

## Notes

- Telegram chat wallpaper/background customization is not implemented because the Bot API does not expose a method for bots to set a user's chat background.
- The live Telegram bot profile was not mutated during verification because the current local environment has no `TELEGRAM_BOT_TOKEN`. The repository now contains the setup script that performs that change when run with the production bot token.
- The worktree contains unrelated pre-existing modified/untracked files. They were not reverted.
