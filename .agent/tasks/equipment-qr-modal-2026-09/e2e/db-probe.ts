import { db } from "@/lib/db";
(async () => {
  const orgs = await db.organization.findMany({ where: { name: { contains: "Тестовое" } }, select: { id: true, name: true, disabledJournalCodes: true } });
  console.log(JSON.stringify(orgs, null, 1));
  for (const org of orgs) {
    const docs = await db.journalDocument.findMany({
      where: { organizationId: org.id, template: { code: { in: ["cold_equipment_control", "climate_control"] } } },
      select: { id: true, title: true, status: true, dateFrom: true, dateTo: true, template: { select: { code: true } }, config: true },
      orderBy: { dateFrom: "desc" }, take: 6,
    });
    for (const d of docs) {
      const cfg = d.config as Record<string, unknown> | null;
      const rows = Array.isArray(cfg?.equipment) ? cfg!.equipment : Array.isArray(cfg?.rooms) ? cfg!.rooms : [];
      console.log(d.template.code, d.id, d.status, d.dateFrom.toISOString().slice(0,10), d.dateTo.toISOString().slice(0,10), d.title, JSON.stringify((rows as Array<Record<string, unknown>>).map(r => ({ id: r.id, name: r.name, src: r.sourceEquipmentId ?? r.roomId ?? null }))));
    }
    const users = await db.user.findMany({ where: { organizationId: org.id, isActive: true }, select: { id: true, email: true, role: true, name: true } });
    console.log("users", JSON.stringify(users));
    const eq = await db.equipment.findMany({ where: { area: { organizationId: org.id } }, select: { id: true, name: true, tempMin: true, tempMax: true, area: { select: { name: true } } } });
    console.log("equipment", JSON.stringify(eq));
  }
  await db.$disconnect();
})();
