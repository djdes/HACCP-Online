import { redirect } from "next/navigation";
import { Printer } from "lucide-react";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { isAgentOnline } from "@/lib/print-agent-auth";
import { PageHeader } from "@/components/ui/page-header";
import { PrintAgentSettingsClient } from "./print-agent-settings-client";

export const dynamic = "force-dynamic";

/**
 * Подключение программы «Онлайн принтер».
 *
 * Токен здесь НЕ выдаётся и не показывается: программа получает его сама,
 * когда человек вводит в ней свой обычный логин и пароль от Wesetup. Одна
 * копипаста секрета — одна возможность его потерять, поэтому её тут нет.
 * Страница нужна для другого: скачать программу, увидеть подключённые
 * машины и отключить лишнюю.
 */
export default async function PrintAgentSettingsPage() {
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) redirect("/settings");

  const agents = await db.printAgent.findMany({
    where: { organizationId: getActiveOrgId(session), revokedAt: null },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      name: true,
      printerName: true,
      agentVersion: true,
      lastSeenAt: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Печать"
        title="Онлайн принтер"
        description="Программа на компьютере с принтером — чтобы отправлять журнал на печать с телефона."
      />

      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Printer className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              Как это работает
            </h2>
            <ol className="mt-3 space-y-2 text-[14px] leading-[1.55] text-[#3c4053]">
              <li>
                <b>1.</b> Поставьте программу на тот компьютер, к которому
                подключён принтер.
              </li>
              <li>
                <b>2.</b> Войдите в ней своей почтой и паролем от Wesetup и
                выберите принтер. Пароль на компьютере не сохраняется —
                программа получает ключ доступа и дальше работает по нему.
              </li>
              <li>
                <b>3.</b> Программа сама поднимается после перезагрузки. Дальше
                любой журнал уходит на печать кнопкой «На принтер заведения» —
                с телефона, из любого раздела.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <PrintAgentSettingsClient
        agents={agents.map((a) => ({
          id: a.id,
          name: a.name,
          printerName: a.printerName,
          agentVersion: a.agentVersion,
          lastSeenAt: a.lastSeenAt?.toISOString() ?? null,
          online: isAgentOnline(a.lastSeenAt),
        }))}
      />
    </div>
  );
}
