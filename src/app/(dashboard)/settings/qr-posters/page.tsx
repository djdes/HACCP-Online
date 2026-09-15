import { redirect } from "next/navigation";
import QRCode from "qrcode";

import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import {
  CLIMATE_DOCUMENT_TEMPLATE_CODE,
  DEFAULT_CLIMATE_HUMIDITY,
  DEFAULT_CLIMATE_TEMPERATURE,
  normalizeClimateDocumentConfig,
  normalizeClimateRoomNorms,
  type ClimateMetricConfig,
} from "@/lib/climate-document";
import {
  COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE,
  normalizeColdEquipmentDocumentConfig,
} from "@/lib/cold-equipment-document";
import { db } from "@/lib/db";
import { mintQrFillToken, verifyQrFillToken } from "@/lib/qr-fill-token";
import { resolveQrPosterOrigin } from "@/lib/qr-poster-origin";
import { loadDirectoryBuildings } from "@/lib/room-directory";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { QrPostersClient, type QrPoster } from "./qr-posters-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = { title: "QR-плакаты" };

type Kind = "rooms" | "equipment";

function metricLabel(metric: ClimateMetricConfig, unit: string): string | null {
  if (!metric.enabled) return null;
  if (metric.min !== null && metric.max !== null) return `${metric.min}…${metric.max} ${unit}`;
  if (metric.min !== null) return `от ${metric.min} ${unit}`;
  if (metric.max !== null) return `до ${metric.max} ${unit}`;
  return null;
}

function rangeLabel(min: number | null, max: number | null, unit: string): string | null {
  if (min !== null && max !== null) return `${min}…${max} ${unit}`;
  if (min !== null) return `от ${min} ${unit}`;
  if (max !== null) return `до ${max} ${unit}`;
  return null;
}

async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 600 });
}

/**
 * A4-плакаты с QR-кодом: один объект на лист. Склад — температура и
 * влажность помещения в журнал климата, холодильник — температура в журнал
 * холодильного оборудования. Сотрудник сканирует камерой телефона и вносит
 * показание без входа в кабинет.
 *
 *   ?kind=rooms|equipment   — что печатать (по умолчанию склады)
 *   &ids=a,b                — только эти объекты
 *   &doc=<id>               — только объекты из строк документа
 *   &origin=https://…       — домен ссылок (для проверки на стенде)
 */
export default async function QrPostersPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; ids?: string; doc?: string; origin?: string }>;
}) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/settings");
  const organizationId = getActiveOrgId(session);
  const query = await searchParams;
  const kind: Kind = query.kind === "equipment" ? "equipment" : "rooms";
  const onlyIds = new Set(
    (query.ids ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const origin = resolveQrPosterOrigin({
    requested: query.origin,
    configured: process.env.NEXTAUTH_URL || process.env.PUBLIC_URL,
    production: process.env.NODE_ENV === "production",
  });

  // Документ ограничивает список своими строками (кнопка «QR-плакаты» в журнале).
  let documentScope: { title: string; ids: Set<string> } | null = null;
  if (query.doc) {
    const document = await db.journalDocument.findFirst({
      where: { id: query.doc, organizationId },
      select: { title: true, config: true, template: { select: { code: true } } },
    });
    if (document?.template.code === CLIMATE_DOCUMENT_TEMPLATE_CODE && kind === "rooms") {
      const config = normalizeClimateDocumentConfig(document.config);
      documentScope = {
        title: document.title,
        ids: new Set(config.rooms.map((room) => room.roomId).filter((id): id is string => Boolean(id))),
      };
    } else if (document?.template.code === COLD_EQUIPMENT_DOCUMENT_TEMPLATE_CODE && kind === "equipment") {
      const config = normalizeColdEquipmentDocumentConfig(document.config);
      documentScope = {
        title: document.title,
        ids: new Set(
          config.equipment.map((item) => item.sourceEquipmentId).filter((id): id is string => Boolean(id))
        ),
      };
    }
  }
  const allowed = (id: string) =>
    (onlyIds.size === 0 || onlyIds.has(id)) && (!documentScope || documentScope.ids.has(id));

  const posters: QrPoster[] = [];
  if (kind === "rooms") {
    const buildings = await loadDirectoryBuildings(organizationId);
    for (const building of buildings) {
      for (const room of building.rooms) {
        if (!allowed(room.id)) continue;
        const norms = normalizeClimateRoomNorms(room.climateNorms);
        const token = mintQrFillToken("room", room.id);
        const verified = verifyQrFillToken(token);
        const url = `${origin}/room-fill/${room.id}?token=${encodeURIComponent(token)}`;
        posters.push({
          id: room.id,
          kind: "room",
          title: room.name,
          subtitle: building.name,
          norms: [
            metricLabel(norms?.temperature ?? DEFAULT_CLIMATE_TEMPERATURE, "°C"),
            metricLabel(norms?.humidity ?? DEFAULT_CLIMATE_HUMIDITY, "%"),
          ].filter((label): label is string => Boolean(label)),
          url,
          svg: await qrSvg(url),
          expiresAt: verified.ok ? new Date(verified.expiresAt).toISOString() : null,
        });
      }
    }
  } else {
    const equipment = await db.equipment.findMany({
      where: { area: { organizationId } },
      orderBy: [{ area: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, tempMin: true, tempMax: true, area: { select: { name: true } } },
    });
    for (const item of equipment) {
      if (!allowed(item.id)) continue;
      const token = mintQrFillToken("equipment", item.id);
      const verified = verifyQrFillToken(token);
      const url = `${origin}/equipment-fill/${item.id}?token=${encodeURIComponent(token)}`;
      const norm = rangeLabel(item.tempMin, item.tempMax, "°C");
      posters.push({
        id: item.id,
        kind: "equipment",
        title: item.name,
        subtitle: item.area.name,
        norms: norm ? [norm] : [],
        url,
        svg: await qrSvg(url),
        expiresAt: verified.ok ? new Date(verified.expiresAt).toISOString() : null,
      });
    }
  }

  return (
    <QrPostersClient
      kind={kind}
      posters={posters}
      origin={origin}
      documentTitle={documentScope?.title ?? null}
      documentId={documentScope ? query.doc ?? null : null}
    />
  );
}
