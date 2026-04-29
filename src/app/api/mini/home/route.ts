import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { getDisabledJournalCodes } from "@/lib/disabled-journals";
import {
  getManagerObligationSummary,
  listOpenJournalObligationsForUser,
  syncDailyJournalObligationsForOrganization,
  syncDailyJournalObligationsForUser,
} from "@/lib/journal-obligations";
import {
  aclActorFromSession,
  getAllowedJournalCodes,
} from "@/lib/journal-acl";
import { getUserPermissions } from "@/lib/permissions-server";
import { getServerSession } from "@/lib/server-session";
import { getManagerScope, getAssignableJournalCodes } from "@/lib/manager-scope";
import { hasFullWorkspaceAccess } from "@/lib/role-access";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }
  const requestNow = new Date();

  const actor = aclActorFromSession({
    user: {
      id: session.user.id,
      role: session.user.role,
      isRoot: session.user.isRoot === true,
    },
  });
  const [allowedCodes, disabledCodes, perms, areas, scope] = await Promise.all([
    getAllowedJournalCodes(actor),
    getDisabledJournalCodes(getActiveOrgId(session)),
    getUserPermissions(session.user.id),
    db.area.findMany({
      where: { organizationId: getActiveOrgId(session), lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, lat: true, lng: true },
    }),
    getManagerScope(session.user.id, getActiveOrgId(session)),
  ]);
  const fullAccess = hasFullWorkspaceAccess({
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  });

  const assignableCodes = getAssignableJournalCodes(scope, allowedCodes);

  // Permission-based mode detection (mirrors start-home.ts logic).
  const isManagerLike =
    session.user.isRoot === true ||
    perms.has("dashboard.view") ||
    perms.has("staff.manage");
  const canFillJournals =
    session.user.isRoot === true || perms.has("journals.fill");

  const rawTemplates = await db.journalTemplate.findMany({
    where:
      assignableCodes === null
        ? { isActive: true }
        : { isActive: true, code: { in: assignableCodes } },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  const templates = rawTemplates.filter(
    (template) => !disabledCodes.has(template.code)
  );
  const user = {
    name: session.user.name ?? "",
    organizationName: session.user.organizationName ?? "",
  };

  // Expose resolved permissions so the client can gate UI without
  // re-implementing the resolve chain.
  const permissionList = Array.from(perms);

  if (isManagerLike) {
    try {
      await syncDailyJournalObligationsForOrganization(
        getActiveOrgId(session),
        requestNow
      );
    } catch (syncErr) {
      console.error("[mini:home] org sync failed:", syncErr);
    }
    const summary = await getManagerObligationSummary(
      getActiveOrgId(session),
      requestNow
    );

    return NextResponse.json({
      user,
      mode: "manager",
      permissions: permissionList,
      summary,
      areas,
      all: templates.map((template) => ({
        code: template.code,
        name: template.name,
        description: template.description,
        filled: false,
      })),
    });
  }

  if (!canFillJournals) {
    // Read-only mode: no obligations, just viewable journals.
    return NextResponse.json({
      user,
      mode: "readonly",
      permissions: permissionList,
      areas,
      all: templates.map((template) => ({
        code: template.code,
        name: template.name,
        description: template.description,
        filled: false,
      })),
    });
  }

  try {
    await syncDailyJournalObligationsForUser({
      userId: session.user.id,
      organizationId: getActiveOrgId(session),
      now: requestNow,
    });
  } catch (syncErr) {
    console.error("[mini:home] user sync failed:", syncErr);
  }
  const now = await listOpenJournalObligationsForUser(
    session.user.id,
    requestNow
  );
  const openJournalCodes = new Set(now.map((row) => row.journalCode));

  // Phase 3 (шаг 3.4): подтягиваем bonusAmountKopecks + claim-state по
  // тем же obligation-ам отдельным запросом, чтобы не ломать сигнатуру
  // общего helper-а `listOpenJournalObligationsForUser`. UI решает
  // показывать ли «Взять с бонусом» или «уже взял Иван в 12:34».
  const obligationIds = now.map((row) => row.id);
  const bonusRows = obligationIds.length
    ? await db.journalObligation.findMany({
        where: { id: { in: obligationIds } },
        select: {
          id: true,
          claimedById: true,
          claimedAt: true,
          template: { select: { bonusAmountKopecks: true } },
        },
      })
    : [];
  const claimerIds = Array.from(
    new Set(
      bonusRows
        .map((row) => row.claimedById)
        .filter((id): id is string => typeof id === "string")
    )
  );
  const claimers = claimerIds.length
    ? await db.user.findMany({
        where: { id: { in: claimerIds } },
        select: { id: true, name: true },
      })
    : [];
  const claimerNameById = new Map(
    claimers.map((user) => [user.id, user.name ?? ""])
  );
  const bonusByObligationId = new Map(
    bonusRows.map((row) => [row.id, row])
  );

  return NextResponse.json({
    user,
    mode: "staff",
    permissions: permissionList,
    areas,
    now: now.map((row) => {
      const bonus = bonusByObligationId.get(row.id);
      const bonusAmountKopecks =
        bonus?.template.bonusAmountKopecks ?? 0;
      const claimedById = bonus?.claimedById ?? null;
      const claimedByName =
        claimedById !== null
          ? claimerNameById.get(claimedById) ?? null
          : null;
      const claimedAt = bonus?.claimedAt
        ? bonus.claimedAt.toISOString()
        : null;
      return {
        id: row.id,
        code: row.journalCode,
        name: row.template.name,
        description: row.template.description,
        href: `/mini/o/${row.id}`,
        bonusAmountKopecks,
        claimedById,
        claimedByName,
        claimedAt,
      };
    }),
    all: templates.map((template) => ({
      code: template.code,
      name: template.name,
      description: template.description,
      filled: !openJournalCodes.has(template.code),
    })),
  });
}
