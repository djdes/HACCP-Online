import { db } from "./db";

async function main() {
  const partners = await db.partner.findMany({
    select: {
      id: true,
      slug: true,
      code: true,
      status: true,
      companyName: true,
      inn: true,
      city: true,
      contactEmail: true,
      branding: { select: { brandName: true } },
      members: { select: { role: true, user: { select: { id: true, email: true, isActive: true } } } },
      _count: { select: { clients: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(JSON.stringify(partners, null, 2));
  const slugs = await db.partner.findMany({ select: { slug: true } });
  console.log("SLUGS:", slugs.map((p) => p.slug).join(", "));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
