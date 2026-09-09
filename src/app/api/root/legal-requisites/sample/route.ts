import { NextResponse } from "next/server";

import { requireRoot } from "@/lib/auth-helpers";
import { renderSamplePdf } from "@/lib/closing-documents/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Образец УПД с текущими реквизитами и условным покупателем — чтобы увидеть бланк до первой оплаты. */
export async function GET() {
  await requireRoot();
  const pdf = await renderSamplePdf();
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="UPD-sample.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
