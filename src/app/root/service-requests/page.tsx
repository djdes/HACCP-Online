import { requireRoot } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ServiceRequestsClient } from "./service-requests-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Заявки на услуги",
};

/**
 * Заявки на платные услуги — из кабинета и с публичной страницы.
 *
 * Показываем и отметки о доставке уведомлений: если Telegram промолчал,
 * это должно быть видно здесь, а не только в логах сервера, иначе
 * заявка тихо пролежит непрочитанной.
 */
export default async function RootServiceRequestsPage() {
  await requireRoot();

  const requests = await db.serviceRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-[1000px]">
      <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">
        Заявки на услуги
      </h1>
      <p className="mt-2 text-[14px] leading-[1.6] text-[#6f7282]">
        Последние 200 заявок. «Оплачено» означает, что клиент закрыл
        фиксированную цену баллами при оформлении — деньги уже списаны с его
        баланса.
      </p>
      <div className="mt-6">
        <ServiceRequestsClient
          initial={requests.map((request) => ({
            id: request.id,
            serviceTitle: request.serviceTitle,
            organizationName: request.organizationName,
            contactName: request.contactName,
            contactPhone: request.contactPhone,
            contactEmail: request.contactEmail,
            comment: request.comment,
            status: request.status,
            paidRub: request.paidRub,
            source: request.source,
            notifiedTg: request.adminTgNotifiedAt !== null,
            notifiedEmail: request.adminEmailedAt !== null,
            createdAt: request.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
