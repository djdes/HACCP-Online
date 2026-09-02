import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requireRoot } from "@/lib/auth-helpers";
import { getPartnerForAdmin } from "@/lib/partners/admin";
import { PartnerError } from "@/lib/partners/errors";

import { PartnerCardClient } from "./partner-card-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Карточка партнёра",
};

/**
 * ROOT → карточка партнёра: реквизиты заявки, решение по ней, договор,
 * клиенты с их заказами (отгрузка/возврат), команда, начисления и баланс.
 */
export default async function RootPartnerCardPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRoot();
  const { id } = await params;

  let data: Awaited<ReturnType<typeof getPartnerForAdmin>>;
  try {
    data = await getPartnerForAdmin(id);
  } catch (error) {
    if (error instanceof PartnerError && error.status === 404) notFound();
    throw error;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/root/partners"
        className="inline-flex items-center gap-2 text-[14px] text-[#6f7282] transition-colors hover:text-[#0b1024]"
      >
        <ArrowLeft className="size-4" />
        Все партнёры
      </Link>
      <PartnerCardClient data={data} />
    </div>
  );
}
