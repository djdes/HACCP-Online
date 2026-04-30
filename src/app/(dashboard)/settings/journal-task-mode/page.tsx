import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings2 } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import {
  parseTaskModesJson,
  getDefaultTaskMode,
} from "@/lib/journal-task-modes";
import { JournalTaskModeClient } from "@/components/settings/journal-task-mode-client";

export const dynamic = "force-dynamic";

export default async function JournalTaskModePage() {
  const session = await requireAuth();
  if (
    !hasFullWorkspaceAccess({
      role: session.user.role,
      isRoot: session.user.isRoot,
    })
  ) {
    redirect("/settings");
  }
  const organizationId = getActiveOrgId(session);

  const [org, areaCount] = await Promise.all([
    db.organization.findUnique({
      where: { id: organizationId },
      select: { journalTaskModesJson: true },
    }),
    db.area.count({ where: { organizationId } }),
  ]);

  const overrides = parseTaskModesJson(org?.journalTaskModesJson);

  // Готовим список journal'ов с резолвом effective-режима для UI.
  const journals = ACTIVE_JOURNAL_CATALOG.map((j) => {
    const def = getDefaultTaskMode(j.code);
    const override = overrides[j.code] ?? {};
    return {
      code: j.code,
      name: j.name,
      // Раздельно: дефолт, чтобы UI мог показать «по умолчанию»; и
      // override (что юзер реально настроил для этого journal).
      defaultMode: def,
      override,
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
              <Settings2 className="size-6" />
            </span>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                Режимы раздачи задач
              </h1>
              <p className="mt-2 max-w-[680px] text-[14px] text-white/70">
                Для каждого журнала выберите как именно создаются
                TasksFlow-задачи и как их проверяет ответственный. Уборку
                можно раздать по помещениям, гигиену — по сотрудникам,
                бракераж — по сменам. Один журнал = одна сводная задача
                по умолчанию. Если оставить «Как по умолчанию» — система
                сама подставит разумный режим под этот тип журнала.
              </p>
              {areaCount === 0 ? (
                <p className="mt-2 max-w-[680px] rounded-2xl border border-amber-300/40 bg-amber-100/10 p-3 text-[12px] text-amber-200">
                  ⚠ В организации не настроены помещения. Режим «На каждое
                  помещение» не будет создавать задачи пока не добавите
                  цеха в{" "}
                  <Link href="/settings/areas" className="underline">
                    «Помещения»
                  </Link>
                  .
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <JournalTaskModeClient journals={journals} />
    </div>
  );
}
