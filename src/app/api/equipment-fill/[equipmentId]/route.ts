import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  processTemperatureReading,
  subjectKeyForEquipment,
} from "@/lib/temperature-deviations";
import { verifyEquipmentQrToken } from "@/lib/equipment-qr-token";
import {
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
  normalizeColdEquipmentDocumentConfig,
  normalizeColdEquipmentEntryData,
  pickColdReadingSlotForWrite,
  type ColdEquipmentEntryData,
} from "@/lib/cold-equipment-document";
import { normalizeClimateDocumentConfig } from "@/lib/climate-document";
import {
  findClimateRowForEquipment,
  mergeClimateMeasurement,
  pickNearestControlTime,
} from "@/lib/climate-fill";
import { clientIp } from "@/lib/client-ip";
import { ORG_ROSTER_WHERE } from "@/lib/journal-roster";
import {
  QR_FILL_RATE_LIMIT_ERROR,
  qrFillRateKey,
  recordQrFillAudit,
} from "@/lib/qr-fill-audit";
import { qrFillRateLimiter } from "@/lib/rate-limit";
import { orgTodayKey } from "@/lib/timezone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Submit handler for the public `/equipment-fill/[equipmentId]` page.
 * Worker scanned the QR sticker, picked their name, entered a
 * temperature.
 *
 * Flow:
 *   1. Verify HMAC QR token → equipment is reachable.
 *   2. Load equipment + its organization + active cold_equipment_control
 *      documents covering today that reference this equipment via
 *      `sourceEquipmentId`.
 *   3. For each matching doc, upsert today's JournalDocumentEntry for
 *      the picked employee, merging in `temperatures[configItemId]`.
 *   4. Fire a Telegram alert if the reading is out-of-range.
 */
const bodySchema = z.object({
  token: z.string().min(10),
  employeeId: z.string().min(1),
  temperature: z.number(),
  /** Опциональная влажность для оборудования с climate-mapping. */
  humidity: z.number().min(0).max(100).optional(),
});

