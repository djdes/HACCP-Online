# HACCP-Online MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build MVP web app for electronic HACCP/SanPiN journal keeping at food production facilities — 5 journals, role-based access, Telegram/email notifications, PDF export.

**Architecture:** Next.js 14+ monolith with App Router. PostgreSQL via Prisma ORM. Auth via NextAuth.js Credentials. All UI in Russian. PWA-ready. Deployed on VPS.

**Tech Stack:** Next.js 14+, TypeScript (strict), Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, NextAuth.js, Zod, React Hook Form, @react-pdf/renderer, grammy (Telegram), Resend (email)

**Design doc:** `docs/plans/2026-03-04-haccp-online-mvp-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.js`, `tsconfig.json`, `tailwind.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`

**Step 1: Initialize Next.js project**

Run:
```bash
cd /c/www/HACCP-Online
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Expected: Project scaffold created. Accept defaults, overwrite existing files if prompted.

**Step 2: Install core dependencies**

Run:
```bash
npm install prisma @prisma/client next-auth @auth/prisma-adapter zod react-hook-form @hookform/resolvers bcryptjs
npm install -D @types/bcryptjs
```

**Step 3: Install UI dependencies (shadcn/ui)**

Run:
```bash
npx shadcn@latest init
```

Choose: New York style, Zinc base color, CSS variables yes. Then add core components:

```bash
npx shadcn@latest add button input label card table dialog select checkbox textarea badge separator dropdown-menu sheet avatar toast tabs form
```

**Step 4: Create .env.example**

Create `.env.example`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/haccp_online"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"
TELEGRAM_BOT_TOKEN=""
RESEND_API_KEY=""
```

**Step 5: Create .gitignore additions**

Append to `.gitignore`:
```
.env
.env.local
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Database Schema & Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Step 1: Initialize Prisma**

Run:
```bash
npx prisma init
```

**Step 2: Write the schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id               String         @id @default(cuid())
  name             String
  type             String         // meat, dairy, bakery, confectionery, other
  inn              String?
  address          String?
  phone            String?
  subscriptionPlan String         @default("trial")
  subscriptionEnd  DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  users            User[]
  areas            Area[]
  journalEntries   JournalEntry[]
}

model User {
  id              String         @id @default(cuid())
  email           String         @unique
  name            String
  phone           String?
  passwordHash    String
  role            String         @default("operator") // owner, technologist, operator
  organizationId  String
  organization    Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  telegramChatId  String?
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  journalEntries  JournalEntry[]
}

model Area {
  id              String         @id @default(cuid())
  name            String
  description     String?
  organizationId  String
  organization    Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  equipment       Equipment[]
  journalEntries  JournalEntry[]
}

model Equipment {
  id              String         @id @default(cuid())
  name            String
  type            String         // fridge, freezer, oven, other
  serialNumber    String?
  tempMin         Float?
  tempMax         Float?
  areaId          String
  area            Area           @relation(fields: [areaId], references: [id], onDelete: Cascade)
  journalEntries  JournalEntry[]
}

model JournalTemplate {
  id          String         @id @default(cuid())
  code        String         @unique
  name        String
  description String?
  fields      Json
  isActive    Boolean        @default(true)
  sortOrder   Int            @default(0)
  entries     JournalEntry[]
}

model JournalEntry {
  id              String          @id @default(cuid())
  templateId      String
  template        JournalTemplate @relation(fields: [templateId], references: [id])
  organizationId  String
  organization    Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  areaId          String?
  area            Area?           @relation(fields: [areaId], references: [id])
  equipmentId     String?
  equipment       Equipment?      @relation(fields: [equipmentId], references: [id])
  filledById      String
  filledBy        User            @relation(fields: [filledById], references: [id])
  data            Json
  status          String          @default("submitted") // draft, submitted, approved
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@index([organizationId, templateId, createdAt])
  @@index([filledById])
}
```

**Step 3: Create Prisma client singleton**

