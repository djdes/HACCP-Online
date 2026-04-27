import Link from "next/link";
import { Download } from "lucide-react";
import { requireRole } from "@/lib/auth-helpers";
import { AuditLogViewer } from "@/components/settings/audit-log-viewer";

export default async function AuditPage() {
  await requireRole(["owner"]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Журнал действий</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Все действия пользователей в системе
          </p>
        </div>
        <Link
          href="/api/settings/audit/export"
          className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          prefetch={false}
        >
          <Download className="size-4 text-[#5566f6]" />
          Скачать CSV (90 дней)
        </Link>
      </div>
      <AuditLogViewer />
    </div>
  );
}
