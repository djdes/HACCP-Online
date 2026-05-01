import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Gauge, Scale } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { JournalDifficultyClient } from "@/components/settings/journal-difficulty-client";
import { PageGuide } from "@/components/ui/page-guide";

export const dynamic = "force-dynamic";

export default async function JournalDifficultyPage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");
  const organizationId = getActiveOrgId(session);

  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { journalDifficultyJson: true },
  });
  const stored = (org?.journalDifficultyJson ?? {}) as Record<string, unknown>;
  const initial: Record<string, number> = {};
  for (const [code, v] of Object.entries(stored)) {
    if (typeof v === "number" && v >= 1 && v <= 5) {
      initial[code] = Math.round(v);
    }
  }

  const journals = ACTIVE_JOURNAL_CATALOG.map((j) => ({
    code: j.code,
    name: j.name,
  }));

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
              <Gauge className="size-6" />
            </span>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                Сложность журналов
              </h1>
              <p className="mt-2 max-w-[680px] text-[14px] text-white/70">
                Нужно только если в команде <strong>нет шеф-повара</strong>{" "}
                и журналы распределяются между поварами с одинаковой
                зарплатой. Сложность × частота × строк/запись = вес,
                по которому страница{" "}
                <Link
                  href="/settings/workload-balance"
                  className="underline decoration-white/40 underline-offset-2 hover:decoration-white"
                >
                  Распределение задач
                </Link>{" "}
                покажет перекос между сотрудниками. Если шеф-повар
                есть — этим блоком можно не пользоваться.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-1.5 text-[12px] text-white/80">
                <Scale className="size-4" />
                Дефолты подставлены из практики общепита (1 — отметка,
                5 — аналитический документ).
              </div>
            </div>
          </div>
        </div>
      </section>

      <PageGuide
        storageKey="journal-difficulty"
        title="Как пользоваться сложностью"
        bullets={[
          {
            title: "1 — Очень просто",
            body: "галочка-отметка, ~10 секунд (хороший пример: гигиенический журнал, климат).",
          },
          {
            title: "2-3 — Стандартно",
            body: "одно-два поля + цифра, до 1 минуты (температура холодильника, бракераж).",
          },
          {
            title: "4 — Сложно",
            body: "обоснование, комиссия, акт (списание продукции, ЧП, генеральная уборка).",
          },
          {
            title: "5 — Очень сложно",
            body: "аналитический документ или план — занимает 15+ минут (аудиты, обучение, поверка).",
          },
        ]}
        qa={[
          {
            q: "Зачем сложность если есть частота",
            a: "Частота показывает «сколько раз», сложность — «сколько усилий за раз». Ежедневный журнал на отметку (вес 30) сильно легче ежемесячного с обоснованием (вес 4-5×4=16-20). Без сложности невозможно сравнить.",
          },
          {
            q: "А если у нас все журналы одинаково простые",
            a: "Поставьте всем 1 — частота останется единственным фактором, и нагрузка сравняется в зависимости только от количества заполнений. Это и есть «равномерное» распределение по умолчанию.",
          },
        ]}
      />

      <JournalDifficultyClient
        journals={journals}
        initialDifficulty={initial}
      />
    </div>
  );
}
