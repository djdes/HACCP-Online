import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CloudUpload } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { YandexBackupClient } from "./yandex-backup-client";

export const dynamic = "force-dynamic";

export default async function BackupSettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/settings");
  }
  const orgId = getActiveOrgId(session);

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: {
      yandexDiskFolder: true,
      yandexDiskLastBackupAt: true,
      yandexDiskToken: true,
    },
  });

  const recentLogs = await db.auditLog.findMany({
    where: {
      organizationId: orgId,
      entity: "yandex_backup",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      details: true,
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
            <CloudUpload className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Авто-бэкап на Я.Диск
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Раз в неделю мы выгружаем JSON-дамп ваших журналов
              (записи, документы, CAPA, потери) в вашу папку на
              Yandex.Disk. Если WeSetup исчезнет — у вас остаётся
              читаемый файл со всеми данными.
            </p>
          </div>
        </div>
      </div>

      <YandexBackupClient
        initialState={{
          connected: Boolean(org?.yandexDiskToken),
          folder: org?.yandexDiskFolder ?? "/WeSetup",
          lastBackupAt: org?.yandexDiskLastBackupAt
            ? org.yandexDiskLastBackupAt.toISOString()
            : null,
        }}
        recentLogs={recentLogs.map((l) => ({
          id: l.id,
          action: l.action,
          details: (l.details as Record<string, unknown> | null) ?? null,
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