Create `src/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Step 4: Create .env from example, run migration**

```bash
cp .env.example .env
# Edit .env with real DATABASE_URL
npx prisma migrate dev --name init
```

Expected: Migration created in `prisma/migrations/`, DB tables created.

**Step 5: Verify with Prisma Studio**

Run:
```bash
npx prisma studio
```

Expected: Opens browser, shows empty tables.

**Step 6: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: add Prisma schema with all models and DB client"
```

---

## Task 3: Seed Data — Journal Templates

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add prisma seed script)

**Step 1: Write seed file**

Create `prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const journalTemplates = [
  {
    code: "temp_control",
    name: "Температурный режим",
    description: "Журнал учёта температурного режима холодильного и морозильного оборудования",
    sortOrder: 1,
    fields: [
      { key: "equipmentId", label: "Оборудование", type: "equipment", required: true },
      { key: "temperature", label: "Температура (°C)", type: "number", required: true, step: 0.1 },
      { key: "isWithinNorm", label: "В пределах нормы", type: "boolean", auto: true },
      { key: "correctiveAction", label: "Корректирующее действие", type: "text", required: false, showIf: { field: "isWithinNorm", equals: false } },
    ],
  },
  {
    code: "incoming_control",
    name: "Входной контроль сырья",
    description: "Журнал входного контроля поступающего сырья и продуктов",
    sortOrder: 2,
    fields: [
      { key: "productName", label: "Наименование продукта", type: "text", required: true },
      { key: "supplier", label: "Поставщик", type: "text", required: true },
      { key: "manufactureDate", label: "Дата изготовления", type: "date", required: true },
      { key: "expiryDate", label: "Срок годности", type: "date", required: true },
      { key: "quantity", label: "Количество", type: "number", required: true, step: 0.01 },
      { key: "unit", label: "Единица измерения", type: "select", required: true, options: [
        { value: "kg", label: "кг" },
        { value: "l", label: "л" },
        { value: "pcs", label: "шт" },
      ]},
      { key: "temperatureOnArrival", label: "Температура при приёмке (°C)", type: "number", required: false, step: 0.1 },
      { key: "packagingCondition", label: "Состояние упаковки", type: "select", required: true, options: [
        { value: "intact", label: "Целая" },
        { value: "damaged", label: "Повреждена" },
      ]},
      { key: "decision", label: "Решение", type: "select", required: true, options: [
        { value: "accepted", label: "Принято" },
        { value: "rejected", label: "Отклонено" },
      ]},
      { key: "notes", label: "Примечание", type: "text", required: false },
    ],
  },
  {
    code: "finished_product",
    name: "Бракераж готовой продукции",
    description: "Журнал бракеража готовой продукции",
    sortOrder: 3,
    fields: [
      { key: "productName", label: "Наименование продукта", type: "text", required: true },
      { key: "appearance", label: "Внешний вид", type: "select", required: true, options: [
        { value: "excellent", label: "Отлично" },
        { value: "good", label: "Хорошо" },
        { value: "satisfactory", label: "Удовлетворительно" },
        { value: "unsatisfactory", label: "Неудовлетворительно" },
      ]},
      { key: "taste", label: "Вкус", type: "select", required: true, options: [
        { value: "excellent", label: "Отлично" },
        { value: "good", label: "Хорошо" },
        { value: "satisfactory", label: "Удовлетворительно" },
        { value: "unsatisfactory", label: "Неудовлетворительно" },
      ]},
      { key: "smell", label: "Запах", type: "select", required: true, options: [
        { value: "excellent", label: "Отлично" },
        { value: "good", label: "Хорошо" },
        { value: "satisfactory", label: "Удовлетворительно" },
        { value: "unsatisfactory", label: "Неудовлетворительно" },
      ]},
      { key: "consistency", label: "Консистенция", type: "select", required: true, options: [
        { value: "excellent", label: "Отлично" },
        { value: "good", label: "Хорошо" },
        { value: "satisfactory", label: "Удовлетворительно" },
        { value: "unsatisfactory", label: "Неудовлетворительно" },
      ]},
      { key: "servingTemperature", label: "Температура подачи (°C)", type: "number", required: false, step: 0.1 },
      { key: "approvedForRelease", label: "Разрешение к выпуску", type: "boolean", required: true },
      { key: "notes", label: "Примечание", type: "text", required: false },
    ],
  },
  {
    code: "hygiene",
    name: "Гигиенический журнал",
    description: "Журнал осмотра сотрудников на предмет признаков заболеваний",
    sortOrder: 4,
    fields: [
      { key: "employeeName", label: "ФИО сотрудника", type: "text", required: true },
      { key: "noRespiratorySymptoms", label: "Отсутствие признаков ОРЗ", type: "boolean", required: true },
      { key: "noSkinDiseases", label: "Отсутствие кожных заболеваний", type: "boolean", required: true },
      { key: "noGastrointestinalIssues", label: "Отсутствие кишечных расстройств", type: "boolean", required: true },
      { key: "cleanUniform", label: "Чистота спецодежды", type: "boolean", required: true },
      { key: "admittedToWork", label: "Допуск к работе", type: "select", required: true, options: [
        { value: "admitted", label: "Допущен" },
        { value: "not_admitted", label: "Не допущен" },
      ]},
    ],
  },
  {
    code: "ccp_monitoring",
    name: "Мониторинг ККТ",
    description: "Журнал мониторинга критических контрольных точек",
    sortOrder: 5,
    fields: [
      { key: "ccpName", label: "Название ККТ", type: "text", required: true },
      { key: "controlParameter", label: "Параметр контроля", type: "text", required: true },
      { key: "criticalLimit", label: "Критический предел", type: "text", required: true },
      { key: "actualValue", label: "Фактическое значение", type: "text", required: true },
      { key: "withinLimit", label: "В пределах нормы", type: "boolean", required: true },
      { key: "correctiveAction", label: "Корректирующее действие", type: "text", required: false, showIf: { field: "withinLimit", equals: false } },
    ],
  },
];

async function main() {
  console.log("Seeding journal templates...");

  for (const template of journalTemplates) {
    await prisma.journalTemplate.upsert({
      where: { code: template.code },
      update: { name: template.name, description: template.description, fields: template.fields, sortOrder: template.sortOrder },
      create: template,
    });
    console.log(`  ✓ ${template.code}: ${template.name}`);
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Add seed config to package.json**

Add to `package.json`:
```json
"prisma": {
  "seed": "npx tsx prisma/seed.ts"
}
```

Install tsx:
```bash
npm install -D tsx
```

**Step 3: Run seed**

```bash
npx prisma db seed
```

Expected: 5 journal templates created.

**Step 4: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add journal template seed data (5 templates)"
```

