import { NextResponse } from "next/server";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { supportOperatorLimiter } from "@/lib/rate-limit";
import {
  deliverOperatorMessage,
  getOrCreateOrgThread,
  parseOperatorInput,
  postOperatorMessage,
} from "@/lib/support-threads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORM_ORG_ID = (process.env.PLATFORM_ORG_ID ?? "platform").trim();

/** ROOT пишет организации первым: ветка создаётся, если её ещё не было. */
export async function POST(request: Request) {
  const session = await requireRoot();
  const raw = (await request.json().catch(() => null)) as { organizationId?: unknown } | null;
  const organizationId = typeof raw?.organizationId === "string" ? raw.organizationId : "";
  if (!organizationId || organizationId === PLATFORM_ORG_ID) {
    return NextResponse.json({ error: "Выберите организацию" }, { status: 400 });
  }
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!organization) {
    return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  }
  const input = parseOperatorInput(raw, session.user.id);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  if (!supportOperatorLimiter.consume(session.user.id)) {
    return NextResponse.json({ error: "Слишком много сообщений подряд" }, { status: 429 });
  }

  const thread = await getOrCreateOrgThread(organization.id, {
    organizationName: organization.name,
    userEmail: null,
    userName: null,
    phone: null,
  });
  const operator = {
    kind: "admin" as const,
    name: "Поддержка WeSetup",
    userId: session.user.id,
    partnerId: null,
  };
  const posted = await postOperatorMessage({
    threadId: thread.id,
    body: input.body,
    attachments: input.attachments,
    operator,
  });
  const delivered = await deliverOperatorMessage({ ...posted, operator });
  return NextResponse.json({ threadId: thread.id, message: posted.message, delivered });
}
