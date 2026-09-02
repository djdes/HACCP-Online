import Link from "next/link";
import { ArrowLeft, Eye, ShieldAlert } from "lucide-react";

import { ExitClientButton } from "@/components/partner/exit-client-button";
import { btnPrimary } from "@/components/partner/ui";
import { requireAuth } from "@/lib/auth-helpers";
import { PARTNER_ACCESS_LEVEL_LABELS } from "@/lib/partners/access-guard";

export const dynamic = "force-dynamic";

const DEFAULT_REASON = "Консультанту открыт только просмотр. Изменения вносит клиент.";

/** Только внутренние пути — чтобы `from` из адресной строки не увёл на чужой сайт. */
function safeBackHref(from: string | undefined): string {
  if (!from || !from.startsWith("/") || from.startsWith("//") || from.startsWith("/partner/denied")) return "/dashboard";
  return from;
}

/**
 * Сюда middleware отправляет партнёра, когда в кабинете клиента он
 * пытается сделать то, что клиент не разрешил (уровень «только просмотр»
 * или раздел, который меняет лишь сам клиент). Страница объясняет, кто
 * решает, и даёт два выхода: вернуться назад или уйти в свой кабинет.
 */
export default async function PartnerDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; from?: string }>;
}) {
  const session = await requireAuth();
  const { reason, from } = await searchParams;
  const access = session.user.partnerAccess ?? null;
  const backHref = safeBackHref(from);
  const text = reason?.trim() || DEFAULT_REASON;

  return (
    <div className="mx-auto max-w-[640px] py-6">
      <div className="rounded-3xl border border-[#ececf4] bg-white p-7 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-9">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff7ed] text-[#9a4a06]">
            <ShieldAlert className="size-6" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#0b1024]">Доступ ограничен</h1>
            <p className="mt-1.5 text-[15px] leading-[1.6] text-[#3c4053]">{text}</p>
          </div>
        </div>

        {access ? (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3 text-[13px] text-[#3c4053]">
            <Eye className="size-4 shrink-0 text-[#5566f6]" />
            <span>
              Вы в кабинете клиента как партнёр <span className="font-medium text-[#0b1024]">{access.brandName}</span>{" "}
              с уровнем «{PARTNER_ACCESS_LEVEL_LABELS[access.level]}».
            </span>
          </div>
        ) : null}

        <div className="mt-5 space-y-2 text-[14px] leading-[1.6] text-[#3c4053]">
          <p>
            Уровень доступа выбирает клиент — при подключении к вам и позже в{" "}
            <span className="font-medium text-[#0b1024]">Настройки → Консультант</span>. Если вам нужно вносить записи
            за клиента, попросите его переключить уровень на «{PARTNER_ACCESS_LEVEL_LABELS.edit}».
          </p>
          <p>
            Часть разделов клиент меняет только сам вне зависимости от уровня: оплату и тариф, удаление организации и
            настройки консультанта.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href={backHref} className={btnPrimary}>
            <ArrowLeft className="size-4" />
            Вернуться
          </Link>
          {access ? <ExitClientButton /> : null}
          <Link
            href="/partner"
            className="inline-flex h-10 items-center rounded-2xl px-4 text-[14px] font-medium text-[#3848c7] transition-colors hover:bg-[#f5f6ff]"
          >
            В кабинет партнёра
          </Link>
        </div>
      </div>
    </div>
  );
}
