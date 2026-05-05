import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, ListChecks } from "lucide-react";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permission-presets";
import { getDefaultPipeline } from "@/lib/journal-pipelines";
import { SeedAllPipelinesButton } from "./seed-all-button";

export const dynamic = "force-dynamic";

// Список журналов подтягивается из БД (db.journalTemplate.findMany).
// Раньше был хардкодным с короткими лейблами вроде «Скоропорт» вместо
// полного «Журнал бракеража скоропортящейся пищевой продукции», и
// при добавлении нового журнала в seed.ts — нужно было ещё и тут
// дописать. Теперь list = source of truth = JournalTemplate (active).

export default async function JournalPipelinesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasCapability(session.user, "admin.full")) redirect("/journals");

  const organizationId = getActiveOrgId(session);

  const [org, allJournals, treeTemplates, guideTemplates] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { journalPipelinesJson: true },
    }),
    db.journalTemplate.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.journalPipelineTemplate.findMany({
      where: { organizationId },
      select: {
        templateCode: true,
        _count: { select: { nodes: true } },
      },
    }),
    db.journalGuideTemplate.findMany({
      where: { organizationId },
      select: {
        templateCode: true,
        _count: { select: { nodes: true } },
      },
    }),
  ]);

  const overrides = (org?.journalPipelinesJson ?? {}) as Record<
    string,
    { steps: { id: string }[] }
  >;

  const treeStatus = new Map<string, number>();
  for (const tpl of treeTemplates) {
    treeStatus.set(tpl.templateCode, tpl._count.nodes);
  }

  const guideStatus = new Map<string, number>();
  for (const tpl of guideTemplates) {
    guideStatus.set(tpl.templateCode, tpl._count.nodes);
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Настройки
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <ListChecks className="size-6" />
            </div>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                Настройки журналов
              </h1>
              <p className="mt-2 max-w-[640px] text-[15px] text-white/70">
                Pipeline-инструкции для сотрудников. Кликни на блок чтобы
                настроить шаги: какие средства взять, куда пойти, что
                проверить. Чем подробнее — тем понятнее новой уборщице
                / повару / продавцу.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 rounded-3xl border border-[#dcdfed] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">
            🚀 Быстрый старт
          </div>
          <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
            Создать pipeline для всех журналов одним кликом
          </h2>
          <p className="mt-1 max-w-[600px] text-[13px] leading-[1.55] text-[#6f7282]">
            Создаёт базовое дерево pinned-узлов на каждый журнал по
            его колонкам. Уже настроенные журналы (
            <strong>{treeTemplates.length}</strong>) не пересоздаются.
            Журналы без описанных колонок придут в уведомления для
            ручной настройки.
          </p>
        </div>
        <SeedAllPipelinesButton
          totalActiveTrees={treeTemplates.length}
          totalJournals={allJournals.length}
        />
      </div>

      <div className="rounded-2xl border border-[#dcdfed] bg-[#fafbff] p-4 text-[13px] text-[#3c4053]">
        💡 Если pipeline не настроен — Mini App покажет default-инструкцию
        (для cleaning / hygiene / cold_equipment / finished_product) или
        обычную форму. Настроенные через эту страницу — переопределяют
        default'ы.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allJournals.map((j) => {
          const hasOverride = Boolean(overrides[j.code]?.steps?.length);
          const hasDefault = Boolean(getDefaultPipeline(j.code));
          const treeNodeCount = treeStatus.get(j.code) ?? 0;
          const guideNodeCount = guideStatus.get(j.code) ?? 0;
          return (
            <div
              key={j.code}
              className="group rounded-2xl border border-[#ececf4] bg-white p-4 transition-colors hover:border-[#5566f6]/40 hover:bg-[#fafbff]"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                    hasOverride
                      ? "bg-[#5566f6] text-white"
                      : hasDefault
                        ? "bg-[#eef1ff] text-[#3848c7]"
                        : "bg-[#fafbff] text-[#9b9fb3]"
                  }`}
                >
                  <BookOpen className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-medium leading-tight text-[#0b1024]">
                    {j.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-[#9b9fb3]">
                    {j.code}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                    {hasOverride ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1ff] px-2 py-0.5 font-medium text-[#3848c7]">
                        ✓ Legacy
                      </span>
                    ) : hasDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fafbff] px-2 py-0.5 text-[#6f7282]">
                        Default
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fafbff] px-2 py-0.5 text-[#9b9fb3]">
                        Без pipeline
                      </span>
                    )}
                    {treeNodeCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#5566f6] px-2 py-0.5 font-medium text-white">
                        🌳 {treeNodeCount} узлов
                      </span>
                    ) : null}
                    {guideNodeCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#7a5cff] px-2 py-0.5 font-medium text-white">
                        📖 {guideNodeCount}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#ececf4] pt-3 text-[12px]">
                <Link
                  href={`/settings/journal-pipelines/${j.code}`}
                  className="rounded-full px-2.5 py-1 text-[#3848c7] hover:bg-[#eef1ff]"
                >
                  Legacy редактор →
                </Link>
                <Link
                  href={`/settings/journal-pipelines-tree/${j.code}`}
                  className="rounded-full px-2.5 py-1 text-[#5566f6] hover:bg-[#f5f6ff]"
                >
                  🌳 Pipeline (beta) →
                </Link>
                <Link
                  href={`/settings/journal-guides-tree/${j.code}`}
                  className="rounded-full px-2.5 py-1 text-[#7a5cff] hover:bg-[#f5f0ff]"
                >
                  📖 Гайд (beta) →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
