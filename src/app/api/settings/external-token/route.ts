import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the current organisation's external API token (or null if
 * unset). Owner/manager only.
 */
export async function GET() {
  const session = await requireRole(["owner", "manager", "technologist", "head_chef"]);
  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { externalApiToken: true },
  });
  return NextResponse.json({ token: org?.externalApiToken ?? null });
}

/**
 * Rotates the organisation's external API token. Call POST to generate a
 * fresh 32-byte hex key; this invalidates any prior key. DELETE unsets it,
 * falling back to the shared EXTERNAL_API_TOKEN env for backwards-compat.
 */
export async function POST() {
  const session = await requireRole(["owner", "manager"]);
  const token = crypto.randomBytes(32).toString("hex");
  await db.organization.update({
    where: { id: session.user.organizationId },
    data: { externalApiToken: token },
  });
  return NextResponse.json({ token });
}

export async function DELETE() {
  const session = await requireRole(["owner", "manager"]);
  await db.organization.update({
    where: { id: session.user.organizationId },
    data: { externalApiToken: null },
  });
  return NextResponse.json({ token: null });
}