---

## Task 4: Authentication (NextAuth.js)

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/lib/validators.ts`

**Step 1: Create auth configuration**

Create `src/lib/auth.ts`:

```typescript
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          organizationName: user.organization.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.organizationId = (user as any).organizationId;
        token.organizationName = (user as any).organizationName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).organizationName = token.organizationName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
```

**Step 2: Create auth API route**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
```

**Step 3: Create types for extended session**

Create `src/types/next-auth.d.ts`:

```typescript
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
      organizationName: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    organizationId: string;
    organizationName: string;
  }
}
```

**Step 4: Create Zod validators**

Create `src/lib/validators.ts`:

```typescript
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
});

export const registerSchema = z.object({
  organizationName: z.string().min(2, "Минимум 2 символа"),
  organizationType: z.enum(["meat", "dairy", "bakery", "confectionery", "other"]),
  name: z.string().min(2, "Минимум 2 символа"),
  email: z.string().email("Некорректный email"),
  password: z.string().min(6, "Минимум 6 символов"),
  phone: z.string().optional(),
});

export const journalEntrySchema = z.object({
  templateId: z.string(),
  areaId: z.string().optional(),
  equipmentId: z.string().optional(),
  data: z.record(z.unknown()),
});

export const areaSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  description: z.string().optional(),
});

export const equipmentSchema = z.object({
  name: z.string().min(1, "Укажите название"),
  type: z.enum(["fridge", "freezer", "oven", "other"]),
  serialNumber: z.string().optional(),
  tempMin: z.number().optional(),
  tempMax: z.number().optional(),
  areaId: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type JournalEntryInput = z.infer<typeof journalEntrySchema>;
export type AreaInput = z.infer<typeof areaSchema>;
export type EquipmentInput = z.infer<typeof equipmentSchema>;
```

