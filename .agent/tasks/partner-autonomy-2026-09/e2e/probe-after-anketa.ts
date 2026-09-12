import { db } from "./db";

async function main() {
  const user = await db.user.findFirst({
    where: { email: { startsWith: "e2e-anketa-" } },
    orderBy: { createdAt: "desc" },
    select: { email: true, name: true, phone: true, positionTitle: true, organizationId: true },
  });
  console.log("владелец после анкеты:", JSON.stringify(user));

  const org = user
    ? await db.organization.findUnique({
        where: { id: user.organizationId ?? "" },
        select: { name: true, address: true, inn: true, legalProfileJson: true },
      })
    : null;
  console.log(
    "организация:",
    JSON.stringify({ name: org?.name, address: org?.address, inn: org?.inn, hasLegal: Boolean(org?.legalProfileJson) }),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
