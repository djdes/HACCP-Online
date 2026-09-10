import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import {
  TopvisorError,
  getCheckerPrice,
  isTopvisorConfigured,
  runChecker,
} from "@/lib/topvisor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseRegions(raw: string | null): number[] {
  const parsed = (raw ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return [...new Set(parsed)];
}

function failure(error: unknown) {
  if (error instanceof TopvisorError) {
    return NextResponse.json(
      { error: `Topvisor: ${error.message}`, code: error.code },
      { status: 502 }
    );
  }
  throw error;
}

/**
 * GET /api/root/topvisor/checker?regions=1,5 — сколько будет стоить съём.
 *
 * Съём позиций платный (0,09 ₽ за пару «фраза × регион»), поэтому цена
 * спрашивается ДО запуска и показывается в подтверждении. Списывать
 * деньги молчаливым кликом нельзя.
 */
export async function GET(request: Request) {
  await requireRoot();
  if (!isTopvisorConfigured()) {
    return NextResponse.json({ error: "Topvisor не настроен" }, { status: 400 });
  }

  const regions = parseRegions(new URL(request.url).searchParams.get("regions"));
  if (regions.length === 0) {
    return NextResponse.json({ error: "Не выбраны регионы" }, { status: 400 });
  }

  try {
    return NextResponse.json({ regions, price: await getCheckerPrice(regions) });
  } catch (error) {
    return failure(error);
  }
}

/**
 * POST — поставить проверку позиций в очередь. Тратит деньги.
 *
 * Цену пересчитываем на сервере и возвращаем вместе с результатом: то,
 * что показали в диалоге, и то, что реально спишется, должно совпадать,
 * даже если вкладка висела открытой полчаса.
 */
export async function POST(request: Request) {
  await requireRoot();
  if (!isTopvisorConfigured()) {
    return NextResponse.json({ error: "Topvisor не настроен" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    regions?: unknown;
  } | null;
  const regions = (Array.isArray(body?.regions) ? body.regions : [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (regions.length === 0) {
    return NextResponse.json({ error: "Не выбраны регионы" }, { status: 400 });
  }

  try {
    const price = await getCheckerPrice([...new Set(regions)]);
    const queued = await runChecker([...new Set(regions)]);
    return NextResponse.json({ queued, price });
  } catch (error) {
    return failure(error);
  }
}
