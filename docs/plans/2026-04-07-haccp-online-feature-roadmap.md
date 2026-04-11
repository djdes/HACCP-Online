# HACCP-Online Feature Roadmap

**Date:** 2026-04-07
**Author:** Codex
**Status:** Recommended roadmap based on current codebase

---

## 1. Product North Star

HACCP-Online should evolve from "electronic journals" into a daily execution system for food production compliance and operational control.

That means the best features are not just new forms. The best features:

- reduce missed actions
- improve traceability
- make audits easier
- shorten the path from deviation to corrective action
- give owners and technologists one operational control surface

---

## 2. Prioritization Logic

I ranked features using four criteria:

- business value for food production clients
- leverage on code that already exists
- differentiation versus generic form systems
- likelihood that one developer can ship a meaningful first version fast

---

## 3. Priority Now

## 3.1 Document-Based Journal Workspace

**Priority:** Highest  
**Why now:** The schema, APIs, and list UI are already partially in place.

### Problem

Some journals are naturally document-shaped, not event-shaped. Hygiene and staff-check forms often need:

- one document per period
- rows for employees
- columns for dates
- printable grid output

### Why this is strategically strong

- directly matches real paper journal behavior
- increases auditor trust
- differentiates the product beyond "dynamic forms"
- uses the `JournalDocument` model already in the schema

### First version should include

- document detail page
- employee x day grid
- inline cell editing with autosave
- open/close document state
- basic print/PDF view
- support for one journal first: `hygiene`

### Future version

- auto-fill rules
- bulk actions by day or by employee
- signatures / approvals
- document templates by month / half-month / week

---

## 3.2 Compliance Center And Daily Task Board

**Priority:** Highest  
**Why now:** The data is already there, but users still have to infer what is missing.

### Problem

The product can record compliance, but it does not yet act like a control room.

Users need one place that answers:

- what must be filled today
- what is already complete
- what is late
- who owns each task
- what can be fixed right now

### First version should include

- new page `/compliance`
- list of mandatory journals due today
- status buckets: done, missing, overdue, at risk
- assignee or responsible role
- direct CTA to create/fill the missing record or document
- reuse the same logic for dashboard and cron reminders

### Why this feature matters

This is the bridge from passive recording to active execution. It will increase daily usage and perceived value much more than another standalone module.

---

## 3.3 Traceability Graph For Batches

**Priority:** High  
**Why now:** `Batch`, `JournalEntry`, `LossRecord`, `ChangeRequest`, and CAPA entities already exist.

### Problem

The product stores operational facts, but it does not yet show the chain between them.

Clients in food production care about:

- where a batch came from
- what incoming control was attached
- where it was used
- whether it was written off
- whether any deviation or CAPA touched it

### First version should include

- batch timeline
- link from incoming control to batch creation
- link from batch to loss records and CAPA tickets
- reverse lookup: show all affected batches for a deviation

### Why this is valuable

- directly supports audit readiness
- makes the batch module much more than a list with statuses
- increases product defensibility in production environments

---

## 4. Priority Next

## 4.1 Supplier Quality Scorecards

**Priority:** High  
**Why next:** Incoming control, products, OCR, and batch intake are already present.

### What it unlocks

- supplier rejection rate
- packaging defects by supplier
- expiry risk by supplier
- top problematic SKUs
- automatic supplier reliability scoring

### Why it matters

This turns journal data into management insight. It also makes the OCR and incoming control features feel like part of one system.

---

## 4.2 Training And Medical Clearance Lifecycle

**Priority:** Medium-High  
**Why next:** `StaffCompetency` and hygiene-related logic already exist.

### What it should become

- training matrix with renewal reminders
- medical book / certification expiration tracking
- employee readiness status
- links between competency, hygiene clearance, and permitted tasks

### Why it matters

This expands the product from food safety records into workforce compliance.

---

## 4.3 Change Control Workflow Completion

**Priority:** Medium-High  
**Why next:** `ChangeRequest` model and creation flow already exist, but the module is incomplete.

### Missing pieces today

- no detail page
- weak workflow visibility
- no approval history
- no validation evidence attachment
- no release checklist

### First version should include

- `/changes/[id]`
- status timeline
- reviewer / approver actions
- test batch results
- implementation checklist

### Business value

This is especially strong for clients with recipe, process, packaging, or supplier changes.

---

## 4.4 Loss Analytics And Pareto Dashboard

**Priority:** Medium  
**Why next:** Loss records already exist, but analysis is shallow.

### Opportunity

Add:

- Pareto by category
- weekly / monthly cost trend
- area/equipment correlation
- top recurring causes
- loss to CAPA conversion

### Why it matters

This turns the "losses" module from bookkeeping into margin protection.

---

## 5. Priority Later

## 5.1 Custom Journal Designer And Template Versioning

**Priority:** Medium-Later  
**Why later:** powerful, but dangerous before workflow semantics are stabilized.

### Why it is attractive

- enterprise flexibility
- upsell potential
- lower implementation cost for niche clients

### Why not now

If you introduce full template customization before stabilizing document mode, compliance logic, and reporting rules, you will multiply edge cases too early.

---

## 5.2 Full Mercury Integration

**Priority:** Later  
**Why later:** The stub is present, but the operational backbone still needs finishing first.

### When it becomes worth doing

After:

- batch genealogy is working
- incoming control is strongly linked to batch flow
- evidence and audit trails are complete

---

## 5.3 Multilingual Rollout

**Priority:** Later  
**Why later:** dictionaries exist, but product behavior is still more important than language coverage.

### Notes

The repo already has `ru`, `kk`, and `uz` dictionaries, but they are not wired into the UI. This is a strong future growth path for CIS expansion, just not the best next engineering investment.

---

## 6. Features I Recommend Not Chasing Immediately

- native mobile app
- advanced AI recommendations everywhere
- full white-labeling
- deep BI/report builder
- broad external ERP integrations

Reason:

Each of these is more valuable after the compliance core, document workflows, and traceability layer are finished.

---

## 7. Recommended Order

### Wave 1

1. Document-Based Journal Workspace
2. Compliance Center
3. Batch Traceability Graph

### Wave 2

1. Supplier Quality Scorecards
2. Training And Medical Clearance Lifecycle
3. Change Control Workflow Completion

### Wave 3

1. Loss Analytics
2. Template Versioning
3. Mercury Integration
4. Multilingual Rollout

---

## 8. One-Sentence Summary

The product does not need more width first; it needs stronger completion and stronger links between the width it already has.
