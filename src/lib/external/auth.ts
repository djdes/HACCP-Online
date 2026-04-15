import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export type ExternalAuthSource = "external" | "sensor" | "organization";

export type ExternalAuthResult =
  | {
      ok: true;
      token: string;
      source: ExternalAuthSource;
      /** Organisation resolved from the token, when the caller uses a per-org key. */
      organizationId?: string;
    }
  | { ok: false; response: NextResponse };

function extractBearer(request: Request): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export function tokenHint(token: string | null | undefined): string {
  if (!token) return "none";
  return token.length <= 4 ? "***" : `***${token.slice(-4)}`;
}

/**
 * Validate Bearer token. Resolution order:
 *   1. Per-organisation Organization.externalApiToken (preferred for customer
 *      integrations — scopes writes to that org automatically).
 *   2. Shared EXTERNAL_API_TOKEN env (employee-app fallback).
 *   3. Shared SENSOR_API_TOKEN env (sensor feed).
 *
 * Returns the matched source + (for per-org keys) the organizationId so the
 * route handler can override whatever the payload claimed.
 */
export async function authenticateExternalRequest(request: Request): Promise<ExternalAuthResult> {
  const token = extractBearer(request);
  const external = process.env.EXTERNAL_API_TOKEN?.trim();
  const sensor = process.env.SENSOR_API_TOKEN?.trim();

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Authorization: Bearer <token> required" },
        { status: 401 }
      ),
    };
  }

  // 1. Per-org token lookup. Unique index makes this a single indexed read.
  try {
    const org = await db.organization.findUnique({
      where: { externalApiToken: token },
      select: { id: true },
    });
    if (org) {
      return { ok: true, token, source: "organization", organizationId: org.id };
    }
  } catch {
    // Fall through to env-token comparison.
  }

  if (external && token === external) {
    return { ok: true, token, source: "external" };
  }
  if (sensor && token === sensor) {
    return { ok: true, token, source: "sensor" };
  }

  if (!external && !sensor) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "External API token not configured on server" },
        { status: 503 }
      ),
    };
  }

  return {
    ok: false,
    response: NextResponse.json(
      { ok: false, error: "Invalid token" },
      { status: 401 }
    ),
  };
}
