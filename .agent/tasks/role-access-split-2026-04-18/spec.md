# Role Access Split

## Summary

Tighten role-based access so that:

- the broken `Отвязать TG` label in staff settings renders normally
- a regular employee on the website gets journal-only access
- a manager or root user on the website keeps full access
- a regular employee in Telegram Mini App/bot gets journal-only access
- a manager or root user in Telegram Mini App/bot keeps full access

## Observed Problems

- The new `Отвязать TG` action in staff settings contains mojibake text instead
  of readable Russian.
- Website access is inconsistent: some settings pages are guarded, but header
  navigation and hub pages still expose broader sections.
- Mini App currently shows `Главная / Смена / Профиль` for everyone, even
  though the requested behavior is stricter for employees.
- Telegram start CTA is not role-aware; it always opens a generic “cabinet”.

## Constraints

- Do not weaken existing journal ACL behavior.
- Keep managers/root on the current broad feature set.
- Do not ask the user follow-up questions; choose the strictest reasonable
  interpretation.
- Prefer a centralized role-access helper over scattered repeated conditions.

## Chosen Design

- Add a small pure helper module that defines:
  - whether a user has full workspace access
  - whether a web pathname is allowed for staff
  - whether a Mini App pathname is allowed for staff
  - the correct home href / CTA label for staff vs management
- Use that helper in:
  - dashboard header nav visibility
  - middleware redirects for restricted website sections
  - Mini App nav + direct page guards
  - Telegram `/start` success CTA label
- For staff, the website allows only `/journals` and nested journal pages.
- For staff, Mini App allows only `/mini` and `/mini/journals/*`.
- For managers/root, behavior remains unchanged.

## Acceptance Criteria

### AC1. `Отвязать TG` label is readable

- The staff settings unlink buttons render normal Russian text.
- No mojibake remains in the employee row action or bulk toolbar action.

### AC2. Website is journal-only for staff

- A non-management employee cannot access `/settings` or nested settings pages.
- A non-management employee cannot access non-journal dashboard sections like
  `/dashboard`, `/reports`, `/plans`, `/changes`, `/losses`, `/batches`,
  `/competencies`, `/capa`, `/sanpin`.
- Staff header/nav does not expose settings or other blocked sections.
- Staff can still access `/journals` and nested journal pages.

### AC3. Website remains fully available for management

- `manager`, `head_chef`, and `root` still see the broader workspace nav.
- Their existing settings/dashboard access remains intact.

### AC4. Mini App / bot is journal-only for staff

- A non-management employee in Mini App only gets journal access surfaces.
- Direct visits to `/mini/shift` and `/mini/me` redirect staff back to `/mini`.
- Telegram `/start` success button for staff is journal-oriented.

### AC5. Mini App / bot remains broad for management

- Management users still see the broader Mini App nav.
- Telegram `/start` success button for management still opens the broader
  cabinet experience.

## Verification Plan

- Add red tests for centralized role-access decisions.
- Run targeted tests for access helper plus existing TG tests.
- Run targeted lint on touched files.
- Run `tsc --noEmit`.
- Run `npm run build`.
