# HACCP-Online MVP Design Document

**Date:** 2026-03-04
**Author:** Solo fullstack developer
**Status:** Approved

---

## 1. Overview

SaaS-сервис для электронного ведения журналов ХАССП и СанПиН на пищевых производствах в СНГ. MVP — веб-приложение с 5 ключевыми журналами, ролевым доступом, уведомлениями через Telegram/email и PDF-выгрузкой для проверяющих.

### Целевая аудитория
- Технологи и начальники пищевых производств (мясные, молочные, кондитерские, хлебобулочные цеха)
- SMB: 5-100 сотрудников

### Ключевое ценностное предложение
- Замена бумажных журналов электронными (разрешено СанПиН с 2025)
- Экономия до 300 000 руб/год на штрафах + до 150 000 руб/год на трудозатратах
- PDF-отчёты для Роспотребнадзора / аудиторов одним кликом

---

## 2. Architecture

### Approach: Next.js Monolith

```
haccp-online/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth pages (login, register)
│   │   ├── (dashboard)/        # Protected dashboard pages
│   │   │   ├── dashboard/      # Main dashboard
│   │   │   ├── journals/       # Journal pages
│   │   │   ├── settings/       # Organization settings
│   │   │   └── reports/        # PDF reports
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # NextAuth.js
│   │   │   ├── journals/       # Journal CRUD
│   │   │   ├── organizations/  # Org settings
│   │   │   └── reports/        # PDF generation
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # Sidebar, Header, MobileNav
│   │   ├── journals/           # Journal-specific components
│   │   └── common/             # DataTable, DatePicker, etc.
│   ├── lib/
│   │   ├── db.ts               # Prisma client
│   │   ├── auth.ts             # Auth config
│   │   ├── notifications.ts    # Telegram + Email
│   │   ├── pdf.ts              # PDF generation
│   │   └── validators.ts       # Zod schemas
│   └── types/
│       └── index.ts            # TypeScript types
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.ts                 # Seed data (journal templates)
│   └── migrations/             # Migration files
├── public/
│   ├── manifest.json           # PWA manifest
│   └── icons/                  # App icons
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Tech Stack

| Component | Technology |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui |
| ORM | Prisma |
| Database | PostgreSQL (VPS) |
| Auth | NextAuth.js (Credentials) |
| Validation | Zod |
| Notifications | Telegram Bot API + Resend (email) |
| PDF | @react-pdf/renderer |
| Forms | React Hook Form + Zod resolver |
| Hosting | VPS (Node.js) |
| Payment | YooKassa (future) |

---

## 3. Data Model

### Organization
```prisma
model Organization {
  id               String   @id @default(cuid())
  name             String
  type             String   // meat, dairy, bakery, confectionery, other
  inn              String?
  address          String?
  phone            String?
  subscriptionPlan String   @default("trial") // trial, starter, standard, pro
  subscriptionEnd  DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  users            User[]
  areas            Area[]
  equipment        Equipment[]
  journalEntries   JournalEntry[]
}
```

### User
```prisma
model User {
  id               String   @id @default(cuid())
  email            String   @unique
  name             String
  phone            String?
  passwordHash     String
  role             String   @default("operator") // owner, technologist, operator
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  telegramChatId   String?
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  journalEntries   JournalEntry[]
}
```

### Area (цех/участок)
```prisma
model Area {
  id               String   @id @default(cuid())
  name             String
  description      String?
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  equipment        Equipment[]
  journalEntries   JournalEntry[]
}
```

### Equipment (оборудование)
```prisma
model Equipment {
  id               String   @id @default(cuid())
  name             String
  type             String   // fridge, freezer, oven, other
  serialNumber     String?
  tempMin          Float?   // min allowed temp
  tempMax          Float?   // max allowed temp
  areaId           String
  area             Area     @relation(fields: [areaId], references: [id])
  journalEntries   JournalEntry[]
}
```

### JournalTemplate (шаблон журнала)
```prisma
model JournalTemplate {
  id          String   @id @default(cuid())
  code        String   @unique // temp_control, incoming_control, etc.
  name        String
  description String?
  fields      Json     // array of field definitions
  isActive    Boolean  @default(true)
  entries     JournalEntry[]
}
```

### JournalEntry (запись в журнале)
```prisma
model JournalEntry {
  id               String   @id @default(cuid())
  templateId       String
  template         JournalTemplate @relation(fields: [templateId], references: [id])
  organizationId   String
  organization     Organization @relation(fields: [organizationId], references: [id])
  areaId           String?
  area             Area?    @relation(fields: [areaId], references: [id])
  equipmentId      String?
  equipment        Equipment? @relation(fields: [equipmentId], references: [id])
  filledById       String
  filledBy         User     @relation(fields: [filledById], references: [id])
  data             Json     // JSONB with filled field values
  photos           String[] // array of photo URLs
  status           String   @default("submitted") // draft, submitted, approved
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

## 4. Journal Templates (5 MVP)

### 4.1 temp_control (Температурный режим)
Fields:
- `equipmentId` (relation) — выбор оборудования
- `temperature` (number, required) — фактическая температура
- `isWithinNorm` (boolean, auto-calculated) — в пределах нормы
- `correctiveAction` (text, conditional) — если вне нормы
- `measuredAt` (datetime, auto) — время замера

### 4.2 incoming_control (Входной контроль сырья)
Fields:
- `productName` (text, required)
- `supplier` (text, required)
- `manufactureDate` (date, required)
- `expiryDate` (date, required)
- `quantity` (number, required)
- `unit` (select: kg/pcs/l, required)
- `temperatureOnArrival` (number, optional)
- `packagingCondition` (select: intact/damaged, required)
- `decision` (select: accepted/rejected, required)
- `photo` (photo, optional)

### 4.3 finished_product (Бракераж готовой продукции)
Fields:
- `productName` (text, required)
- `appearance` (select: excellent/good/satisfactory/unsatisfactory, required)
- `taste` (select, required)
- `smell` (select, required)
- `consistency` (select, required)
- `servingTemperature` (number, optional)
- `approvedForRelease` (boolean, required)
- `notes` (text, optional)

### 4.4 hygiene (Гигиенический журнал)
Fields:
- `employeeId` (relation to User, required)
- `noRespiratorySymptoms` (boolean, required)
- `noSkinDiseases` (boolean, required)
- `noGastrointestinalIssues` (boolean, required)
- `cleanUniform` (boolean, required)
- `admittedToWork` (boolean, required)

### 4.5 ccp_monitoring (Мониторинг ККТ)
Fields:
- `ccpName` (text, required) — название ККТ
- `controlParameter` (text, required)
- `criticalLimit` (text, required)
- `actualValue` (text, required)
- `withinLimit` (boolean, required)
- `correctiveAction` (text, conditional)

---

## 5. Authentication & Authorization

### Auth Flow
1. Registration → creates Organization + User (role: owner)
2. Login → email + password (NextAuth Credentials)
3. Session → JWT stored in httpOnly cookie

### Roles & Permissions

| Action | owner | technologist | operator |
|---|---|---|---|
| Create journal entries | Yes | Yes | Yes |
| View all entries | Yes | Yes | Own only |
| Approve entries | Yes | Yes | No |
| Generate PDF reports | Yes | Yes | No |
| Manage areas/equipment | Yes | Yes | No |
| Manage users | Yes | No | No |
| Billing & subscription | Yes | No | No |

### Middleware
- `(dashboard)` layout checks session, redirects to /login if not authenticated
- API routes validate session + check role permissions
- Organization-level data isolation (multi-tenant via organizationId filter)

---

## 6. Notifications

### Telegram Bot
- User links account via: open bot → /start {linkToken}
- Bot sends:
  - Daily reminder: "Журнал X не заполнен" (cron at 18:00)
  - Alert: "Температура вне нормы" (on journal entry save)
- Simple bot using grammy or node-telegram-bot-api

### Email (Resend)
- Fallback channel for users without Telegram
- Same notification types
- Transactional emails: registration confirmation, password reset

---

## 7. PDF Reports

### Generation
- Server-side using @react-pdf/renderer
- API endpoint: GET /api/reports/pdf?template={code}&from={date}&to={date}&area={id}
- Returns PDF file for download

### Format
- Header: Organization name, period, journal type
- Table: all entries for the period
- Footer: "Generated by HACCP-Online" + timestamp
- Styled to resemble standard paper journal forms

---

## 8. UI/UX Principles

- **Large touch targets** — buttons min 44x44px (for use with gloves/wet hands)
- **Simple navigation** — sidebar on desktop, bottom nav on mobile
- **PWA** — installable on tablet, works offline (basic caching)
- **Russian language** — all UI in Russian
- **Responsive** — desktop (admin), tablet (production floor), mobile (notifications)
- **Dark/light theme** — default light, dark optional

---

## 9. Pricing (MVP)

| Plan | Price | Features |
|---|---|---|
| Trial | Free (14 days) | Full access |
| Starter | 3 000 rub/mo | 3 users, basic journals |
| Standard | 5 000 rub/mo | 10 users, all journals |
| Pro | 8 000 rub/mo | Unlimited users, priority support |

Payment integration deferred to post-MVP (manual invoicing initially).

---

## 10. Out of Scope (MVP)

- IoT temperature sensors (Этап 3)
- Barcode scanning (Этап 2)
- 1C / iiko / Меркурий integration (Этап 5)
- AI HACCP plan generation (Этап 5)
- Multi-language support (Этап 5)
- Offline-first with sync (basic PWA caching only in MVP)
- Payment processing (manual invoicing for first clients)
