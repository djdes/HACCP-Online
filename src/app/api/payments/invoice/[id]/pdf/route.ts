import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { invoiceFilename } from "@/lib/invoices/build";
import { renderInvoice } from "@/lib/invoices/service";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { getServerSession } from "@/lib/server-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — PDF счёта: своя организация с полным доступом или ROOT. */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const { id: raw } = await ctx.params;
  const orderId = Number.parseInt(raw, 10);
  if (!Number.isFinite(orderId)) return NextResponse.json({ error: "Не найдено" }, { status: 404 });

  const order = await db.paymentOrder.findUnique({
    where: { id: orderId },
    select: { organizationId: true, paymentMethod: true, status: true },
  });
  if (!order || order.paymentMethod !== "invoice") return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const own =
    order.organizationId !== null &&
    order.organizationId === getActiveOrgId(session) &&
    hasFullWorkspaceAccess(session.user);
  if (!own && !session.user.isRoot) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (order.status === "cancelled") return NextResponse.json({ error: "Счёт отменён" }, { status: 410 });

  const rendered = await renderInvoice(orderId);
  if (!rendered) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const name = invoiceFilename(String(orderId));
  return new NextResponse(new Uint8Array(rendered.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name.ascii}"; filename*=UTF-8''${encodeURIComponent(name.utf8)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
