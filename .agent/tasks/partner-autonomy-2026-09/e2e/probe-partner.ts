import { db } from "./db";
import { E2E_PARTNER_ID } from "./config";

async function main() {
  const partner = await db.partner.findUniqueOrThrow({
    where: { id: E2E_PARTNER_ID },
    select: { id: true, slug: true, inn: true, status: true, onboardingDoneAt: true, contactEmail: true },
  });
  console.log("partner:", JSON.stringify(partner));

  const clients = await db.partnerClient.findMany({
    where: { partnerId: E2E_PARTNER_ID },
    select: {
      id: true,
      organizationId: true,
      source: true,
      accessLevel: true,
      detachedAt: true,
      organization: {
        select: { name: true, accountId: true, _count: { select: { users: { where: { isActive: true } } } } },
      },
    },
  });
  console.log("clients:", JSON.stringify(clients, null, 2));

  const pending = await db.partnerClient.count({
    where: {
      partnerId: E2E_PARTNER_ID,
      source: "manual",
      detachedAt: null,
      organization: { users: { none: { isActive: true } } },
    },
  });
  console.log("pending(manual, без активных людей):", pending);

  // Чужой клиент — для проверки «чужого не трогаем».
  const other = await db.partnerClient.findFirst({
    where: { partnerId: { not: E2E_PARTNER_ID }, detachedAt: null },
    select: { organizationId: true, partner: { select: { slug: true } } },
  });
  console.log("чужой клиент:", JSON.stringify(other));

  // Активный пользователь не из команды партнёра — для «почта занята».
  const outsider = await db.user.findFirst({
    where: { isActive: true, partnerMembership: null, email: { not: "" } },
    select: { email: true },
    orderBy: { createdAt: "desc" },
  });
  console.log("посторонний активный:", JSON.stringify(outsider));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
