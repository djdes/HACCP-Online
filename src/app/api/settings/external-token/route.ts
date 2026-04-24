import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireApiRole } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns the current organisation's external API token (or null if
 * unset). Owner/manager only.
 */
export async function GET() {
  const auth = await requireApiRole(["owner", "manager", "technologist", "head_chef"]);
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const org = await db.organization.findUnique({
    where: { id: getActiveOrgId(session) },
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
  const auth = await requireApiRole(["owner", "manager"]);
  if (!auth.ok) return auth.response;
  const session = auth.session;
  const token = crypto.randomBytes(32).toString("hex");
  await db.organization.update({
    where: { id: getActiveOrgId(session) },
    data: { externalApiToken: token },
  });
  return NextResponse.json({ token });
}

export async function DELETE() {
  const auth = await requireApiRole(["owner", "manager"]);
  if (!auth.ok) return auth.response;
  const session = auth.session;
  await db.organization.update({
    where: { id: getActiveOrgId(session) },
    data: { externalApiToken: null },
  });
  return NextResponse.json({ token: null });
}
