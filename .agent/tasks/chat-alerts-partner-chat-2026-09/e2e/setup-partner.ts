import "dotenv/config";
import { db } from "@/lib/db";

/** E2E: ROOT становится владельцем партнёра «E2E Консалт», демо-организация — его клиентом. */
async function main() {
  const root = await db.user.findFirst({ where: { isRoot: true }, select: { id: true, email: true } });
  const demoOrgId = process.env.DEMO_ORG_ID;
  const demoAdmin = demoOrgId ? { organizationId: demoOrgId } : null;
  if (!root || !demoAdmin?.organizationId) throw new Error("root or DEMO_ORG_ID missing");
  console.error("root:", root.email);

  const partner = await db.partner.upsert({
    where: { slug: "e2e-partner" },
    update: { status: "active", applicantUserId: root.id },
    create: {
      slug: "e2e-partner",
      code: "E2E001",
      status: "active",
      type: "consultant",
      companyName: "E2E Консалт",
      inn: "7700000001",
      city: "Москва",
      phone: "+79990000001",
      contactEmail: "partner@e2e.local",
      termsAcceptedAt: new Date(),
      applicantUserId: root.id,
      onboardingDoneAt: new Date(),
    },
    select: { id: true },
  });
  await db.partnerUser.upsert({
    where: { userId: root.id },
    update: { partnerId: partner.id, role: "owner" },
    create: { partnerId: partner.id, userId: root.id, role: "owner" },
  });
  await db.partnerClient.updateMany({
    where: { organizationId: demoAdmin.organizationId, detachedAt: null },
    data: { detachedAt: new Date(), detachedBy: "admin" },
  });
  await db.partnerClient.create({
    data: {
      partnerId: partner.id,
      organizationId: demoAdmin.organizationId,
      accessLevel: "view",
      source: "manual",
    },
  });
  console.log(JSON.stringify({ partnerId: partner.id, demoOrgId: demoAdmin.organizationId, rootId: root.id }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
