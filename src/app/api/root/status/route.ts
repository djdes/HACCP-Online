import { NextResponse } from "next/server";
import { z } from "zod";

import { requireRoot } from "@/lib/auth-helpers";
import { readPlatformStatus, writePlatformStatus } from "@/lib/platform-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isoOrNull = z.string().datetime().nullable().optional();

const schema = z.object({
  announcement: z
    .object({
      id: z.string().trim().min(1).max(64),
      kind: z.enum(["info", "maintenance", "incident"]),
      text: z.string().trim().max(300),
      link: z.string().trim().max(300).nullable().optional(),
      startsAt: isoOrNull,
      endsAt: isoOrNull,
      active: z.boolean(),
    })
    .nullable(),
  incidents: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        kind: z.enum(["incident", "maintenance"]),
        title: z.string().trim().min(1).max(200),
        note: z.string().trim().max(1000).nullable().optional(),
        startedAt: z.string().datetime(),
        resolvedAt: isoOrNull,
      })
    )
    .max(30),
});

export async function GET() {
  await requireRoot();
  return NextResponse.json(await readPlatformStatus());
}

/** PUT — объявление и список инцидентов целиком; клиент прислал то, что видит. */
export async function PUT(request: Request) {
  await requireRoot();
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Некорректные данные" }, { status: 400 });
  }
  const now = new Date().toISOString();
  const saved = await writePlatformStatus({
    announcement: parsed.data.announcement
      ? {
          ...parsed.data.announcement,
          link: parsed.data.announcement.link ?? null,
          startsAt: parsed.data.announcement.startsAt ?? null,
          endsAt: parsed.data.announcement.endsAt ?? null,
          updatedAt: now,
        }
      : null,
    incidents: parsed.data.incidents.map((i) => ({ ...i, note: i.note ?? null, resolvedAt: i.resolvedAt ?? null })),
  });
  return NextResponse.json(saved);
}
