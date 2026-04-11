# HACCP-Online Deep Analysis

**Date:** 2026-04-07
**Author:** Codex
**Status:** Draft for product and implementation planning

---

## 1. Executive Summary

HACCP-Online is no longer a narrow MVP for "electronic journals". It is already evolving into an operations platform for food production with five strong layers:

1. Electronic journal engine
2. Compliance and notifications
3. Production operations modules
4. Integrations with external systems and devices
5. Commercial SaaS shell (landing, auth, billing, subscription)

The strongest part of the product is breadth of domain coverage. The weakest part is finish quality and cohesion between modules. The repo contains several features that are already valuable, but the experience is uneven: some flows are polished, some are partial, and some are present in code but still disconnected from navigation, workflows, or acceptance criteria.

The main recommendation is simple: do not chase more horizontal breadth right now. The best leverage is to finish the operational spine that is already visible in the codebase:

- make current flows reliable
- complete the document-based journal workspace
- unify compliance logic
- connect batches, deviations, CAPA, and reports into one traceable chain

---

## 2. What Already Exists

### 2.1 Core platform

- Next.js 16 + App Router monolith
- Prisma + PostgreSQL multi-tenant model via `organizationId`
- NextAuth credentials auth
- role model: `owner`, `technologist`, `operator`
- landing, registration, login, dashboard, settings, subscription

### 2.2 Domain model

The Prisma schema already models more than a simple journal app:

- `JournalTemplate`, `JournalEntry`
- `JournalDocument`, `JournalDocumentEntry`
- `Batch`
- `CapaTicket`
- `LossRecord`
- `ProductionPlan`
- `ChangeRequest`
- `StaffCompetency`
- `AuditLog`
- products, equipment, areas, users, organizations

This is a strong foundation. The product direction is visible in the schema even where the UI is still incomplete.

### 2.3 Operational modules already present

- 18+ journal templates seeded in `prisma/seed.ts`
- dashboard with compliance, activity, alerts, IoT chart
- batch accounting and expiry control
- CAPA workflow
- loss accounting
- production planning
- change control
- competency matrix
- SanPiN knowledge base

### 2.4 Integrations already present

- Telegram notifications and account linking
- email notifications
- YooKassa payments
- Tuya IoT temperature collection
- OCR label recognition through Anthropic
- product import from Excel / CSV
- PWA shell and service worker baseline

This is the clearest signal that the product has real differentiation potential.

---

## 3. What Is Strong

### 3.1 Strong domain fit

The app is clearly written for food production, not for generic forms. The seeded journals, norms, temperature logic, CAPA categories, losses, and subscription copy are aligned around a single vertical.

### 3.2 Good speed-to-feature architecture

The JSON-based `JournalTemplate.fields` approach is a good accelerator. It allowed the product to expand journal coverage quickly without adding a new schema and UI flow for every form.

### 3.3 Multi-tenant isolation is mostly sound

Most API routes validate session and verify that the entity belongs to the current organization before updating or deleting. This is a good baseline for a B2B SaaS product.

### 3.4 Real commercial readiness signals

The codebase already includes:

- pricing plans
- payment creation and webhook validation
- invite emails
- notification preferences
- trial logic

That means the product is not just a demo. It is already moving toward sellable SaaS behavior.

### 3.5 Useful compliance knowledge layer

`src/lib/sanpin-norms.ts`, the SanPiN reference page, and inline field hints are strong assets. They move the product from "data entry" toward "guided compliant execution".

---

## 4. Highest-Risk Findings

## 4.1 Document journal flow is started but not complete

The most important current product risk is the new `JournalDocument` direction.

What I found:

- `src/app/(dashboard)/journals/[code]/page.tsx` now renders document lists
- `src/app/api/journal-documents/*` routes exist
- `src/components/journals/create-document-dialog.tsx` exists
- but there is no page at `src/app/(dashboard)/journals/[code]/documents/[id]/page.tsx`

Impact:

- the journal page now links to a route that does not exist
- the new document-based mode cannot be completed in UI
- tomorrow's work can easily branch into the wrong direction unless this is finished first

Interpretation:

This is the right feature direction, but it is currently a half-complete migration.

## 4.2 Deviation rules are inconsistent with template field names

`src/app/api/journals/route.ts` contains a deviation engine, but multiple rules do not match the seeded field names in `prisma/seed.ts`.

Examples:

- `incoming_control`: rule checks `result`, template uses `decision`
- `finished_product`: rule checks `approved`, template uses `approvedForRelease`
- `hygiene`: rule checks `admitted`, template uses `admittedToWork`
- `ccp_monitoring`: rule checks `withinLimits`, template uses `withinLimit`

Impact:

- several journal deviations most likely never trigger
- owners/technologists may believe alerting is working when it is not
- this directly weakens the product's compliance value proposition

This is a P0 functional issue.

## 4.3 The repo is not green

