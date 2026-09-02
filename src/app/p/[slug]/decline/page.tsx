import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { BrandLogo } from "@/components/brand/logo";
import { PLATFORM_BADGE_TEXT } from "@/lib/partners/branding";
import { declineInviteByToken } from "@/lib/partners/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Отказ от приглашения",
  robots: { index: false, follow: false },
};

/**
 * Ссылка «Не интересно» из письма-приглашения. Токен одноразовый и
 * привязан к письму; после отказа приглашение получает статус
 * «Отказался» в кабинете партнёра, повторных писем на эту почту не будет.
 */
export default async function DeclineInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token && token.length >= 16 && token.length <= 200 ? await declineInviteByToken(token) : { ok: false as const };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f5fb] px-4 py-10">
      <div className="w-full max-w-[460px]">
        <div className="rounded-3xl border border-[#ececf4] bg-white p-7 text-center shadow-[0_20px_60px_-30px_rgba(11,16,36,0.35)] sm:p-9">
          {result.ok ? (
            <>
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#116b2a]">
                <CheckCircle2 className="size-6" />
              </span>
              <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">Приглашение отклонено</h1>
              <p className="mt-2 text-[14px] leading-[1.6] text-[#3c4053]">
                {result.brandName ? `${result.brandName} больше не будет присылать вам приглашения.` : "Больше писем не будет."}{" "}
                Если передумаете — WeSetup можно завести и без консультанта.
              </p>
            </>
          ) : (
            <>
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#fff4f2] text-[#a13a32]">
                <XCircle className="size-6" />
              </span>
              <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1024]">Ссылка не найдена</h1>
              <p className="mt-2 text-[14px] leading-[1.6] text-[#3c4053]">
                Приглашение уже отозвано или ссылка скопирована не полностью. Ничего делать не нужно.
              </p>
            </>
          )}
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff]"
          >
            На главную WeSetup
          </Link>
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-[#6f7282]">
          <span>{PLATFORM_BADGE_TEXT}</span>
          <BrandLogo height={14} title="" />
        </div>
      </div>
    </div>
  );
}
