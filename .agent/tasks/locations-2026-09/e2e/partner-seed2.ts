/* eslint-disable no-console */
// Настоящий кросс-организационный партнёр: своя организация, свой
// пользователь, привязка к e2e-организации уровня «просмотр».
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createOrganization } from "@/lib/create-organization";

const ORG = "cmoe6rpt4000097ts71yb922y";
const EMAIL = "e2e-locations-partner@wesetup.local";
const PASSWORD = "E2ePartner!2026";
const OUT = path.resolve(process.cwd(), ".agent/tasks/locations-2026-09/e2e/creds.json");

(async () => {
  const account = await db.organization.findUnique({ where: { id: ORG }, select: { accountId: true } });
  if (!account?.accountId) throw new Error("e2e org has no account");

  // Старый синтетический партнёр (участник = менеджер клиента) — удалить.
  const stale = await db.partner.findUnique({ where: { slug: "e2e-locations-partner" }, select: { id: true } });
  if (stale) await db.partner.delete({ where: { id: stale.id } });
  const staleUser = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true, organizationId: true } });
  if (staleUser) {
    await db.user.delete({ where: { id: staleUser.id } });
    if (staleUser.organizationId !== ORG) await db.organization.delete({ where: { id: staleUser.organizationId } }).catch(() => {});
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const user = await db.user.create({
    data: { email: EMAIL, name: "E2E Консультант", passwordHash, role: "manager", organizationId: ORG, isActive: true },
    select: { id: true },
  });
  const { organizationId } = await createOrganization({
    name: "E2E Партнёр Орг",
    sphere: "cafe",
    accountId: account.accountId,
    ownerUserId: user.id,
  });
  await db.user.update({ where: { id: user.id }, data: { organizationId } });
  // Членство в организации клиента партнёру не положено: он не member.
  await db.organizationMember.deleteMany({ where: { userId: user.id, organizationId: ORG } });

  const partner = await db.partner.create({
    data: {
      slug: "e2e-locations-partner", code: "E2ELOC", status: "active", type: "consultant",
      companyName: "E2E Консалтинг", inn: "7707083893", city: "Москва", phone: "+79990000000",
      contactEmail: EMAIL, termsAcceptedAt: new Date(), onboardingDoneAt: new Date(),
      applicantUserId: user.id, applicantOrganizationId: organizationId,
      members: { create: { userId: user.id, role: "owner" } },
      clients: { create: { organizationId: ORG, accessLevel: "view", source: "manual" } },
    },
    select: { id: true },
  });
  const state = { email: EMAIL, password: PASSWORD, userId: user.id, partnerOrgId: organizationId, partnerId: partner.id, clientOrgId: ORG };
  fs.writeFileSync(OUT, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ ...state, password: "***" }));
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
