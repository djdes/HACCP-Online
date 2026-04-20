import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveOrgId, requireRole } from "@/lib/auth-helpers";
import {
  TasksFlowError,
  normalizeRussianPhone,
  tasksflowClientFor,
} from "@/lib/tasksflow-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Refresh the WeSetup ↔ TasksFlow user mapping for the active org.
 *
 * Algorithm:
 *   1. Pull every WeSetup user in the org (we need phone).
 *   2. Pull every TasksFlow user via the bound key.
 *   3. Match by normalized phone — first hit wins on the TasksFlow side.
 *   4. Upsert `TasksFlowUserLink` per WeSetup user. Existing rows with
 *      `source = "manual"` are left alone (the admin pinned them on
 *      purpose, e.g. when phones differ).
 *
 * Returns counts so the UI can show "Связано 7 из 12 сотрудников".
 */
export async function POST() {
  const session = await requireRole([
    "owner",
    "manager",
    "technologist",
    "head_chef",
  ]);
  const orgId = getActiveOrgId(session);
  const integration = await db.tasksFlowIntegration.findUnique({
    where: { organizationId: orgId },
    select: { id: true, baseUrl: true, apiKeyEncrypted: true, enabled: true },
  });
  if (!integration || !integration.enabled) {
    return NextResponse.json(
      { error: "Интеграция не подключена" },
      { status: 400 }
    );
  }

  const wesetupUsers = await db.user.findMany({
    where: { organizationId: orgId, isActive: true },
    select: { id: true, name: true, phone: true, role: true },
  });

  let remoteUsers;
  try {
    remoteUsers = await tasksflowClientFor(integration).listUsers();
  } catch (err) {
    if (err instanceof TasksFlowError) {
      return NextResponse.json(
        { error: `TasksFlow ошибка: ${err.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Не удалось получить список пользователей TasksFlow" },
      { status: 502 }
    );
  }

  const remoteByPhone = new Map<
    string,
    { id: number; name: string | null; phone: string }
  >();
  for (const user of remoteUsers) {
    const normalized = normalizeRussianPhone(user.phone);
    if (!normalized) continue;
    if (!remoteByPhone.has(normalized)) {
      remoteByPhone.set(normalized, {
        id: user.id,
        name: user.name,
        phone: normalized,
      });
    }
  }

  // Don't clobber manual links on the way in.
  const existingLinks = await db.tasksFlowUserLink.findMany({
    where: { integrationId: integration.id },
    select: { id: true, wesetupUserId: true, source: true },
  });
  const existingByUser = new Map(
    existingLinks.map((l) => [l.wesetupUserId, l])
  );

  let linked = 0;
  let withoutPhone = 0;
  let withoutMatch = 0;
  let manualSkipped = 0;

  for (const u of wesetupUsers) {
    const phone = normalizeRussianPhone(u.phone);
    if (!phone) {
      withoutPhone += 1;
      continue;
    }
    const remote = remoteByPhone.get(phone) ?? null;
    if (!remote) withoutMatch += 1;

    const existing = existingByUser.get(u.id);
    if (existing?.source === "manual") {
      manualSkipped += 1;
      continue;
    }

    await db.tasksFlowUserLink.upsert({
      where: {
        integrationId_wesetupUserId: {
          integrationId: integration.id,
          wesetupUserId: u.id,
        },
      },
      create: {
        integrationId: integration.id,
        wesetupUserId: u.id,
        phone,
        tasksflowUserId: remote?.id ?? null,
        tasksflowWorkerId: remote?.id ?? null,
        source: "auto",
      },
      update: {
        phone,
        tasksflowUserId: remote?.id ?? null,
        tasksflowWorkerId: remote?.id ?? null,
        source: "auto",
      },
    });
    if (remote) linked += 1;
  }

  await db.tasksFlowIntegration.update({
    where: { id: integration.id },
    data: { lastSyncAt: new Date() },
  });

  return NextResponse.json({
    totals: {
      wesetupUsers: wesetupUsers.length,
      remoteUsers: remoteUsers.length,
      linked,
      withoutPhone,
      withoutMatch,
      manualSkipped,
    },
  });
}
