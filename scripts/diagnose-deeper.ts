/**
 * Deeper diagnostic: для каждого журнала смотрит slot-конфигурацию
 * (responsibles JSON) чтобы понять почему verifier не назначается, и
 * выдаёт sample dump'ов нужных шаблонов чтобы понять что в config'е.
 */
import { db } from "../src/lib/db";
import { getSchemaForJournal, getVerifierSlotId, getPrimarySlotId } from "../src/lib/journal-responsible-schemas";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: tsx scripts/diagnose-deeper.ts <orgId-or-email>");
    process.exit(1);
  }
  let orgId = arg;
  if (arg.includes("@")) {
    const u = await db.user.findFirst({
      where: { email: arg },
      select: { organizationId: true },
    });
    if (!u) {
      console.error("user not found");
      process.exit(2);
    }
    orgId = u.organizationId;
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { name: true, journalResponsibleUsersJson: true },
  });
  if (!org) {
    console.error("org not found");
    process.exit(3);
  }
  const respJson = (org.journalResponsibleUsersJson as Record<
    string,
    Record<string, string | null>
  > | null) ?? {};

  console.log(`ORG: ${org.name}\n`);

  // For each journal: schema, slots filled, primary, verifier
  const docs = await db.journalDocument.findMany({
    where: { organizationId: orgId, status: "active" },
    select: {
      id: true,
      template: { select: { code: true } },
      responsibleUserId: true,
      verifierUserId: true,
    },
  });

  console.log(
    "code".padEnd(36) +
      " | primarySlot".padEnd(20) +
      " | verifierSlot".padEnd(20) +
      " | slotsFilled"
  );
  console.log("-".repeat(120));
  for (const d of docs) {
    const code = d.template.code;
    const schema = getSchemaForJournal(code);
    const primarySlot = getPrimarySlotId(code);
    const verifierSlot = getVerifierSlotId(code);
    const slots = respJson[code] ?? {};
    const filled = Object.entries(slots)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(",");
    console.log(
      code.padEnd(36) +
        " | " +
        (primarySlot + (slots[primarySlot] ? "✓" : "✗")).padEnd(20) +
        " | " +
        (verifierSlot + (slots[verifierSlot] ? "✓" : "✗")).padEnd(20) +
        " | " +
        filled
    );
  }

  // Дополнительно: все slot keys что в schema vs что в JSON
  console.log("\n=== SCHEMA vs JSON (one-by-one) ===");
  for (const d of docs.slice(0, 5)) {
    const code = d.template.code;
    const schema = getSchemaForJournal(code);
    const json = respJson[code] ?? {};
    console.log(
      `\n${code}: schema slots = [${schema.slots.map((s) => s.id).join(",")}], json keys = [${Object.keys(json).join(",")}]`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(99);
  });
