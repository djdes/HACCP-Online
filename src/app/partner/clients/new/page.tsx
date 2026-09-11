import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateClientForm } from "@/components/partner/create-client-form";
import { PageGuide } from "@/components/ui/page-guide";
import {
  countPendingClientOrganizations,
  PARTNER_MAX_PENDING_CLIENT_ORGS,
} from "@/lib/partners/client-organizations";
import { requirePartnerPage } from "@/lib/partners/page-context";

export const dynamic = "force-dynamic";

export default async function NewClientOrganizationPage() {
  const { membership } = await requirePartnerPage();
  const pending = await countPendingClientOrganizations(membership.partnerId);
  const limitReached = pending >= PARTNER_MAX_PENDING_CLIENT_ORGS;

  return (
    <div className="space-y-5">
      <Link
        href="/partner"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6f7282] transition-colors hover:text-[#5566f6]"
      >
        <ArrowLeft className="size-3.5" />
        Все клиенты
      </Link>

      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">Новая организация клиента</h1>
        <p className="mt-1 text-[14px] text-[#6f7282]">
          Заведите заведение и настройте его до того, как клиент впервые войдёт.
        </p>
      </div>

      <PageGuide
        title="Как это работает"
        storageKey="partner-new-client"
        bullets={[
          "Организация принадлежит клиенту: у неё своя подписка и свой счёт. Ваша подписка не задевается.",
          "Сразу после создания нажмите «Открыть кабинет» — там заводятся должности, сотрудники и включаются нужные журналы.",
          "Когда всё готово, отправьте приглашение владельцу с карточки клиента. Он задаст пароль и станет руководителем.",
          "Вознаграждение считается как обычно — с первой оплаты клиента открывается 12-месячное окно.",
        ]}
      />

      {limitReached ? (
        <div className="rounded-2xl border border-[#f0d8d4] bg-[#fff4f2] px-4 py-3 text-[13px] leading-[1.55] text-[#a13a32]">
          У вас уже {pending} организаций, которые созданы, но не переданы клиентам. Передайте хотя бы одну —
          отправьте приглашение владельцу с её карточки, — и создание снова станет доступно. Так мы страхуемся
          от забытых пустых кабинетов.
        </div>
      ) : (
        <CreateClientForm />
      )}
    </div>
  );
}
