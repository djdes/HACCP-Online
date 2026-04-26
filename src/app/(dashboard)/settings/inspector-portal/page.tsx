import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { InspectorPortalClient } from "./inspector-portal-client";

export const dynamic = "force-dynamic";

export default async function InspectorPortalPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/settings");
  }
  const orgId = getActiveOrgId(session);

  const tokens = await db.inspectorToken.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      periodFrom: true,
      periodTo: true,
      expiresAt: true,
      lastAccessedAt: true,
      accessCount: true,
      revokedAt: true,
      createdAt: true,
    },
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
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Портал инспектора
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Создайте read-only ссылку с ограниченным сроком действия для
              инспектора СЭС / Роспотребнадзора. Инспектор откроет URL, увидит
              ваши журналы за выбранный период и сможет скачать PDF —
              изменить ничего не сможет. Каждый доступ фиксируется.
            </p>
          </div>
        </div>
      </div>

      <InspectorPortalClient
        initialTokens={tokens.map((t) => ({
          id: t.id,
          label: t.label,
          periodFrom: t.periodFrom.toISOString(),
          periodTo: t.periodTo.toISOString(),
          expiresAt: t.expiresAt.toISOString(),
          lastAccessedAt: t.lastAccessedAt?.toISOString() ?? null,
          accessCount: t.accessCount,
          revokedAt: t.revokedAt?.toISOString() ?? null,
          createdAt: t.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
