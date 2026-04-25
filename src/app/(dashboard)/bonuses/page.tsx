import { redirect } from "next/navigation";
import { Coins } from "lucide-react";
import { db } from "@/lib/db";
import { getActiveOrgId, requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { BonusFeedTable } from "@/components/bonuses/bonus-feed-table";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Manager-feed премий (Phase 3, шаг 3.5).
 *
 * Видно только management-роли (через `hasFullWorkspaceAccess`).
 * Сотрудники без management-прав сюда не попадают — middleware пускает,
 * но мы дополнительно редиректим в `/dashboard`, чтобы не показывать
 * чужие премии. CSV-экспорт за период доедет в шаге 3.6.
 */
export default async function BonusesPage() {
  const session = await requireAuth();
  const fullAccess = hasFullWorkspaceAccess({
    role: session.user.role,
    isRoot: session.user.isRoot === true,
  });
  if (!fullAccess) {
    redirect("/dashboard");
  }

  const orgId = getActiveOrgId(session);

  const bonuses = await db.bonusEntry.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      amountKopecks: true,
      photoUrl: true,
      photoTakenAt: true,
      createdAt: true,
      rejectedAt: true,
      rejectedReason: true,
      user: { select: { id: true, name: true } },
      template: { select: { id: true, code: true, name: true } },
      obligation: {
        select: {
          id: true,
          claimedAt: true,
          status: true,
        },
      },
    },
  });

  const summary = bonuses.reduce(
    (acc, bonus) => {
      acc.total += 1;
      if (bonus.status === "pending") acc.pending += 1;
      if (bonus.status === "approved") acc.approved += 1;
      if (bonus.status === "rejected") acc.rejected += 1;
      if (bonus.status !== "rejected") {
        acc.payableKopecks += bonus.amountKopecks;
      }
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0, payableKopecks: 0 }
  );

  const items = bonuses.map((bonus) => ({
    id: bonus.id,
    status: bonus.status,
    amountKopecks: bonus.amountKopecks,
    photoUrl: bonus.photoUrl,
    photoTakenAt: bonus.photoTakenAt?.toISOString() ?? null,
    claimedAt:
      bonus.obligation?.claimedAt?.toISOString() ??
      bonus.createdAt.toISOString(),
    rejectedAt: bonus.rejectedAt?.toISOString() ?? null,
    rejectedReason: bonus.rejectedReason ?? null,
    user: { id: bonus.user.id, name: bonus.user.name ?? "—" },
    template: {
      code: bonus.template.code,
      name: bonus.template.name,
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Премии за работу
        </h1>
        <p className="mt-1.5 text-[14px] text-[#6f7282]">
          Кто что забрал, что подтверждено фото-доказом и что ты отозвал.
          Список из ста последних записей.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Всего премий"
          value={String(summary.total)}
          tone="indigo"
        />
        <SummaryCard
          label="К оплате"
          value={formatRubles(summary.payableKopecks)}
          tone="lime"
        />
        <SummaryCard
          label="Ждут проверки"
          value={String(summary.pending)}
          tone="amber"
        />
        <SummaryCard
          label="Отозвано"
          value={String(summary.rejected)}
          tone="rose"
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <Coins className="mx-auto size-7 text-[#9b9fb3]" strokeWidth={1.6} />
          <div className="mt-3 text-[15px] font-medium text-[#0b1024]">
            Премий пока нет
          </div>
          <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] text-[#6f7282]">
            Когда менеджер выставит сумму &gt; 0 в{" "}
            <code className="rounded bg-[#f5f6ff] px-1.5 py-0.5 text-[12px] text-[#3848c7]">
              /settings/journals
            </code>
            , сотрудник сможет «забрать» журнал с бонусом, и запись
            появится здесь.
          </p>
        </div>
      ) : (
        <BonusFeedTable items={items} />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "indigo" | "lime" | "amber" | "rose";
}) {
  const palette = {
    indigo: { bg: "#f5f6ff", fg: "#3848c7" },
    lime: { bg: "#ecfdf5", fg: "#116b2a" },
    amber: { bg: "#fff7ed", fg: "#9a3412" },
    rose: { bg: "#fff4f2", fg: "#a13a32" },
  }[tone];

  return (
    <div className="rounded-2xl border border-[#ececf4] bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
      <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-[#6f7282]">
        {label}
      </div>
      <div
        className="mt-1.5 inline-flex rounded-xl px-2.5 py-0.5 text-[20px] font-semibold tabular-nums"
        style={{ background: palette.bg, color: palette.fg }}
      >
        {value}
      </div>
    </div>
  );
}

function formatRubles(kopecks: number): string {
  if (!Number.isFinite(kopecks) || kopecks <= 0) return "0 ₽";
  const rubles = kopecks / 100;
  return `${rubles.toLocaleString("ru-RU", {
    minimumFractionDigits: rubles % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} ₽`;
}
