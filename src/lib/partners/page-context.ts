import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

import { getPartnerMembership, type PartnerMembership, type PayoutDetails } from "./service";

/**
 * Контекст страниц `/partner/*`. Layout уже отсеивает не-партнёров, но в
 * Next страница рендерится параллельно с layout'ом — поэтому каждая
 * страница проверяет членство сама, прежде чем читать данные партнёра.
 */
export async function requirePartnerPage(): Promise<{ session: Session; membership: PartnerMembership }> {
  const session = await requireAuth();
  const membership = await getPartnerMembership(session.user.id);
  if (!membership) redirect("/settings/partner");
  // Не-активный партнёр видит страницу-статус из layout'а; данных кабинета ему не отдаём.
  if (membership.partner.status !== "active") redirect("/partner");
  return { session, membership };
}

export type PayoutFormState = {
  payoutType: "ip" | "self_employed" | "company" | null;
  details: {
    fullName: string;
    inn: string;
    bank: string;
    bik: string;
    account: string;
    kpp: string;
    ogrn: string;
  };
};

/** Реквизиты партнёра в форме, пригодной для клиентской формы (всё строки). */
export async function loadPayoutForm(partnerId: string): Promise<PayoutFormState> {
  const row = await db.partner.findUnique({
    where: { id: partnerId },
    select: { payoutType: true, payoutDetails: true },
  });
  const d = (row?.payoutDetails ?? {}) as Partial<PayoutDetails>;
  const type = row?.payoutType;
  return {
    payoutType: type === "ip" || type === "self_employed" || type === "company" ? type : null,
    details: {
      fullName: d.fullName ?? "",
      inn: d.inn ?? "",
      bank: d.bank ?? "",
      bik: d.bik ?? "",
      account: d.account ?? "",
      kpp: d.kpp ?? "",
      ogrn: d.ogrn ?? "",
    },
  };
}
