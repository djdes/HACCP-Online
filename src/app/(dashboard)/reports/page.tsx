import { requireRole, getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ReportForm } from "@/components/reports/report-form";
import { ComplianceBundleCard } from "@/components/reports/compliance-bundle-card";
import { AiPeriodReportCard } from "@/components/reports/ai-period-report";
import { ComplianceHeatmap } from "@/components/reports/compliance-heatmap";
import { WeekdayHeatmap } from "@/components/reports/weekday-heatmap";
import {
  getComplianceHeatmap,
  getWeekdayHeatmap,
} from "@/lib/compliance-heatmap";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  // Принимаем и новые (manager / head_chef), и легаси (owner /
  // technologist) роли — и то, и то пишет отчёты.
  const session = await requireRole([
    "manager",
    "head_chef",
    "owner",
    "technologist",
  ]);

  const orgId = getActiveOrgId(session);
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    templates,
    areas,
    heatmap,
    weekdayHeatmap,
    entries30Count,
    entriesWithAttachment30Count,
  ] = await Promise.all([
    db.journalTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, name: true },
    }),
    db.area.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getComplianceHeatmap(orgId, 30),
    getWeekdayHeatmap(orgId, 8),
    db.journalEntry.count({
      where: { organizationId: orgId, createdAt: { gte: since30 } },
    }),
    db.journalEntry.count({
      where: {
        organizationId: orgId,
        createdAt: { gte: since30 },
        attachments: { some: {} },
      },
    }),
  ]);
  const photoEvidencePct =
    entries30Count === 0
      ? null
      : Math.round((entriesWithAttachment30Count / entries30Count) * 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Отчёты
        </h1>
        <p className="mt-1.5 text-[14px] text-[#6f7282]">
          Выгрузки журналов за период — PDF и Excel для проверок
        </p>
      </div>
      <AiPeriodReportCard />

      {photoEvidencePct !== null ? (
        <section className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
          <div className="flex items-baseline gap-3">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              Записей с фото
            </h2>
            <span
              className="text-[24px] font-semibold tabular-nums"
              style={{
                color:
                  photoEvidencePct >= 60
                    ? "#116b2a"
                    : photoEvidencePct >= 30
                      ? "#7a4a00"
                      : "#a13a32",
              }}
            >
              {photoEvidencePct}%
            </span>
            <span className="text-[13px] text-[#6f7282]">
              ({entriesWithAttachment30Count} из {entries30Count} за 30 дней)
            </span>
          </div>
          <p className="mt-2 text-[13px] text-[#6f7282]">
            Инспектор больше доверяет журналам с фото-доказательствами.
            Норма «хорошая» — 60% и выше.
          </p>
        </section>
      ) : null}

      <ComplianceHeatmap rows={heatmap.rows} days={heatmap.days} />
      <WeekdayHeatmap
        rows={weekdayHeatmap.rows}
        weekdayLabels={weekdayHeatmap.weekdayLabels}
      />
      <ComplianceBundleCard />

      <div className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7">
        <ReportForm templates={templates} areas={areas} />
      </div>
    </div>
  );
}
