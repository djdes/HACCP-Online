/* eslint-disable no-console */
// Посев для проверки климата: здание + помещение с нормами в тестовой
// организации. Снимок исходных конфигов документов — для cleanup.
import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";

const ORG = "cmoe6rpt4000097ts71yb922y";
const COLD_DOC = "cmu3e8tav00gqd7tspsb35swv";
const CLIMATE_DOC = "cmt6j45ne0hy482ts2ii5wkkd";
const STATE = path.resolve(process.cwd(), ".agent/tasks/equipment-qr-modal-2026-09/e2e/state.json");

(async () => {
  const [cold, climate] = await Promise.all([
    db.journalDocument.findUnique({ where: { id: COLD_DOC }, select: { config: true } }),
    db.journalDocument.findUnique({ where: { id: CLIMATE_DOC }, select: { config: true } }),
  ]);
  const areasBefore = await db.area.findMany({ where: { organizationId: ORG }, select: { id: true } });
  const building = await db.building.create({
    data: { organizationId: ORG, name: "E2E Здание QR" },
    select: { id: true },
  });
  const room = await db.room.create({
    data: {
      buildingId: building.id,
      name: "E2E Склад QR",
      kind: "storage",
      climateNorms: {
        temperature: { enabled: true, min: 18, max: 25 },
        humidity: { enabled: true, min: 15, max: 75 },
      },
    },
    select: { id: true },
  });
  fs.writeFileSync(
    STATE,
    JSON.stringify(
      {
        org: ORG,
        coldDoc: COLD_DOC,
        climateDoc: CLIMATE_DOC,
        coldConfig: cold?.config ?? null,
        climateConfig: climate?.config ?? null,
        areaIdsBefore: areasBefore.map((a) => a.id),
        buildingId: building.id,
        roomId: room.id,
      },
      null,
      2
    )
  );
  console.log(JSON.stringify({ buildingId: building.id, roomId: room.id }));
  await db.$disconnect();
})();
