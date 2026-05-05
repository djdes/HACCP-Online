import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, NotebookPen } from "lucide-react";
import { db } from "@/lib/db";
import { JournalGuide } from "@/components/journals/journal-guide";
import { resolveJournalCodeAlias } from "@/lib/source-journal-map";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { loadGuideNodesForUI } from "@/lib/journal-guide-tree";

export const dynamic = "force-dynamic";

export default async function JournalGuidePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const resolvedCode = resolveJournalCodeAlias(code);

  const template = await db.journalTemplate.findUnique({
    where: { code: resolvedCode },
    select: { name: true, description: true },
  });
  if (!template) notFound();

  // P1.5 wave-c — загружаем кастомный гайд организации (если есть).
  // Если orga настроила в /settings/journal-guides-tree — он
  // переопределяет hardcoded `journal-filling-guides.steps[]`.
  const session = await getServerSession(authOptions);
  const customNodes = session
    ? (await loadGuideNodesForUI(getActiveOrgId(session), resolvedCode)) ??
      undefined
    : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-1 sm:space-y-6">
      <Link
        href={`/journals/${resolvedCode}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6f7282] transition-colors hover:text-[#0b1024]"
      >
        <ArrowLeft className="size-4" />
        К журналу
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[340px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-28 -right-28 size-[380px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 flex items-start gap-3 p-5 sm:gap-4 sm:p-8 md:p-10">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <NotebookPen className="size-6" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/80 backdrop-blur">
              Инструкция для нового сотрудника
            </div>
            <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[26px]">
              {template.name}
            </h1>
            <p className="mt-2 max-w-[560px] text-[13px] leading-[1.5] text-white/70 sm:text-[14px]">
              Прочитай эту страницу до того как начнёшь заполнять журнал.
              Она объясняет шаги, что взять с собой, типичные ошибки и
              требования СанПиН.
            </p>
            <Link
              href={`/journals/${resolvedCode}/new`}
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-4 text-[14px] font-semibold text-[#0b1024] hover:bg-white/90"
            >
              К заполнению →
            </Link>
          </div>
        </div>
      </section>

      <JournalGuide
        journalCode={resolvedCode}
        expanded={true}
        customNodes={customNodes}
      />
    </div>
  );
}
