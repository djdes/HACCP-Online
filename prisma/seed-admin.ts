/**
 * Standalone admin seed.
 *
 * Creates (or updates) a test organization and an owner-role user with known
 * credentials so a developer can log in immediately after deploy/dev start.
 *
 * Idempotent — safe to re-run. On re-run it resets the password to the current
 * ADMIN_PASSWORD value, so you can also use it to "forgot password" reset for
 * this fixed account.
 *
 * Usage:
 *   npx tsx prisma/seed-admin.ts
 *
 * Override defaults via env:
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=secret123 \
 *     ADMIN_ORG_NAME="ACME Foods" npx tsx prisma/seed-admin.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";

const DEFAULT_EMAIL = "admin@haccp.local";
const DEFAULT_PASSWORD = "admin1234";
const DEFAULT_ORG_NAME = "Тестовая организация (админ)";
const DEFAULT_ORG_TYPE = "meat"; // must match registerSchema enum
const DEFAULT_NAME = "Администратор";

async function main() {
  const connectionString =
    process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL (or DATABASE_URL_DIRECT) is not set");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const email = (process.env.ADMIN_EMAIL || DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
  const orgName = process.env.ADMIN_ORG_NAME || DEFAULT_ORG_NAME;
  const name = process.env.ADMIN_NAME || DEFAULT_NAME;

  if (password.length < 6) {
    console.error("ADMIN_PASSWORD must be at least 6 characters");
    process.exit(1);
  }
  if (password.length > 72) {
    console.error("ADMIN_PASSWORD must not exceed 72 characters (bcrypt limit)");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Trial period: far in the future so the admin org never expires during
  // day-to-day testing.
  const subscriptionEnd = new Date(
    Date.now() + 10 * 365 * 24 * 60 * 60 * 1000
  );

  try {
    const existing = await prisma.user.findUnique({
      where: { email },
      include: { organization: { select: { id: true, name: true } } },
    });

    let orgId: string;
    if (existing) {
      // User exists — update in place, keep same org.
      orgId = existing.organizationId;
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          role: "owner",
          isActive: true,
        },
      });
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          name: orgName,
          subscriptionPlan: "pro",
          subscriptionEnd,
        },
      });
      console.log(`  Updated existing admin user: ${email}`);
      console.log(`  Updated organization:       ${orgName} (${orgId})`);
    } else {
      // Fresh install — create org + user in a transaction.
      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: orgName,
            type: DEFAULT_ORG_TYPE,
            subscriptionPlan: "pro",
            subscriptionEnd,
          },
        });
        const user = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            role: "owner",
            organizationId: org.id,
            isActive: true,
          },
        });
        return { org, user };
      });
      orgId = result.org.id;
      console.log(`  Created organization: ${result.org.name} (${orgId})`);
      console.log(`  Created admin user:   ${result.user.email}`);
    }

    console.log("");
    console.log("Admin credentials:");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Role:     owner`);
    console.log(`  Org ID:   ${orgId}`);
    console.log("");
    console.log("Login at /login.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
