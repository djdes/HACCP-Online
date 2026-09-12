import { db } from "./db";

async function main() {
  const user = await db.user.findUnique({
    where: { email: "admin@wesetup.ru" },
    select: { id: true, name: true, phone: true, organizationId: true },
  });
  console.log("admin:", JSON.stringify(user));

  const org = await db.organization.findUnique({
    where: { id: "cmtjt28h20000t49mvzncgpte" },
    select: { name: true, phone: true, inn: true, timezone: true, locationsCount: true, perLocationJournals: true, _count: { select: { users: true } } },
  });
  console.log("Кафе «Проверка»:", JSON.stringify(org));

  const management = await db.user.findMany({
    where: { organizationId: "cmtjt28h20000t49mvzncgpte", isActive: true },
    select: { email: true, role: true },
  });
  console.log("люди клиента:", JSON.stringify(management));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
