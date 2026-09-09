import { requireRoot } from "@/lib/auth-helpers";
import { readPlatformRequisites } from "@/lib/closing-documents/requisites";
import { requisitesChecklist } from "@/lib/closing-documents/types";

import { RequisitesClient } from "./requisites-client";

export const dynamic = "force-dynamic";

/**
 * Реквизиты нашей организации и факсимиле — источник для закрывающих
 * документов (УПД). Данные, а не код: меняются здесь, без деплоя.
 */
export default async function RootRequisitesPage() {
  await requireRoot();
  const requisites = await readPlatformRequisites();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Реквизиты и подпись
        </h1>
        <p className="mt-1 max-w-[720px] text-[14px] leading-relaxed text-[#6f7282]">
          Из этих данных собираются закрывающие документы (УПД) для клиентов: они
          скачивают их в «Настройки → Подписка», а после оплаты PDF уходит письмом.
          Пока чек-лист справа не закрыт, документы не выпускаются и в письмах их нет.
        </p>
      </div>
      <RequisitesClient initial={requisites} initialChecklist={requisitesChecklist(requisites)} />
    </div>
  );
}
