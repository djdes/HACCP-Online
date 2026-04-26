import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { AccountingClient } from "./accounting-client";

export const dynamic = "force-dynamic";

export default async function AccountingSettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/settings");
  }
  const orgId = getActiveOrgId(session);

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { accountantEmail: true },
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
            <FileSpreadsheet className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Бухгалтерия
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Раз в неделю отправляем бухгалтеру CSV со списаниями
              (журнал «Потери и брак») за прошедшие 7 дней. Файл в
              UTF-8 BOM с разделителем «;» — открывается в Excel и
              импортируется в 1С через «Загрузка данных из табличного
              документа».
            </p>
          </div>
        </div>
      </div>

      <AccountingClient initialEmail={org?.accountantEmail ?? null} />
    </div>
  );
}
