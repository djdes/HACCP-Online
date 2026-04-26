import Link from "next/link";
import { ArrowLeft, ShieldCheck, Building2 } from "lucide-react";
import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ROOT-only страница с историей impersonations. Показывает кто из
 * платформы и когда заходил под organization (impersonate.start /
 * impersonate.stop), с IP. Compliance-vendor'a перед клиентом —
 * клиент может попросить выгрузку «когда WeSetup-команда заходила в
 * мой аккаунт» и мы её даём.
 */
export default async function AuditImpersonationsPage() {
  await requireRoot();

  const events = await db.auditLog.findMany({
    where: {
      action: { in: ["impersonate.start", "impersonate.stop"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      organizationId: true,
      userId: true,
      userName: true,
      entityId: true,
      details: true,
      ipAddress: true,
      createdAt: true,
    },
  });

  // Hydrate org names
  const orgIds = Array.from(
    new Set(events.map((e) => e.organizationId).filter((id): id is string => Boolean(id)))
  );
  const orgs = await db.organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true },
  });
  const orgById = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/root"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К списку организаций
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Audit log: impersonations
            </h1>
            <p className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[#6f7282]">
              Все случаи когда ROOT-пользователь WeSetup заходил под
              чью-то организацию. По запросу клиента можем выгрузить
              соответствующие строки. Последние 200 событий.
            </p>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#dcdfed] bg-[#fafbff] px-6 py-14 text-center">
          <div className="text-[15px] font-medium text-[#0b1024]">
            Пока нет impersonation-событий
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#ececf4] bg-white">
          <table className="w-full min-w-[820px] text-[13px]">
            <thead className="bg-[#fafbff] text-[12px] uppercase tracking-[0.06em] text-[#6f7282]">
              <tr>
                <th className="px-4 py-3 text-left">Время</th>
                <th className="px-4 py-3 text-left">Действие</th>
                <th className="px-4 py-3 text-left">Организация</th>
                <th className="px-4 py-3 text-left">Кто</th>
                <th className="px-4 py-3 text-left">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ececf4]">
              {events.map((e) => {
                const isStart = e.action === "impersonate.start";
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3 tabular-nums text-[#3c4053]">
                      {e.createdAt.toLocaleString("ru-RU", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                        style={{
                          backgroundColor: isStart ? "#fff8eb" : "#ecfdf5",
                          color: isStart ? "#7a4a00" : "#116b2a",
                        }}
                      >
                        {isStart ? "вход" : "выход"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#0b1024]">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-[#9b9fb3]" />
                        {orgById.get(e.organizationId ?? "") ??
                          (e.organizationId ?? "?")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#3c4053]">
                      {e.userName ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#6f7282]">
                      {e.ipAddress ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
