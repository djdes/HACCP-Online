import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyEquipmentQrToken } from "@/lib/equipment-qr-token";
import {
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
  normalizeColdEquipmentDocumentConfig,
  normalizeColdEquipmentEntryData,
  type ColdEquipmentEntryData,
} from "@/lib/cold-equipment-document";
import {
  notifyOrganization,
  escapeTelegramHtml as esc,
} from "@/lib/telegram";

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

function utcDayStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ equipmentId: string }> }
) {
  const { equipmentId } = await params;

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
      area: { select: { organizationId: true, name: true } },
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
      isActive: true,
      archivedAt: null,
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
  const todayStart = utcDayStart(now);

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
    for (const item of matching) {
      temperatures[item.id] = parsed.temperature;
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
        const cfg = (climateDoc.config as { controlTimes?: unknown }) ?? {};
        const controlTimes = Array.isArray(cfg.controlTimes)
          ? (cfg.controlTimes as unknown[]).filter(
              (t): t is string => typeof t === "string"
            )
          : [];
        // Ближайшее controlTime к текущему часу — куда логично записать
        // показание с QR-сканирования. Если controlTimes пусто — fallback
        // на "now-rounded" "HH:MM".
        const nowMin = now.getHours() * 60 + now.getMinutes();
        let slot: string;
        if (controlTimes.length > 0) {
          let best = controlTimes[0];
          let bestDelta = Number.POSITIVE_INFINITY;
          for (const t of controlTimes) {
            const m = /^(\d{1,2}):(\d{2})$/.exec(t);
            if (!m) continue;
            const v = Number(m[1]) * 60 + Number(m[2]);
            const d = Math.abs(v - nowMin);
            if (d < bestDelta) {
              best = t;
              bestDelta = d;
            }
          }
          slot = best;
        } else {
          slot = `${String(now.getHours()).padStart(2, "0")}:00`;
        }

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
        const baseData =
          (existing?.data as Record<string, unknown>) ?? {};
        const prevMeasurements =
          (baseData.measurements as
            | Record<string, Record<string, Record<string, unknown>>>
            | undefined) ?? {};
        const prevRoom = prevMeasurements[equipment.id] ?? {};
        const prevSlot = prevRoom[slot] ?? {};
        const nextData = {
          ...baseData,
          measurements: {
            ...prevMeasurements,
            [equipment.id]: {
              ...prevRoom,
              [slot]: {
                ...prevSlot,
                temperature: parsed.temperature,
                humidity: parsed.humidity,
              },
            },
          },
        };

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
      }
    }
  }

  // Out-of-range alerting — matches the Tuya-collect behaviour so
  // human-entered readings get the same visibility as IoT ones.
  const isOutOfRange =
    (equipment.tempMin != null && parsed.temperature < equipment.tempMin) ||
    (equipment.tempMax != null && parsed.temperature > equipment.tempMax);
  if (isOutOfRange) {
    const rangeStr = [
      equipment.tempMin != null ? `от ${equipment.tempMin}` : "",
      equipment.tempMax != null ? `до ${equipment.tempMax}` : "",
    ]
      .filter(Boolean)
      .join(" ");
    const message =
      `<b>Отклонение температуры!</b>\n\n` +
      `Оборудование: <b>${esc(equipment.name)}</b>\n` +
      `Зафиксировано: <b>${parsed.temperature}°C</b>\n` +
      `Допустимый диапазон: ${esc(rangeStr)}°C\n` +
      `Снял показания: ${esc(employee.name)} (QR)`;
    notifyOrganization(
      organizationId,
      message,
      ["owner", "technologist"],
      "temperature"
    ).catch((err) => {
      console.error("[equipment-fill] telegram alert failed", err);
    });
  }

  return NextResponse.json({
    ok: true,
    touched,
    humidityTouched,
    outOfRange: isOutOfRange,
  });
}