**Step 5: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/types/ src/lib/validators.ts
git commit -m "feat: add NextAuth.js with Credentials provider and Zod validators"
```

---

## Task 5: Registration API + Page

**Files:**
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

**Step 1: Create registration API**

Create `src/app/api/auth/register/route.ts`:

```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validators";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = registerSchema.parse(body);

    const existingUser = await db.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const organization = await db.organization.create({
      data: {
        name: data.organizationName,
        type: data.organizationType,
        subscriptionPlan: "trial",
        subscriptionEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        users: {
          create: {
            email: data.email,
            name: data.name,
            phone: data.phone,
            passwordHash,
            role: "owner",
          },
        },
      },
      include: { users: true },
    });

    return NextResponse.json({
      message: "Регистрация успешна",
      organizationId: organization.id,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
    }
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
```

**Step 2: Create auth layout**

Create `src/app/(auth)/layout.tsx`:

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
```

**Step 3: Create registration page**

Create `src/app/(auth)/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ORG_TYPES = [
  { value: "meat", label: "Мясное производство" },
  { value: "dairy", label: "Молочное производство" },
  { value: "bakery", label: "Хлебобулочное производство" },
  { value: "confectionery", label: "Кондитерское производство" },
  { value: "other", label: "Другое" },
];

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      organizationName: formData.get("organizationName"),
      organizationType: formData.get("organizationType"),
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      phone: formData.get("phone") || undefined,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || "Ошибка регистрации");
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Регистрация</CardTitle>
        <CardDescription>Создайте аккаунт для вашего предприятия</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="organizationName">Название предприятия</Label>
            <Input id="organizationName" name="organizationName" required />
          </div>

          <div>
            <Label htmlFor="organizationType">Тип производства</Label>
            <Select name="organizationType" required>
              <SelectTrigger>
                <SelectValue placeholder="Выберите тип" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">Ваше имя</Label>
            <Input id="name" name="name" required />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div>
            <Label htmlFor="phone">Телефон</Label>
            <Input id="phone" name="phone" type="tel" />
          </div>

          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" name="password" type="password" minLength={6} required />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Регистрация..." : "Зарегистрироваться"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-primary underline">Войти</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/api/auth/register/ src/app/\(auth\)/
git commit -m "feat: add registration API and page"
```

---

## Task 6: Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`

**Step 1: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const registered = searchParams.get("registered");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Неверный email или пароль");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Вход</CardTitle>
        <CardDescription>Войдите в HACCP-Online</CardDescription>
      </CardHeader>
      <CardContent>
        {registered && (
          <p className="text-sm text-green-600 mb-4">
            Регистрация успешна! Войдите в систему.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input id="password" name="password" type="password" required />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            Нет аккаунта?{" "}
            <Link href="/register" className="text-primary underline">Зарегистрироваться</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(auth\)/login/
git commit -m "feat: add login page"
```

---

## Task 7: Dashboard Layout (Sidebar + Header)

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`
- Create: `src/components/layout/session-provider.tsx`
- Create: `src/lib/auth-helpers.ts`

**Step 1: Create session provider wrapper**

Create `src/components/layout/session-provider.tsx`:

```tsx
"use client";

import { SessionProvider } from "next-auth/react";

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

**Step 2: Create server-side auth helper**

Create `src/lib/auth-helpers.ts`:

```typescript
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "./auth";

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}
```

**Step 3: Create sidebar**

Create `src/components/layout/sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  LayoutDashboard,
  Settings,
  FileText,
} from "lucide-react";

const navigation = [
  { name: "Дашборд", href: "/dashboard", icon: LayoutDashboard },
  { name: "Журналы", href: "/journals", icon: ClipboardList },
  { name: "Отчёты", href: "/reports", icon: FileText },
  { name: "Настройки", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-white">
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center h-16 px-4 border-b">
          <Link href="/dashboard" className="text-xl font-bold text-primary">
            HACCP-Online
          </Link>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-gray-100"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
```

Note: install lucide-react:
```bash
npm install lucide-react
```

**Step 4: Create header**

Create `src/components/layout/header.tsx`:

```tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

export function Header() {
  const { data: session } = useSession();

  const initials = session?.user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-white px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64">
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <p className="text-sm text-muted-foreground">
          {session?.user?.organizationName}
        </p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            <Avatar className="h-10 w-10">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="font-medium">{session?.user?.name}</DropdownMenuItem>
          <DropdownMenuItem className="text-muted-foreground">{session?.user?.email}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
```

**Step 5: Create dashboard layout**

Create `src/app/(dashboard)/layout.tsx`:

```tsx
import { requireAuth } from "@/lib/auth-helpers";
import { AuthSessionProvider } from "@/components/layout/session-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  return (
    <AuthSessionProvider>
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <div className="md:pl-64">
          <Header />
          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AuthSessionProvider>
  );
}
```

**Step 6: Commit**

```bash
git add src/components/layout/ src/app/\(dashboard\)/layout.tsx src/lib/auth-helpers.ts
git commit -m "feat: add dashboard layout with sidebar, header, and auth guard"
```

---

## Task 8: Dashboard Home Page

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create dashboard page**

Create `src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Users, ThermometerSun, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireAuth();
  const orgId = session.user.organizationId;

  const [totalEntries, todayEntries, templates, usersCount] = await Promise.all([
    db.journalEntry.count({ where: { organizationId: orgId } }),
    db.journalEntry.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    db.journalTemplate.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    db.user.count({ where: { organizationId: orgId, isActive: true } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Записей сегодня</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayEntries}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Всего записей</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEntries}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Сотрудников</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usersCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Журналов</CardTitle>
            <ThermometerSun className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Журналы</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Link key={t.id} href={`/journals/${t.code}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">{t.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/
git commit -m "feat: add dashboard home page with stats and journal cards"
```

---

## Task 9: Journal List Page

**Files:**
- Create: `src/app/(dashboard)/journals/page.tsx`
- Create: `src/app/(dashboard)/journals/[code]/page.tsx`

**Step 1: Create journals index page**

Create `src/app/(dashboard)/journals/page.tsx`:

```tsx
import { db } from "@/lib/db";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default async function JournalsPage() {
  const templates = await db.journalTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Журналы</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link key={t.id} href={`/journals/${t.code}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base">{t.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Create journal entries list page**

Create `src/app/(dashboard)/journals/[code]/page.tsx`:

```tsx
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  submitted: "Отправлено",
  approved: "Утверждено",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  approved: "default",
};

export default async function JournalEntriesPage({
  params,
}: {
  params: { code: string };
}) {
  const session = await requireAuth();
  const { code } = await params;

  const template = await db.journalTemplate.findUnique({
    where: { code },
  });

  if (!template) notFound();

  const entries = await db.journalEntry.findMany({
    where: {
      templateId: template.id,
      organizationId: session.user.organizationId,
    },
    include: {
      filledBy: { select: { name: true } },
      area: { select: { name: true } },
      equipment: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{template.name}</h1>
          <p className="text-muted-foreground">{template.description}</p>
        </div>
        <Link href={`/journals/${code}/new`}>
          <Button size="lg" className="gap-2">
            <Plus className="h-5 w-5" />
            Новая запись
          </Button>
        </Link>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Записей пока нет</p>
          <Link href={`/journals/${code}/new`}>
            <Button variant="outline" className="mt-4">Создать первую запись</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Заполнил</TableHead>
                <TableHead>Участок</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {new Date(entry.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>{entry.filledBy.name}</TableCell>
                  <TableCell>{entry.area?.name || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[entry.status]}>
                      {STATUS_LABELS[entry.status]}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/journals/
git commit -m "feat: add journal index and entries list pages"
```

---

## Task 10: Journal Entry Form (Dynamic)

**Files:**
- Create: `src/app/(dashboard)/journals/[code]/new/page.tsx`
- Create: `src/components/journals/dynamic-form.tsx`
- Create: `src/app/api/journals/route.ts`

**Step 1: Create journal entry API**

Create `src/app/api/journals/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { templateCode, areaId, equipmentId, data } = body;

    const template = await db.journalTemplate.findUnique({
      where: { code: templateCode },
    });

    if (!template) {
      return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    }

    const entry = await db.journalEntry.create({
      data: {
        templateId: template.id,
        organizationId: session.user.organizationId,
        filledById: session.user.id,
        areaId: areaId || null,
        equipmentId: equipmentId || null,
        data,
        status: "submitted",
      },
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error("Journal entry error:", error);
    return NextResponse.json({ error: "Ошибка сохранения" }, { status: 500 });
  }
}
```

**Step 2: Create dynamic form component**

Create `src/components/journals/dynamic-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FieldOption = { value: string; label: string };
type ShowIfCondition = { field: string; equals: unknown };

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean" | "select" | "equipment";
  required?: boolean;
  options?: FieldOption[];
  step?: number;
  auto?: boolean;
  showIf?: ShowIfCondition;
};

type EquipmentItem = {
  id: string;
  name: string;
  type: string;
  tempMin: number | null;
  tempMax: number | null;
};

type AreaItem = {
  id: string;
  name: string;
};

interface DynamicFormProps {
  templateCode: string;
  templateName: string;
  fields: FieldDef[];
  areas: AreaItem[];
  equipment: EquipmentItem[];
}

export function DynamicForm({ templateCode, templateName, fields, areas, equipment }: DynamicFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [areaId, setAreaId] = useState<string>("");
  const [equipmentId, setEquipmentId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateField(key: string, value: unknown) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function isFieldVisible(field: FieldDef): boolean {
    if (!field.showIf) return true;
    return formData[field.showIf.field] === field.showIf.equals;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateCode,
          areaId: areaId || undefined,
          equipmentId: equipmentId || undefined,
          data: formData,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        setError(result.error || "Ошибка сохранения");
        return;
      }

      router.push(`/journals/${templateCode}`);
      router.refresh();
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }

  function renderField(field: FieldDef) {
    if (!isFieldVisible(field)) return null;
    if (field.auto) return null;

    switch (field.type) {
      case "text":
        return (
          <div key={field.key}>
            <Label>{field.label}{field.required && " *"}</Label>
            <Textarea
              value={(formData[field.key] as string) || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              required={field.required}
            />
          </div>
        );

      case "number":
        return (
          <div key={field.key}>
            <Label>{field.label}{field.required && " *"}</Label>
            <Input
              type="number"
              step={field.step || 1}
              value={(formData[field.key] as string) || ""}
              onChange={(e) => updateField(field.key, parseFloat(e.target.value) || 0)}
              required={field.required}
            />
          </div>
        );

      case "date":
        return (
          <div key={field.key}>
            <Label>{field.label}{field.required && " *"}</Label>
            <Input
              type="date"
              value={(formData[field.key] as string) || ""}
              onChange={(e) => updateField(field.key, e.target.value)}
              required={field.required}
            />
          </div>
        );

      case "boolean":
        return (
          <div key={field.key} className="flex items-center gap-3 py-2">
            <Checkbox
              id={field.key}
              checked={!!formData[field.key]}
              onCheckedChange={(checked) => updateField(field.key, checked)}
            />
            <Label htmlFor={field.key} className="cursor-pointer">
              {field.label}
            </Label>
          </div>
        );

      case "select":
        return (
          <div key={field.key}>
            <Label>{field.label}{field.required && " *"}</Label>
            <Select
              value={(formData[field.key] as string) || ""}
              onValueChange={(value) => updateField(field.key, value)}
              required={field.required}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите..." />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case "equipment":
        return (
          <div key={field.key}>
            <Label>{field.label}{field.required && " *"}</Label>
            <Select
              value={equipmentId}
              onValueChange={(value) => {
                setEquipmentId(value);
                updateField(field.key, value);
              }}
              required={field.required}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите оборудование..." />
              </SelectTrigger>
              <SelectContent>
                {equipment.map((eq) => (
                  <SelectItem key={eq.id} value={eq.id}>
                    {eq.name} ({eq.type === "fridge" ? "Холодильник" : eq.type === "freezer" ? "Морозильник" : eq.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{templateName}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {areas.length > 0 && (
            <div>
              <Label>Цех / Участок</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите участок (необязательно)" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {fields.map(renderField)}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-4 pt-4">
            <Button type="submit" size="lg" disabled={loading} className="flex-1">
              {loading ? "Сохранение..." : "Сохранить запись"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => router.back()}
            >
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Create new entry page**

Create `src/app/(dashboard)/journals/[code]/new/page.tsx`:

```tsx
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { DynamicForm } from "@/components/journals/dynamic-form";

export default async function NewJournalEntryPage({
  params,
}: {
  params: { code: string };
}) {
  const session = await requireAuth();
  const { code } = await params;

  const template = await db.journalTemplate.findUnique({
    where: { code },
  });

  if (!template) notFound();

  const [areas, equipment] = await Promise.all([
    db.area.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
    }),
    db.equipment.findMany({
      where: { area: { organizationId: session.user.organizationId } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-2xl mx-auto">
      <DynamicForm
        templateCode={template.code}
        templateName={template.name}
        fields={template.fields as any[]}
        areas={areas}
        equipment={equipment}
      />
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/api/journals/ src/components/journals/ src/app/\(dashboard\)/journals/
git commit -m "feat: add dynamic journal entry form and API"
```

---

## Task 11: Settings Pages (Areas, Equipment, Users)

**Files:**
- Create: `src/app/(dashboard)/settings/page.tsx`
- Create: `src/app/(dashboard)/settings/areas/page.tsx`
- Create: `src/app/(dashboard)/settings/equipment/page.tsx`
- Create: `src/app/(dashboard)/settings/users/page.tsx`
- Create: `src/app/api/areas/route.ts`
- Create: `src/app/api/equipment/route.ts`
- Create: `src/app/api/users/invite/route.ts`

This task creates CRUD APIs for areas, equipment, and user invitations, plus the settings pages. Follow the same patterns established in Tasks 5-10:
- API routes validate session and organizationId
- Zod validation on input
- Server components for pages, client components for forms
- Use shadcn/ui components consistently

Key details:
- **Areas API** (`/api/areas`): GET (list by org), POST (create), DELETE (by id)
- **Equipment API** (`/api/equipment`): GET (list by org via area), POST (create), DELETE
- **Users invite API** (`/api/users/invite`): POST creates user with given role, sends welcome email
- Settings index page links to sub-pages
- Each sub-page shows a list + "Add" dialog

**Commit:**
```bash
git commit -m "feat: add settings pages for areas, equipment, users"
```

---

## Task 12: PDF Report Generation

**Files:**
- Create: `src/app/api/reports/pdf/route.ts`
- Create: `src/app/(dashboard)/reports/page.tsx`
- Create: `src/lib/pdf.ts`

**Step 1: Install PDF dependencies**

```bash
npm install @react-pdf/renderer
```

**Step 2: Create PDF generator**

Create `src/lib/pdf.ts` — server-side function that:
- Takes: templateCode, organizationId, dateFrom, dateTo
- Queries JournalEntry records for the period
- Renders a table using @react-pdf/renderer with:
  - Header: org name, journal name, period
  - Table rows: date, filled-by, all data fields
  - Footer: "Сформировано в HACCP-Online" + timestamp
- Returns PDF buffer

**Step 3: Create PDF API route**

Create `src/app/api/reports/pdf/route.ts`:
- GET with query params: `template`, `from`, `to`, `area` (optional)
- Validates session, calls PDF generator, returns `application/pdf` response

**Step 4: Create reports page**

Create `src/app/(dashboard)/reports/page.tsx`:
- Form with: template selector, date range, area filter
- "Скачать PDF" button that calls API and triggers download

**Step 5: Commit**

```bash
git commit -m "feat: add PDF report generation and reports page"
```

---

## Task 13: Telegram Notifications

**Files:**
- Create: `src/lib/telegram.ts`
- Create: `src/app/api/notifications/telegram/route.ts`
- Create: `src/app/(dashboard)/settings/notifications/page.tsx`

**Step 1: Install grammy**

```bash
npm install grammy
```

**Step 2: Create Telegram bot utility**

Create `src/lib/telegram.ts`:
- Initialize bot with TELEGRAM_BOT_TOKEN
- Function `sendMessage(chatId, text)` — sends message
- Function `generateLinkToken(userId)` — creates unique token for account linking
- Webhook handler for `/start {token}` — links Telegram to user account

**Step 3: Create webhook API route**

Create `src/app/api/notifications/telegram/route.ts`:
- POST endpoint for Telegram webhook
- Handles `/start {token}` command — updates user's telegramChatId

**Step 4: Create notifications settings page**

Create `src/app/(dashboard)/settings/notifications/page.tsx`:
- Shows Telegram bot link with user's unique token
- QR code for easy scanning (optional, nice to have)
- Toggle for email notifications

**Step 5: Add notification on journal entry**

Modify `src/app/api/journals/route.ts`:
- After creating entry with out-of-norm values (temperature violations), send Telegram alert to technologists/owners

**Step 6: Commit**

```bash
git commit -m "feat: add Telegram bot integration and notifications"
```

---

## Task 14: Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Create landing page**

Replace `src/app/page.tsx` with a simple marketing landing:
- Hero: "Электронные журналы ХАССП для пищевых производств"
- Value props: 3 cards (экономия на штрафах, электронные журналы, мгновенные уведомления)
- CTA: "Попробовать бесплатно" → /register
- Footer: contacts, legal

Keep it minimal — this is MVP.

**Step 2: Commit**

```bash
git commit -m "feat: add landing page"
```

---

## Task 15: PWA Setup

**Files:**
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx`

**Step 1: Create PWA manifest**

Create `public/manifest.json`:
```json
{
  "name": "HACCP-Online",
  "short_name": "HACCP",
  "description": "Электронные журналы ХАССП для пищевых производств",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#18181b",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Step 2: Add manifest link to layout**

Add `<link rel="manifest" href="/manifest.json" />` and meta tags to `src/app/layout.tsx`.

**Step 3: Create placeholder icons**

Generate simple icons (can be placeholder for now).

**Step 4: Commit**

```bash
git commit -m "feat: add PWA manifest and meta tags"
```

---

## Task 16: Final Integration Test

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Manual test flow**

1. Open http://localhost:3000 → landing page loads
2. Click "Зарегистрироваться" → registration form works
3. Fill registration → redirects to login
4. Login → redirects to dashboard
5. Dashboard shows stats (0 entries, 5 journals)
6. Click journal → see empty entries list
7. Click "Новая запись" → dynamic form renders
8. Fill form → saves → appears in list
9. Settings → add area → add equipment
10. Reports → generate PDF → downloads

**Step 3: Fix any issues found**

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: fix integration issues from manual testing"
```
