import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  buildColdEquipmentConfigFromEquipment,
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
} from "@/lib/cold-equipment-document";
import {
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  getDefaultClimateDocumentConfig,
} from "@/lib/climate-document";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const templateCode = searchParams.get("templateCode");
  const status = searchParams.get("status") || "active";

  if (!templateCode) {
    return NextResponse.json({ error: "templateCode обязателен" }, { status: 400 });
  }

  const template = await db.journalTemplate.findUnique({ where: { code: templateCode } });
  if (!template) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });

  const documents = await db.journalDocument.findMany({
    where: {
      organizationId: session.user.organizationId,
      templateId: template.id,
      status,
    },
    orderBy: { dateFrom: "desc" },
    include: {
      _count: { select: { entries: true } },
    },
  });

  return NextResponse.json({ documents, template });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  if (!["owner", "technologist"].includes(session.user.role)) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = await request.json();
  const {
    templateCode,
    title,
    dateFrom,
    dateTo,
    responsibleUserId,
    responsibleTitle,
  } = body;

  if (!templateCode || !dateFrom || !dateTo) {
    return NextResponse.json({ error: "templateCode, dateFrom, dateTo обязательны" }, { status: 400 });
  }

  const template = await db.journalTemplate.findUnique({ where: { code: templateCode } });
  if (!template) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });

  const coldEquipmentConfig =
    templateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE
      ? buildColdEquipmentConfigFromEquipment(
          await db.equipment.findMany({
            where: {
              area: {
                organizationId: session.user.organizationId,
              },
            },
            select: {
              id: true,
              name: true,
              type: true,
              tempMin: true,
              tempMax: true,
            },
            orderBy: { name: "asc" },
          })
        )
      : undefined;

  const initialConfig =
    templateCode === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE
      ? coldEquipmentConfig
      : templateCode === CLIMATE_DOCUMENT_TEMPLATE_CODE
      ? getDefaultClimateDocumentConfig()
      : undefined;

  const doc = await db.journalDocument.create({
    data: {
      templateId: template.id,
      organizationId: session.user.organizationId,
      title: title || template.name,
      config: initialConfig ?? undefined,
      dateFrom: new Date(dateFrom),
      dateTo: new Date(dateTo),
      responsibleUserId: responsibleUserId || null,
      responsibleTitle: responsibleTitle || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ document: doc }, { status: 201 });
}