`npm run lint` fails.

Main blockers:

- `Date.now()` purity errors in several server-rendered pages
- `any` typing issue in `src/components/charts/temperature-chart.tsx`
- multiple unused imports / dead code warnings

Impact:

- you do not have a stable quality gate
- future changes will be slower and riskier
- tomorrow's implementation work should start from a clean baseline

## 4.4 Production build is fragile because fonts depend on external fetch

`npm run build` failed in this environment because `src/app/layout.tsx` imports `Geist` and `Geist_Mono` from `next/font/google`.

Impact:

- build is not self-contained
- offline or restricted CI/CD environments will fail
- for a compliance product on private infrastructure, this is an avoidable operational risk

Recommendation:

- move to `next/font/local` or a stable local/system stack

## 4.5 Barcode flow is inconsistent and effectively unfinished

What I found:

- `src/components/journals/barcode-scanner.tsx` expects lookup responses in a flat shape
- `src/app/api/products/lookup/route.ts` returns `{ found, product }`
- `BarcodeScanner` is not used anywhere in the UI

Impact:

- the barcode feature exists more as a promise than as a usable workflow
- this creates maintenance cost without product payoff

## 4.6 Audit logging infrastructure exists but is not wired

What I found:

- `src/lib/audit.ts` defines `logAudit`
- audit page and API exist
- search across the repo shows no actual calls to `logAudit`

Impact:

- the "journal of actions" feature is structurally present but practically empty
- for regulated workflows, this is a missed trust and evidence opportunity

## 4.7 Several modules are orphaned or intentionally incomplete

Examples:

- `src/app/(dashboard)/changes/page.tsx` explicitly notes that `/changes/[id]` is not implemented
- `src/app/(dashboard)/plans/page.tsx` explicitly notes that `/plans/[id]` is not implemented
- `changes`, `plans`, `losses`, `competencies` are absent from the main header navigation

Impact:

- the product surface area looks larger in code than in actual user experience
- adoption will skew toward the visible modules only
- the hidden modules will rot unless they are surfaced or deliberately de-scoped

## 4.8 Offline mode is only half-finished

What I found in `public/sw.js`:

- there is an offline queue for `POST /api/journals`
- there is a `sync-journals` background sync listener
- but I found no code that actually registers that sync tag

Impact:

- "offline-first" is currently a promise, not a complete guarantee
- queued records may stay queued without an explicit sync trigger

---

## 5. Product Gaps By Layer

### 5.1 Data entry is ahead of workflow orchestration

The product is good at capturing records. It is not yet equally strong at driving daily execution.

Missing center of gravity:

- what must be done today
- who is responsible
- what is overdue
- what was acknowledged
- what still blocks compliance

This is why a dedicated Compliance Center is the next natural layer.

### 5.2 Reporting is ahead of evidence management

There is PDF and Excel export, but inspector-grade document handling is still weak.

Examples:

- document-based journals are not complete
- PDF generation in `src/lib/pdf.ts` still contains English UI text
- `jsPDF` default font setup is risky for Cyrillic-heavy documents

### 5.3 Operations modules exist, but cross-links are weak

Batches, losses, CAPA, plans, and change requests exist as separate islands.

The next level of product maturity is not "more modules". It is stronger linkage between existing ones:

- deviation -> CAPA
- incoming control -> batch
- batch -> production plan
- batch -> write-off / expiry / shipment
- change request -> validation -> release

### 5.4 There is a hidden move from event logs to documents

The addition of `JournalDocument` and `JournalDocumentEntry` is strategically important.

It suggests a new product model:

- `JournalEntry` for event-style records
- `JournalDocument` for printable employee x date forms

That split is smart, because some compliance artifacts are better as discrete events, while others are better as document grids. This direction should be finished rather than abandoned.

---

## 6. Strategic Recommendation

### 6.1 Best next move

Do not add another broad horizontal module first.

The highest-leverage move is:

1. stabilize the current platform
2. complete the document-journal workflow
3. build a compliance task layer on top of existing data
4. connect traceability across batches, deviations, and actions

### 6.2 Why this path wins

Because it compounds existing assets instead of creating new disconnected ones:

- journals already exist
- notifications already exist
- batches already exist
- CAPA already exists
- norms already exist
- reports already exist

You are one strong integration layer away from a much more defensible product.

### 6.3 What not to prioritize first

These are interesting, but not the best next move right now:

- full Mercury integration
- full multilingual rollout
- native mobile app
- AI HACCP plan generation
- custom journal designer for every client

Reason:

all of them become more valuable after the operational core is reliable and cohesive.

---

## 7. Recommended Reading Order

1. `docs/plans/2026-04-07-haccp-online-feature-roadmap.md`
2. `docs/plans/2026-04-07-haccp-online-implementation-plan.md`

If you implement only one thing next, make it the completion of the document-based journal workflow after first bringing lint/build back to green.
