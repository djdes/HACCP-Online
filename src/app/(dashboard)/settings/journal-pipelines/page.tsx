import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BookOpen, ListChecks } from "lucide-react";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { hasCapability } from "@/lib/permission-presets";
import { getDefaultPipeline } from "@/lib/journal-pipelines";

export const dynamic = "force-dynamic";

const ALL_JOURNALS = [
  { code: "hygiene", label: "Гигиена" },
  { code: "health_check", label: "Проверка здоровья" },
  { code: "cold_equipment_control", label: "Холодильники" },
  { code: "climate_control", label: "Климат-контроль" },
  { code: "cleaning", label: "Уборка" },
  { code: "incoming_control", label: "Приёмка" },
  { code: "finished_product", label: "Бракераж" },
  { code: "disinfectant_usage", label: "Дезсредства" },
  { code: "fryer_oil", label: "Фритюрный жир" },
  { code: "accident_journal", label: "Аварии" },
  { code: "complaint_register", label: "Жалобы" },
  { code: "breakdown_history", label: "Поломки" },
  { code: "ppe_issuance", label: "СИЗ" },
  { code: "glass_items_list", label: "Стекло — список" },
  { code: "glass_control", label: "Контроль стекла" },
  { code: "metal_impurity", label: "Металлопримеси" },
  { code: "perishable_rejection", label: "Скоропорт" },
  { code: "product_writeoff", label: "Списание" },
  { code: "traceability_test", label: "Прослеживаемость" },
  { code: "general_cleaning", label: "Генуборка" },
  { code: "sanitation_day_control", label: "Сан. день" },
  { code: "sanitary_day_control", label: "Сан. день (alt)" },
  { code: "pest_control", label: "Дератизация" },
  { code: "intensive_cooling", label: "Интенс. охлаждение" },
  { code: "uv_lamp_runtime", label: "УФ-лампа" },
  { code: "equipment_maintenance", label: "Тех. обслуживание" },
  { code: "equipment_calibration", label: "Поверка" },
  { code: "equipment_cleaning", label: "Чистка оборудования" },
  { code: "audit_plan", label: "План аудита" },
  { code: "audit_protocol", label: "Протокол аудита" },
  { code: "audit_report", label: "Отчёт аудита" },
  { code: "training_plan", label: "План обучения" },
  { code: "staff_training", label: "Обучение персонала" },
  { code: "med_books", label: "Медкнижки" },
];

export default async function JournalPipelinesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasCapability(session.user, "admin.full")) redirect("/journals");

  const organizationId = getActiveOrgId(session);
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { journalPipelinesJson: true },
  });
  const overrides = (org?.journalPipelinesJson ?? {}) as Record<
    string,
    { steps: { id: string }[] }
  >;

  const treeTemplates = await db.journalPipelineTemplate.findMany({
    where: { organizationId },
    select: {
      templateCode: true,
      _count: { select: { nodes: true } },
    },
  });
  const treeStatus = new Map<string, number>();
  for (const tpl of treeTemplates) {
    treeStatus.set(tpl.templateCode, tpl._count.nodes);
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

      <div className="rounded-2xl border border-[#dcdfed] bg-[#fafbff] p-4 text-[13px] text-[#3c4053]">
        💡 Если pipeline не настроен — Mini App покажет default-инструкцию
        (для cleaning / hygiene / cold_equipment / finished_product) или
        обычную форму. Настроенные через эту страницу — переопределяют
        default'ы.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_JOURNALS.map((j) => {
          const hasOverride = Boolean(overrides[j.code]?.steps?.length);
          const hasDefault = Boolean(getDefaultPipeline(j.code));
          const treeNodeCount = treeStatus.get(j.code) ?? 0;
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
                    {j.label}
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
                  🌳 Дерево (beta) →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
