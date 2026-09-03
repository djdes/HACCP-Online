import { Suspense } from "react";
import { PartnerChats } from "@/components/partner/partner-chats";
import { PageGuide } from "@/components/ui/page-guide";
import { requirePartnerPage } from "@/lib/partners/page-context";

export const dynamic = "force-dynamic";

/**
 * Чаты партнёра: переписки с организациями, которые он сопровождает.
 * Данные тянет клиентский компонент — список живой, обновляется сам.
 */
export default async function PartnerChatsPage() {
  const { membership } = await requirePartnerPage();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">Чаты</h1>
        <p className="mt-1 text-[14px] text-[#6f7282]">
          Клиенты пишут в чат кабинета WeSetup — сообщения приходят сюда, вам в Telegram и на почту.
        </p>
      </div>

      <PageGuide
        storageKey="partner-chats"
        title="Как работают чаты"
        bullets={[
          "Всё, что клиент пишет в онлайн-чат кабинета, попадает сюда, вам в Telegram и на почту. WeSetup в переписку не вмешивается, пока вы отвечаете.",
          "Ответ уходит клиенту в чат кабинета со звуком и всплывающим уведомлением, руководству — в Telegram и в колокольчик.",
          "«Написать» — начать переписку первым: клиент увидит сообщение при следующем заходе в кабинет.",
        ]}
        qa={[
          {
            q: "Кто видит переписку со стороны клиента?",
            a: "Все руководители организации: чат один на организацию, у каждой реплики подпись автора.",
          },
          {
            q: "Что такое «архив»?",
            a: "Старая личная ветка сотрудника до объединения чатов по организациям. Ответ на неё уйдёт в общий чат организации.",
          },
        ]}
      />

      <Suspense fallback={null}>
        <PartnerChats brandName={membership.partner.brandName} />
      </Suspense>
    </div>
  );
}
