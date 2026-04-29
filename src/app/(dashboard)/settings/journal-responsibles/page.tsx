import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Network } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { JournalResponsiblesClient } from "@/components/settings/journal-responsibles-client";

export const dynamic = "force-dynamic";

export default async function JournalResponsiblesPage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");
  const organizationId = getActiveOrgId(session);

  const [positions, templates, accessRows] = await Promise.all([
    db.jobPosition.findMany({
      where: { organizationId },
      orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        categoryKey: true,
        _count: {
          select: { users: { where: { isActive: true, archivedAt: null } } },
        },
      },
    }),
    db.journalTemplate.findMany({
      where: { code: { in: ACTIVE_JOURNAL_CATALOG.map((j) => j.code) } },
      select: { id: true, code: true, name: true, description: true },
    }),
    db.jobPositionJournalAccess.findMany({
      where: { organizationId },
      select: { jobPositionId: true, templateId: true },
    }),
  ]);

  const templateIdToCode = new Map(templates.map((t) => [t.id, t.code]));
  const positionsByJournal = new Map<string, string[]>();
  for (const row of accessRows) {
    const code = templateIdToCode.get(row.templateId);
    if (!code) continue;
    const list = positionsByJournal.get(code) ?? [];
    list.push(row.jobPositionId);
    positionsByJournal.set(code, list);
  }

  const journals = ACTIVE_JOURNAL_CATALOG.map((j) => {
    const tpl = templates.find((t) => t.code === j.code);
    return {
      code: j.code,
      name: j.name,
      description: tpl?.description ?? null,
      initialPositionIds: positionsByJournal.get(j.code) ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К настройкам
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Network className="size-6" />
            </span>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                Ответственные за журналы
              </h1>
              <p className="mt-2 max-w-[680px] text-[14px] text-white/70">
                Кто из должностей заполняет каждый журнал. Применяется
                при «Отправить всем в TasksFlow» и при автосоздании
                задач. Жми «Умные пресеты» — система разложит уборку
                на уборщиков, температуру на поваров и так далее.
              </p>
            </div>
          </div>
        </div>
      </section>

      <JournalResponsiblesClient
        positions={positions.map((p) => ({
          id: p.id,
          name: p.name,
          categoryKey: p.categoryKey,
          activeUsers: p._count.users,
        }))}
        journals={journals}
      />
    </div>
  );
}
