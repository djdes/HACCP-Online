import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ListChecks } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { ChecklistEditor } from "./checklist-editor";

export const dynamic = "force-dynamic";

/**
 * /settings/journal-checklists/[code] — редактор плоского чек-листа
 * для конкретного журнала. Per-organization. Каждый пункт: label,
 * required, hint, sortOrder.
 *
 * Сотрудник видит чек-лист в TaskFill (загружается через
 * /api/task-fill/[taskId]/checklist) и отмечает галочки. Required
 * блокирует submit. Каждая отметка → AuditLog (видно ROOT'у).
 */
export default async function JournalChecklistEditorPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) {
    redirect("/settings");
  }
  const organizationId = getActiveOrgId(session);

  const meta = ACTIVE_JOURNAL_CATALOG.find((j) => j.code === code);
  if (!meta) notFound();

  const items = await db.journalChecklistItem.findMany({
    where: { organizationId, journalCode: code, archivedAt: null },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings/journal-responsibles"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К ответственным
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
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/70">
                Чек-лист сотрудника
              </div>
              <h1 className="mt-1 text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                {meta.name}
              </h1>
              <p className="mt-2 max-w-[640px] text-[14px] text-white/70">
                Список действий, которые сотрудник должен выполнить перед
                сохранением записи журнала. Каждый пункт можно сделать
                обязательным — тогда форма не отправится пока не
                отмечены все галочки. Все отметки сохраняются в
                audit-log.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ChecklistEditor
        journalCode={code}
        initial={items.map((i) => ({
          id: i.id,
          label: i.label,
          required: i.required,
          hint: i.hint,
          sortOrder: i.sortOrder,
        }))}
      />
    </div>
  );
}
