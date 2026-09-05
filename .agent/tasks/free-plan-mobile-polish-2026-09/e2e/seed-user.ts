/* eslint-disable no-console */
// Throwaway manager for local e2e. Usage:
//   npx tsx --env-file=.env.local .agent/tasks/.../e2e/seed-user.ts create|delete
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const ORG = process.env.E2E_ORG ?? "cmoe6rpt4000097ts71yb922y";
const EMAIL = "e2e-previews@wesetup.local";
const PASSWORD = "E2e-Previews-2026!";

async function main() {
  const mode = process.argv[2] ?? "create";
  if (mode === "delete") {
    const r = await db.user.deleteMany({ where: { email: EMAIL } });
    console.log(JSON.stringify({ deleted: r.count }));
    return;
  }
  const org = await db.organization.findUnique({ where: { id: ORG }, select: { id: true, name: true } });
  if (!org) throw new Error(`org ${ORG} not found`);
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  await db.user.deleteMany({ where: { email: EMAIL } });
  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "E2E Менеджер",
      role: "manager",
      passwordHash,
      organizationId: org.id,
      isActive: true,
    },
    select: { id: true },
  });
  console.log(JSON.stringify({ org: org.name, userId: user.id, email: EMAIL, password: PASSWORD }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
