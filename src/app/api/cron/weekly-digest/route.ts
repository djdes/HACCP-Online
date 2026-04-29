import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkCronSecret } from "@/lib/cron-auth";
import {
  notifyOrganization,
  escapeTelegramHtml as esc,
} from "@/lib/telegram";
import { getTemplatesFilledToday } from "@/lib/today-compliance";
import { parseDisabledCodes } from "@/lib/disabled-journals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly digest для руководства каждой организации. Дёргается раз в неделю
 * (понедельник утром по МСК) внешним шедулером:
 *
 *   GET/POST /api/cron/weekly-digest?secret=$CRON_SECRET
 *
 * Что делает:
 *   1. Берёт все активные организации.
 *   2. На каждую считает за прошедшие 7 дней:
 *        - сколько журналов заполнено (по дням)
 *        - средний % compliance
 *        - какой журнал чаще всего «не заполнен» (нижний топ-3)
 *        - какой сотрудник чаще всех заполнял (топ-1, для kudos)
 *        - сколько TasksFlow задач выполнено / просрочено
 *   3. Шлёт через Telegram руководству — компактное HTML-сообщение
 *      с кнопкой «Открыть дашборд».
 *
 * Это zero-cost retention-фича: менеджер не заходит в админку, видит
 * сводку прямо в Telegram, кликает только если что-то красное.
 */

const DAYS_IN_DIGEST = 7;

function utcDayStart(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
}

async function buildDigestForOrg(
  organizationId: string,
  weekStart: Date,
  weekEnd: Date
) {
  const [templates, org] = await Promise.all([
    db.journalTemplate.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { name: true, disabledJournalCodes: true },
    }),
  ]);
  if (!org) return null;

  const disabledCodes = parseDisabledCodes(org.disabledJournalCodes);
  const visibleTemplates = templates.filter((t) => !disabledCodes.has(t.code));

  // Compliance per day (UTC midnight × 7).
  const dailyResults: Array<{ day: Date; filledIds: Set<string> }> = [];
  for (let i = 0; i < DAYS_IN_DIGEST; i++) {
    const day = new Date(weekStart);
    day.setUTCDate(day.getUTCDate() + i);
    if (day >= weekEnd) break;
    const filled = await getTemplatesFilledToday(
      organizationId,
      day,
      visibleTemplates.map((t) => ({ id: t.id, code: t.code })),
      disabledCodes,
      { treatAperiodicAsFilled: false }
    );
    dailyResults.push({ day, filledIds: filled });
  }

  const totalSlots = dailyResults.length * visibleTemplates.length;
  const filledSlots = dailyResults.reduce(
    (sum, r) => sum + r.filledIds.size,
    0
  );
  const compliancePct = totalSlots
    ? Math.round((filledSlots / totalSlots) * 100)
    : 0;

  // Per-template missed-days count → bottom-3.
  const missedByTemplate = new Map<string, number>();
  for (const tpl of visibleTemplates) {
    let missed = 0;
    for (const r of dailyResults) {
      if (!r.filledIds.has(tpl.id)) missed += 1;
    }
    if (missed > 0) missedByTemplate.set(tpl.id, missed);
  }
  const bottomTemplates = [...missedByTemplate.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      name: visibleTemplates.find((t) => t.id === id)?.name ?? "—",
      missed: count,
    }));

  // Top employee: who filled most JournalDocumentEntry rows during the
  // week. Cheap proxy for «who was active».
  const entries = await db.journalDocumentEntry.findMany({
    where: {
      document: { organizationId },
      date: { gte: weekStart, lt: weekEnd },
    },
    select: { employeeId: true },
    take: 5000,
  });
  const byEmployee = new Map<string, number>();
  for (const e of entries) {
    byEmployee.set(e.employeeId, (byEmployee.get(e.employeeId) ?? 0) + 1);
  }
  const topPair = [...byEmployee.entries()].sort((a, b) => b[1] - a[1])[0];
  let topEmployeeName: string | null = null;
  let topEmployeeCount = 0;
  if (topPair) {
    const [empId, count] = topPair;
    const emp = await db.user.findUnique({
      where: { id: empId },
      select: { name: true },
    });
    topEmployeeName = emp?.name ?? null;
    topEmployeeCount = count;
  }

  // TasksFlow: completed vs still-active за неделю (по completedAt).
  const tfLinks = await db.tasksFlowTaskLink.findMany({
    where: {
      integration: { organizationId, enabled: true },
      OR: [
        { completedAt: { gte: weekStart, lt: weekEnd } },
        { remoteStatus: "active" },
      ],
    },
    select: { remoteStatus: true, completedAt: true },
  });
  const tfDone = tfLinks.filter(
    (l) =>
      l.remoteStatus === "completed" &&
      l.completedAt &&
      l.completedAt >= weekStart &&
      l.completedAt < weekEnd
  ).length;
  const tfStuck = tfLinks.filter((l) => l.remoteStatus === "active").length;

  return {
    orgName: org.name,
    compliancePct,
    filledSlots,
    totalSlots,
    bottomTemplates,
    topEmployeeName,
    topEmployeeCount,
    tfDone,
    tfStuck,
  };
}

