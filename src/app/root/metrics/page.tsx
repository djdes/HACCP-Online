import Link from "next/link";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChartLine,
  Coins,
  Minus,
} from "lucide-react";
import { requireRoot } from "@/lib/auth-helpers";
import { getAllOrgMetrics } from "@/lib/org-metrics";

export const dynamic = "force-dynamic";

const PLATFORM_ORG_ID = process.env.PLATFORM_ORG_ID || "platform";

export default async function RootMetricsPage() {
  await requireRoot();

  const metrics = await getAllOrgMetrics(PLATFORM_ORG_ID);

  const sorted = [...metrics].sort((a, b) => b.actualMrrRub - a.actualMrrRub);

  const totalActualMrr = sorted.reduce((s, m) => s + m.actualMrrRub, 0);
  const totalPotentialMrr = sorted.reduce(
    (s, m) => s + m.potentialMrrRub,
    0
  );
  const totalActiveUsers = sorted.reduce((s, m) => s + m.activeUsers, 0);
  const totalEntries7d = sorted.reduce((s, m) => s + m.entries7d, 0);
  const activeOrgs = sorted.filter((m) => m.entries7d > 0).length;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/root"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К списку организаций
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <ChartLine className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Метрики платформы
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Активность, retention и выручка по всем организациям.
              Расчётный MRR — `calculatePerEmployeePrice(activeUsers)`,
              реальный — 0 для trial-org. Trend — % изменения 7-дневной
              активности vs предыдущая неделя.
            </p>
          </div>
        </div>
      </div>

      {/* Aggregate stats */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Организаций" value={sorted.length} />
        <StatCard
          label="Активных за 7 дней"
          value={activeOrgs}
          hint={`из ${sorted.length}`}
        />
        <StatCard label="Сотрудников всего" value={totalActiveUsers} />
        <StatCard label="Записей за 7 дней" value={totalEntries7d} />
        <StatCard
          label="MRR"
          value={`${totalActualMrr.toLocaleString("ru-RU")} ₽`}
          hint={`потенциал: ${totalPotentialMrr.toLocaleString("ru-RU")} ₽`}
          accent
        />
      </div>

      <section className="rounded-3xl border border-[#ececf4] bg-white shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-[14px]">
            <thead className="bg-[#fafbff] text-[12px] uppercase tracking-wider text-[#6f7282]">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Организация</th>
                <th className="px-5 py-3 text-center font-medium">Тариф</th>
                <th className="px-5 py-3 text-right font-medium">
                  Сотрудники
                </th>
                <th className="px-5 py-3 text-right font-medium">
                  Записи 7д
                </th>
                <th className="px-5 py-3 text-right font-medium">Trend</th>
                <th className="px-5 py-3 text-right font-medium">
                  Last activity
                </th>
                <th className="px-5 py-3 text-right font-medium">MRR ₽</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-[#6f7282]"
                  >
                    Пока нет организаций.
                  </td>
                </tr>
              ) : null}
              {sorted.map((m) => {
                const lastActivity = m.lastEntryAt
                  ? formatRelative(new Date(m.lastEntryAt))
                  : "никогда";
                const isStale =
                  !m.lastEntryAt ||
                  Date.now() - new Date(m.lastEntryAt).getTime() >
                    14 * 24 * 60 * 60 * 1000;
                return (
                  <tr
                    key={m.organizationId}
                    className="border-t border-[#eef0f6] transition-colors hover:bg-[#fafbff]"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/root/organizations/${m.organizationId}`}
                        className="text-[#0b1024] hover:text-[#3848c7]"
                      >
                        <div className="font-medium">{m.organizationName}</div>
                        <div className="text-[12px] text-[#9b9fb3]">
                          {m.type} · с{" "}
                          {new Date(m.createdAt).toLocaleDateString("ru-RU")}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <PlanPill plan={m.subscriptionPlan} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {m.activeUsers}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {m.entries7d}
                      <span className="ml-1 text-[12px] text-[#9b9fb3]">
                        / {m.entries30d} за 30
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <TrendBadge value={m.weeklyTrendPct} />
                    </td>
                    <td
                      className={`px-5 py-3 text-right text-[13px] ${
                        isStale ? "text-[#a13a32]" : "text-[#3c4053]"
                      }`}
                    >
                      {lastActivity}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {m.actualMrrRub > 0 ? (
                        <span className="font-semibold text-[#0b1024]">
                          {m.actualMrrRub.toLocaleString("ru-RU")}
                        </span>
                      ) : (
                        <span className="text-[#9b9fb3]">
                          {m.potentialMrrRub > 0
                            ? `(${m.potentialMrrRub.toLocaleString("ru-RU")})`
                            : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent
          ? "border-[#5566f6]/30 bg-[#f5f6ff]"
          : "border-[#ececf4] bg-white"
      } shadow-[0_0_0_1px_rgba(240,240,250,0.45)]`}
    >
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-[#6f7282]">
        {accent ? <Coins className="size-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums text-[#0b1024]">
        {value}
      </div>
      {hint ? (
        <div className="text-[12px] text-[#9b9fb3]">{hint}</div>
      ) : null}
    </div>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    trial: { bg: "#fff8eb", fg: "#7a4a00" },
    paid: { bg: "#ecfdf5", fg: "#116b2a" },
    pro: { bg: "#eef1ff", fg: "#3848c7" },
  };
  const s = styles[plan] ?? { bg: "#f5f6ff", fg: "#6f7282" };
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium"
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {plan}
    </span>
  );
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[12px] text-[#9b9fb3]">—</span>;
  }
  const Icon = value > 5 ? ArrowUp : value < -5 ? ArrowDown : Minus;
  const fg = value > 5 ? "#116b2a" : value < -5 ? "#a13a32" : "#6f7282";
  return (
    <span
      className="inline-flex items-center gap-1 text-[13px] font-medium tabular-nums"
      style={{ color: fg }}
    >
      <Icon className="size-3.5" />
      {value > 0 ? "+" : ""}
      {value}%
    </span>
  );
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return "только что";
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} дн назад`;
  const months = Math.floor(days / 30);
  return `${months} мес назад`;
}
