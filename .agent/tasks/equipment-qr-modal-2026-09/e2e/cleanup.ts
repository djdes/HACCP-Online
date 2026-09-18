/* eslint-disable no-console */
// Откат посева и следов проверки: конфиги документов, созданное
// оборудование, цех «Основной цех» (если его не было), здание + помещение.
import fs from "node:fs";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const STATE = path.resolve(process.cwd(), ".agent/tasks/equipment-qr-modal-2026-09/e2e/state.json");

(async () => {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8")) as {
    org: string;
    coldDoc: string;
    climateDoc: string;
    coldConfig: unknown;
    climateConfig: unknown;
    areaIdsBefore: string[];
    buildingId: string;
    roomId: string;
  };
  const asJson = (value: unknown) =>
    value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

  await db.journalDocument.update({ where: { id: state.coldDoc }, data: { config: asJson(state.coldConfig) } });
  await db.journalDocument.update({ where: { id: state.climateDoc }, data: { config: asJson(state.climateConfig) } });
  // Строки замеров под удалённые строки — пересобираются самим документом (sync_entries);
  // в проверке замеры не вносились.
  const removedEquipment = await db.equipment.deleteMany({
    where: { area: { organizationId: state.org }, name: { startsWith: "Тест QR" } },
  });
  const removedAreas = await db.area.deleteMany({
    where: { organizationId: state.org, id: { notIn: state.areaIdsBefore }, equipment: { none: {} } },
  });
  await db.room.deleteMany({ where: { id: state.roomId } });
  await db.building.deleteMany({ where: { id: state.buildingId } });
  console.log(JSON.stringify({ removedEquipment: removedEquipment.count, removedAreas: removedAreas.count }));
  await db.$disconnect();
})();
