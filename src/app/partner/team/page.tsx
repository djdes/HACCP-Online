import { TeamManager } from "@/components/partner/team-manager";
import { Card } from "@/components/partner/ui";
import { PageGuide } from "@/components/ui/page-guide";
import { requirePartnerPage } from "@/lib/partners/page-context";
import { listTeam } from "@/lib/partners/service";

export const dynamic = "force-dynamic";

export default async function PartnerTeamPage() {
  const { session, membership } = await requirePartnerPage();
  const team = await listTeam(membership.partnerId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">Команда</h1>
        <p className="mt-1 text-[14px] text-[#6f7282]">
          Кто из {membership.partner.brandName} видит кабинет партнёра и кабинеты клиентов.
        </p>
      </div>

      <PageGuide
        title="Роли в команде"
        storageKey="partner-team"
        bullets={[
          "Владелец — тот, кто подавал заявку. Только он меняет реквизиты для выплат и состав команды.",
          "Сотрудник видит обзор, клиентов, заметки, приглашения, брендинг и начисления; открывает кабинеты клиентов с тем уровнем, который выбрал клиент.",
          "Действия любого участника в кабинете клиента попадают в журнал клиента с пометкой «партнёр: <бренд>, <имя>».",
        ]}
      />

      <Card title={`Участники · ${team.length}`} eyebrow="Доступ к кабинету">
        <TeamManager
          team={team.map((m) => ({
            ...m,
            role: m.role === "owner" ? "owner" : "member",
            lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
            since: m.since.toISOString(),
          }))}
          meUserId={session.user.id}
          canManage={membership.role === "owner"}
        />
      </Card>
    </div>
  );
}
