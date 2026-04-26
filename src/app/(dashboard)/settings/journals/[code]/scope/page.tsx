import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, ListChecks } from "lucide-react";
import { requireAuth } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { JournalScopeClient } from "./journal-scope-client";

export const dynamic = "force-dynamic";

export default async function JournalScopePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/settings/journals");
  }

  const { code } = await params;
  const template = await db.journalTemplate.findFirst({
    where: { code },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      taskScope: true,
      allowNoEvents: true,
      noEventsReasons: true,
      allowFreeTextReason: true,
    },
  });
  if (!template) notFound();

  const reasons = Array.isArray(template.noEventsReasons)
    ? (template.noEventsReasons as unknown[]).filter(
        (r): r is string => typeof r === "string"
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings/journals"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К списку журналов
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <ListChecks className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              {template.name}
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Настройте поведение задач в TasksFlow для этого журнала: тип
              задачи (личная или общая), кнопку «Не требуется сегодня» и
              список доступных причин.
            </p>
          </div>
        </div>
      </div>

      <JournalScopeClient
        code={template.code}
        initial={{
          taskScope: template.taskScope as "personal" | "shared",
          allowNoEvents: template.allowNoEvents,
          noEventsReasons: reasons,
          allowFreeTextReason: template.allowFreeTextReason,
        }}
      />
    </div>
  );
}
