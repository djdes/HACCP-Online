# Journal Tariffs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move journal tariff composition into one shared catalog and reuse it in seed data and subscription plan descriptions.

**Architecture:** Add a shared journal catalog module with `basic` and `extended` tariff groupings. Derive active seed order and tariff-facing copy from that module so counts and ordering stay synchronized.

**Tech Stack:** TypeScript, Next.js, Prisma seed script

---

### Task 1: Shared Journal Catalog

**Files:**
- Create: `src/lib/journal-catalog.ts`

- [ ] Add the shared ordered journal catalog with `basic` and `extended` tariff groupings.
- [ ] Export derived arrays for active journals, basic journals, and extended-only journals.

### Task 2: Seed Integration

**Files:**
- Modify: `prisma/seed.ts`

- [ ] Replace the inline `ACTIVE_JOURNAL_TEMPLATES` list with the shared export from `src/lib/journal-catalog.ts`.
- [ ] Keep existing seed behavior unchanged apart from tariff-aware ordering.

### Task 3: Plan Copy Integration

**Files:**
- Modify: `src/lib/plans.ts`

- [ ] Replace hard-coded journal-related feature text with copy derived from the shared journal catalog.
- [ ] Keep non-journal plan behavior unchanged.

### Task 4: Verification

**Files:**
- Verify: `src/lib/journal-catalog.ts`
- Verify: `prisma/seed.ts`
- Verify: `src/lib/plans.ts`

- [ ] Run `npx tsc --noEmit`.
- [ ] Run a small `tsx` check to confirm `basic` has 13 journals and `extended` has all journals.
