import "dotenv/config";
import { db } from "@/lib/db";
async function main() {
  const users = await db.user.findMany({
    where: { OR: [{ isRoot: true }, { email: { contains: "haccp.local" } }, { email: { contains: "demo" } }] },
    select: { email: true, isRoot: true, role: true, organizationId: true, organization: { select: { name: true, isDemo: true } } },
    take: 10,
  });
  console.log(JSON.stringify(users, null, 1));
}
main().finally(() => db.$disconnect());
