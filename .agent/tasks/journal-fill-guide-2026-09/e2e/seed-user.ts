/* eslint-disable no-console */
// Throwaway manager for the e2e run. Run with:
//   node --env-file=.env.local --import tsx .agent/tasks/journal-fill-guide-2026-09/e2e/seed-user.ts
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const ORG = process.env.E2E_ORG ?? "cmoe6rpt4000097ts71yb922y";
const EMAIL = "e2e-fill-guide@wesetup.local";
const PASSWORD = "E2eFillGuide!2026";
const OUT = path.resolve(process.cwd(), ".agent/tasks/journal-fill-guide-2026-09/e2e/creds.json");

async function main() {
  const org = await db.organization.findUnique({
    where: { id: ORG },
    select: { id: true, name: true },
  });
  if (!org) throw new Error(`org not found: ${ORG}`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await db.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      organizationId: ORG,
      role: "manager",
      isActive: true,
      archivedAt: null,
      seenNoticesJson: {},
    },
    create: {
      email: EMAIL,
      name: "E2E Гайд",
      passwordHash,
      role: "manager",
      organizationId: ORG,
      seenNoticesJson: {},
    },
    select: { id: true, email: true },
  });
  const creds = { ...user, password: PASSWORD, org: org.name, orgId: org.id };
  fs.writeFileSync(OUT, JSON.stringify(creds, null, 2));
  console.log(JSON.stringify({ id: user.id, email: user.email, org: org.name }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
