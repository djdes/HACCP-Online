import { requireRoot } from "@/lib/auth-helpers";

import { RootIdeasClient } from "./ideas-client";

export const dynamic = "force-dynamic";

/** Идеи клиентов: статус, комментарий — автору уходит уведомление в кабинет. */
export default async function RootIdeasPage() {
  await requireRoot();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">Идеи клиентов</h1>
        <p className="mt-1 max-w-[720px] text-[14px] leading-relaxed text-[#6f7282]">
          Все предложения и голоса. Смена статуса уведомляет автора в кабинете; комментарий видят все клиенты —
          для «Не будем» напишите почему, для «Сделано» — где искать.
        </p>
      </div>
      <RootIdeasClient />
    </div>
  );
}
