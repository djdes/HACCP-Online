import { db } from "@/lib/db";
(async () => {
  const org = await db.organization.findUnique({ where: { id: "cmoe6rpt4000097ts71yb922y" }, select: { disabledJournalCodes: true } });
  const codes = (org?.disabledJournalCodes ?? []) as string[];
  console.log("cold disabled:", codes.includes("cold_equipment_control"), "climate disabled:", codes.includes("climate_control"));
  const b = await db.building.findMany({ where: { organizationId: "cmoe6rpt4000097ts71yb922y" }, select: { id: true, name: true, rooms: { select: { id: true, name: true, climateNorms: true } } } });
  console.log(JSON.stringify(b));
  const areas = await db.area.findMany({ where: { organizationId: "cmoe6rpt4000097ts71yb922y" }, select: { id: true, name: true } });
  console.log("areas", JSON.stringify(areas));
  await db.$disconnect();
})();
