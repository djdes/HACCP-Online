import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ListChecks } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";

export const dynamic = "force-dynamic";

/**
 * Hub-страница: список всех журналов с количеством пунктов в чек-листе
 * для каждого. Клик → /settings/journal-checklists/[code] для редактуры.
 *
 * Per-organization: каждое заведение видит только свои чек-листы.
 */
export default async function JournalChecklistsHubPage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");
  const organizationId = getActiveOrgId(session);

  // Считаем пункты per-journal для отображения «N в чек-листе».
  const groups = await db.journalChecklistItem.groupBy({
    by: ["journalCode"],
    where: { organizationId, archivedAt: null },
    _count: { _all: true },
  });
  const countByCode = new Map(groups.map((g) => [g.journalCode, g._count._all]));

  // Disabled-журналы — выводим под отдельной секцией (или скрываем).
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { disabledJournalCodes: true },
  });
  const disabled = new Set<string>(
    Array.isArray(org?.disabledJournalCodes)
      ? (org?.disabledJournalCodes as string[])
      : [],
  );

  const enabled = ACTIVE_JOURNAL_CATALOG.filter((j) => !disabled.has(j.code));
  const disabledList = ACTIVE_JOURNAL_CATALOG.filter((j) =>
    disabled.has(j.code),
  );

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
              <ListChecks className="size-6" />
            </span>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                Чек-листы для журналов
              </h1>
              <p className="mt-2 max-w-[680px] text-[14px] text-white/70">
                Для каждого журнала можно создать список действий
                (например «разобрать оборудование, промыть, собрать»).
                Сотрудник увидит чек-лист в форме заполнения и отметит
                галочки. Обязательные пункты блокируют отправку. Все
                отметки идут в audit-log.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {enabled.map((j) => {
          const count = countByCode.get(j.code) ?? 0;
          return (
            <Link
              key={j.code}
              href={`/settings/journal-checklists/${j.code}`}
              className="group flex items-start gap-3 rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:border-[#5566f6]/30 hover:shadow-[0_8px_24px_-12px_rgba(85,102,246,0.25)]"
            >
              <span
                className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${
                  count > 0
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-[#eef1ff] text-[#5566f6]"
                }`}
              >
                <ListChecks className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold leading-tight text-[#0b1024] sm:text-[15px]">
                  {j.name}
                </div>
                <div className="mt-1 text-[12.5px] text-[#6f7282]">
                  {count > 0
                    ? `${count} ${count === 1 ? "пункт" : count < 5 ? "пункта" : "пунктов"}`
                    : "Нет чек-листа"}
                </div>
              </div>
              <ArrowRight className="mt-2 size-4 text-[#9b9fb3] transition-transform group-hover:translate-x-0.5 group-hover:text-[#5566f6]" />
            </Link>
          );
        })}
      </div>

      {disabledList.length > 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] p-5">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            Отключённые журналы
          </div>
          <p className="mt-1 text-[12.5px] text-[#9b9fb3]">
            {disabledList.length} журнал
            {disabledList.length === 1 ? "" : disabledList.length < 5 ? "а" : "ов"}{" "}
            отключены в этой организации. Чек-листы для них можно
            настроить, но они не будут показаны сотрудникам.
          </p>
        </div>
      ) : null}
    </div>
  );
}
