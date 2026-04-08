import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function readBuildFile(filename: string, fallback: string) {
  try {
    return (await readFile(filename, "utf-8")).trim();
  } catch {
    return fallback;
  }
}

export async function GET() {
  const buildId = await readBuildFile(
    ".build-sha",
    process.env.NEXT_PUBLIC_BUILD_ID || "dev"
  );
  const buildTime = await readBuildFile(
    ".build-time",
    process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString()
  );

  return NextResponse.json(
    {
      buildId: buildId.slice(0, 7),
      buildTime,
      fullBuildId: buildId,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}
