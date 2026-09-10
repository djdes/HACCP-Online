import { NextResponse } from "next/server";

import sitemap from "@/app/sitemap";
import { requireRoot } from "@/lib/auth-helpers";
import { cachedSeoHealth, runSeoHealth } from "@/lib/seo/crawl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET — последний отчёт (или null); POST — обойти заново. */
export async function GET() {
  await requireRoot();
  return NextResponse.json({ report: cachedSeoHealth() });
}

export async function POST() {
  await requireRoot();
  const entries = await sitemap();
  const urls = entries.map((e) => e.url);
  const report = await runSeoHealth(urls, { force: true });
  return NextResponse.json({ report });
}
