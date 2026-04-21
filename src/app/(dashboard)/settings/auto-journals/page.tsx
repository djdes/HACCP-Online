import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { AutoJournalsClient } from "./auto-journals-client";

export const dynamic = "force-dynamic";

export default async function AutoJournalsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/settings");
  }
  const organizationId = getActiveOrgId(session);

  const [templates, org, activeDocs] = await Promise.all([
    db.journalTemplate.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isMandatorySanpin: true,
        isMandatoryHaccp: true,
      },
    }),
    db.organization.findUnique({
      where: { id: organizationId },
      select: { autoJournalCodes: true, disabledJournalCodes: true },
    }),
    db.journalDocument.findMany({
      where: {
        organizationId,
        status: "active",
        dateFrom: { lte: new Date() },
        dateTo: { gte: new Date() },
      },
      select: { templateId: true },
      distinct: ["templateId"],
    }),
  ]);

  const enabledCodes = Array.isArray(org?.autoJournalCodes)
    ? (org.autoJournalCodes as unknown[]).filter(
        (c): c is string => typeof c === "string"
      )
    : [];
  const disabledSet = new Set<string>(
    Array.isArray(org?.disabledJournalCodes)
      ? (org.disabledJournalCodes as unknown[]).filter(
          (c): c is string => typeof c === "string"
        )
      : []
  );
  const activeTemplateIds = new Set(activeDocs.map((d) => d.templateId));

  const items = templates
    .filter((t) => !disabledSet.has(t.code))
    .map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description ?? null,
      isMandatory: t.isMandatorySanpin || t.isMandatoryHaccp,
      enabled: enabledCodes.includes(t.code),
      hasActiveDocumentToday: activeTemplateIds.has(t.id),
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
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Sparkles className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Автосоздание журналов
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Отметьте журналы, для которых WeSetup должен сам заводить
              новый документ на текущий месяц. Дальше — система делает
              это сама: каждый день утром проверяет, есть ли активный
              документ, и если нет — создаёт на весь текущий месяц.
              Вам остаётся только следить за заполнением.
            </p>
          </div>
        </div>
      </div>

      <AutoJournalsClient items={items} />
    </div>
  );
}
