import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROBE_ID = "runtime-probe-ee7e8a0-1";

export async function GET() {
  return NextResponse.json(
    { probeId: PROBE_ID },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    }
  );
}