function toPrismaJsonValue(
  value: unknown
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ equipmentId: string }> }
) {
  const { equipmentId } = await params;

  if (!qrFillRateLimiter.consume(qrFillRateKey(clientIp(request), "equipment", equipmentId))) {
    return NextResponse.json({ error: QR_FILL_RATE_LIMIT_ERROR }, { status: 429 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const verify = verifyEquipmentQrToken(parsed.token);
  if (!verify.ok || verify.equipmentId !== equipmentId) {
    return NextResponse.json(
      { error: "Неверная QR-наклейка" },
      { status: 401 }
    );
  }

  const equipment = await db.equipment.findUnique({
    where: { id: equipmentId },
    include: {
      area: {
        select: {
          id: true,
          organizationId: true,
          name: true,
          organization: { select: { timezone: true } },
        },
      },
    },
  });
  if (!equipment) {
    return NextResponse.json({ error: "Оборудование не найдено" }, { status: 404 });
  }
  const organizationId = equipment.area.organizationId;

  // Employee must belong to the same organization — protects against a
  // leaked token being paired with a cross-tenant user id.
  const employee = await db.user.findFirst({
    where: {
      id: parsed.employeeId,
      organizationId,
      ...ORG_ROSTER_WHERE,
    },
    select: { id: true, name: true },
  });
  if (!employee) {
    return NextResponse.json(
      { error: "Сотрудник не найден" },
      { status: 404 }
    );
  }

  const now = new Date();
  // «Сегодня» — в зоне организации: на проде процесс живёт в UTC, и ночной
  // замер до 03:00 МСК уходил во вчерашнюю строку.
  const timezone = equipment.area.organization.timezone || "Europe/Moscow";
  const dateKey = orgTodayKey(timezone, now);
  const todayStart = new Date(`${dateKey}T00:00:00.000Z`);

  const docs = await db.journalDocument.findMany({
    where: {
      organizationId,
      status: "active",
      template: { code: COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE },
      dateFrom: { lte: todayStart },
      dateTo: { gte: todayStart },
    },
    select: { id: true, config: true },
  });

  let touched = 0;
  const touchedDocumentIds: string[] = [];
  for (const doc of docs) {
    const config = normalizeColdEquipmentDocumentConfig(doc.config);
    const matching = config.equipment.filter(
      (item) => item.sourceEquipmentId === equipmentId
    );
    if (matching.length === 0) continue;

    const existing = await db.journalDocumentEntry.findUnique({
      where: {
        documentId_employeeId_date: {
          documentId: doc.id,
          employeeId: employee.id,
          date: todayStart,
        },
      },
      select: { data: true },
    });
    const current: ColdEquipmentEntryData = normalizeColdEquipmentEntryData(
      existing?.data ?? null
    );
    const temperatures = { ...current.temperatures };
    // Замеры дня по всем сотрудникам: второй скан за день ложится во второй
    // замер (режим «2 раза в день»), а не затирает утренний.
    const dayEntries = await db.journalDocumentEntry.findMany({
      where: { documentId: doc.id, date: todayStart },
      select: { data: true },
    });
    const dayTemperatures: Record<string, number | null> = {};
    for (const dayEntry of dayEntries) {
      const dayData = normalizeColdEquipmentEntryData(dayEntry.data ?? null);
      for (const [key, value] of Object.entries(dayData.temperatures)) {
        if (value != null) dayTemperatures[key] = value;
      }
    }
    for (const item of matching) {
      const slotKey = pickColdReadingSlotForWrite(item, dayTemperatures);
      temperatures[slotKey] = parsed.temperature;
      dayTemperatures[slotKey] = parsed.temperature;
    }
    const nextData: ColdEquipmentEntryData = {
      responsibleTitle: current.responsibleTitle,
      temperatures,
    };

    await db.journalDocumentEntry.upsert({
      where: {
        documentId_employeeId_date: {
          documentId: doc.id,
          employeeId: employee.id,
          date: todayStart,
        },
      },
      create: {
        documentId: doc.id,
        employeeId: employee.id,
        date: todayStart,
        data: toPrismaJsonValue(nextData),
      },
      update: { data: toPrismaJsonValue(nextData) },
    });
    touched += 1;
    touchedDocumentIds.push(doc.id);
  }

  // Если юзер ввёл humidity И у equipment есть climate-mapping — пишем
  // в active climate_control document. Используется в кондитерках,
  // где один датчик отвечает за temperature + humidity комнаты.
  let humidityTouched = 0;
  if (typeof parsed.humidity === "number") {
    const climateMapping = await db.equipmentSensorMapping.findFirst({
      where: {
        equipmentId: equipment.id,
        readingType: "humidity",
        template: { code: "climate_control" },
      },
      select: { templateId: true },
    });
    if (climateMapping) {
      const climateDoc = await db.journalDocument.findFirst({
        where: {
          organizationId,
          templateId: climateMapping.templateId,
          status: "active",
          dateFrom: { lte: todayStart },
          dateTo: { gte: todayStart },
        },
        select: { id: true, config: true },
      });
      if (climateDoc) {
        const climateConfig = normalizeClimateDocumentConfig(climateDoc.config);
        // Строка климата — цех оборудования (`room-area-<areaId>` или
        // совпадение названия). Раньше ключом был id самого оборудования:
        // такой строки в бланке нет, и влажность пропадала.
        const climateRow = findClimateRowForEquipment(climateConfig, {
          areaId: equipment.area.id,
          areaName: equipment.area.name,
        });
        if (climateRow) {
          const slot = pickNearestControlTime(climateConfig.controlTimes, now, timezone);
          const existing = await db.journalDocumentEntry.findUnique({
            where: {
              documentId_employeeId_date: {
                documentId: climateDoc.id,
                employeeId: employee.id,
                date: todayStart,
              },
            },
            select: { data: true },
          });
          const nextData = mergeClimateMeasurement(existing?.data ?? null, climateRow.id, slot, {
            temperature: parsed.temperature,
            humidity: parsed.humidity,
          });

          await db.journalDocumentEntry.upsert({
            where: {
              documentId_employeeId_date: {
                documentId: climateDoc.id,
                employeeId: employee.id,
                date: todayStart,
              },
            },
            create: {
              documentId: climateDoc.id,
              employeeId: employee.id,
              date: todayStart,
              data: toPrismaJsonValue(nextData),
            },
            update: { data: toPrismaJsonValue(nextData) },
          });
          humidityTouched = 1;
          touchedDocumentIds.push(climateDoc.id);
        }
      }
    }
  }

  // Показание не легло ни в один активный журнал на сегодня — раньше
  // отвечали «ok» с touched: 0, и сотрудник думал, что замер записан.
  if (touched === 0 && humidityTouched === 0) {
    return NextResponse.json(
      {
        code: "no-active-document",
        error:
          "Сегодня это оборудование не входит ни в один активный журнал температуры. Попросите управляющего создать документ или добавить в него оборудование.",
      },
      { status: 409 }
    );
  }

  // Отклонение → тот же обработчик, что у датчиков: ответственному за
  // журнал сразу, руководству — если не исправит (temperature-deviations).
  const isOutOfRange =
    (equipment.tempMin != null && parsed.temperature < equipment.tempMin) ||
    (equipment.tempMax != null && parsed.temperature > equipment.tempMax);
  await processTemperatureReading({
    organizationId,
    subjectKey: subjectKeyForEquipment(equipment.id),
    subjectName: equipment.name,
    value: parsed.temperature,
    tempMin: equipment.tempMin,
    tempMax: equipment.tempMax,
    equipmentId: equipment.id,
    source: `${employee.name} (QR)`,
  });

  await recordQrFillAudit({
    request,
    organizationId,
    kind: "equipment",
    objectId: equipment.id,
    objectName: equipment.name,
    employee,
    documentIds: touchedDocumentIds,
    dateKey,
    temperature: parsed.temperature,
    humidity: parsed.humidity,
    outOfRange: isOutOfRange,
  });

  return NextResponse.json({
    ok: true,
    touched,
    humidityTouched,
    outOfRange: isOutOfRange,
  });
}
