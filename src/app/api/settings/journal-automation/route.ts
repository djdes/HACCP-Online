import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import {
  getJournalAutomation,
  isAutomationSupported,
  withJournalAutomation,
} from "@/lib/journal-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/settings/journal-automation
 * Body: { code: string, enabled: boolean }
 *
 * Тумблер «Автосоздание новых журналов и ежедневное автозаполнение»
 * над списком документов журнала. Одна галочка пишет ОБА флага
 * (`autoCreate` + `autoFill`) — раздельно они настраиваются только в
 * /settings/auto-journals.
 */
const bodySchema = z.object({
  code: z.string().min(1),
  enabled: z.boolean(),
});

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  if (
    !hasFullWorkspaceAccess({
      role: session.user.role,
      isRoot: session.user.isRoot,
    })
  ) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  if (!isAutomationSupported(parsed.code)) {
    return NextResponse.json(
      { error: "Для этого журнала автоматизация пока не поддерживается" },
      { status: 400 }
    );
  }

  const organizationId = getActiveOrgId(session);
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { journalAutomationJson: true, autoJournalCodes: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Организация не найдена" }, { status: 404 });
  }

  const next = withJournalAutomation(org.journalAutomationJson, parsed.code, {
    autoCreate: parsed.enabled,
    autoFill: parsed.enabled,
  });

  // Легаси-список держим синхронным: старый cron 04:00 и
  // /settings/auto-journals всё ещё читают `autoJournalCodes`.
  const legacy = new Set(
    Array.isArray(org.autoJournalCodes)
      ? (org.autoJournalCodes as unknown[]).filter(
          (item): item is string => typeof item === "string"
        )
      : []
  );
  if (parsed.enabled) legacy.add(parsed.code);
  else legacy.delete(parsed.code);

  await db.organization.update({
    where: { id: organizationId },
    data: {
      journalAutomationJson: next as never,
      autoJournalCodes: [...legacy] as never,
    },
  });

  await db.auditLog.create({
    data: {
      organizationId,
      userId: session.user.id,
      userName: session.user.name ?? null,
      action: parsed.enabled
        ? "journal.automation.enabled"
        : "journal.automation.disabled",
      entity: "organization",
      entityId: organizationId,
      details: { code: parsed.code },
    },
  });

  return NextResponse.json({
    code: parsed.code,
    automation: getJournalAutomation(
      { journalAutomationJson: next, autoJournalCodes: [...legacy] },
      parsed.code
    ),
  });
}