function buildDigestMessage(d: {
  orgName: string;
  compliancePct: number;
  filledSlots: number;
  totalSlots: number;
  bottomTemplates: Array<{ name: string; missed: number }>;
  topEmployeeName: string | null;
  topEmployeeCount: number;
  tfDone: number;
  tfStuck: number;
}): string {
  const emoji =
    d.compliancePct >= 90 ? "🟢" : d.compliancePct >= 60 ? "🟡" : "🔴";
  const lines: string[] = [];
  lines.push(`<b>📊 Сводка за неделю · ${esc(d.orgName)}</b>`);
  lines.push("");
  lines.push(
    `${emoji} Compliance: <b>${d.compliancePct}%</b> (${d.filledSlots} из ${d.totalSlots} ячеек заполнено)`
  );
  if (d.tfDone > 0 || d.tfStuck > 0) {
    lines.push(
      `🛠 TasksFlow: ✅ ${d.tfDone} выполнено · ⏳ ${d.tfStuck} активных`
    );
  }
  if (d.topEmployeeName) {
    lines.push(
      `🏆 Топ исполнитель: <b>${esc(d.topEmployeeName)}</b> (${d.topEmployeeCount} записей)`
    );
  }
  if (d.bottomTemplates.length > 0) {
    lines.push("");
    lines.push("⚠️ <b>Чаще всего пропускают:</b>");
    for (const t of d.bottomTemplates) {
      lines.push(`  • ${esc(t.name)} — ${t.missed} дн.`);
    }
  }
  lines.push("");
  lines.push("<i>Снижается? Откройте дашборд ниже и посмотрите подробности.</i>");
  return lines.join("\n");
}

async function handle(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  {
    const cronAuth = checkCronSecret(request);
    if (cronAuth) return cronAuth;
  }
  const orgIdFilter = searchParams.get("orgId"); // for testing single org

  const now = new Date();
  const todayStart = utcDayStart(now);
  const weekEnd = todayStart;
  const weekStart = new Date(todayStart);
  weekStart.setUTCDate(weekStart.getUTCDate() - DAYS_IN_DIGEST);

  const orgs = await db.organization.findMany({
    where: orgIdFilter ? { id: orgIdFilter } : {},
    select: { id: true },
  });

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const org of orgs) {
    try {
      const data = await buildDigestForOrg(org.id, weekStart, weekEnd);
      if (!data) {
        skipped += 1;
        continue;
      }
      // Skip orgs with no journals at all (just registered, nothing to
      // show — would create noise).
      if (data.totalSlots === 0) {
        skipped += 1;
        continue;
      }
      const message = buildDigestMessage(data);
      const baseUrl = process.env.NEXTAUTH_URL || "https://wesetup.ru";
      // Используем тип "compliance" — weekly digest семантически про
       // compliance, не нужно расширять enum в telegram.ts ради одной
       // фичи. Юзер всё равно может отписать через notification prefs.
      await notifyOrganization(org.id, message, ["owner", "manager"], "compliance", {
        label: "📊 Открыть дашборд",
        miniAppUrl: `${baseUrl}/dashboard`,
      });
      sent += 1;
    } catch (err) {
      errors += 1;
      console.error("[weekly-digest] org error", org.id, err);
    }
  }

  return NextResponse.json({
    ok: true,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    sent,
    skipped,
    errors,
    total: orgs.length,
  });
}

export const GET = handle;
export const POST = handle;
