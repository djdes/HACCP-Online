import { Handshake } from "lucide-react";

import { requireRoot } from "@/lib/auth-helpers";
import { buildPayoutSheetForAdmin, listRewardRules } from "@/lib/partners/accruals";
import { listPartnersForAdmin } from "@/lib/partners/admin";
import { PAYOUT_TYPE_LABELS, type PayoutType } from "@/lib/partners/service";

import { PartnersAdminClient, type AdminTab } from "./partners-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Партнёры",
};

const TABS: readonly AdminTab[] = ["applications", "partners", "payouts", "rules"];

function payoutDetailsText(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const d = raw as Record<string, unknown>;
  return [d.fullName, d.inn && `ИНН ${d.inn}`, d.bank, d.bik && `БИК ${d.bik}`, d.account && `р/с ${d.account}`]
    .filter(Boolean)
    .join(", ");
}

/**
 * ROOT → «Партнёры»: заявки на партнёрство, действующие партнёры,
 * ведомость к выплате и версии правил вознаграждения. Данные читаются на
 * сервере, действия (одобрить / отклонить / закрыть месяц / выплатить /
 * новая версия правил) идут через `/api/root/partners/*`, после чего
 * клиент делает `router.refresh()`.
 */
export default async function RootPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRoot();
  const { tab } = await searchParams;
  const initialTab: AdminTab = TABS.includes(tab as AdminTab) ? (tab as AdminTab) : "applications";

  const [{ partners, counts }, rules, sheet] = await Promise.all([
    listPartnersForAdmin("all"),
    listRewardRules(),
    buildPayoutSheetForAdmin(),
  ]);

  const payoutLines = sheet.lines.map((line) => ({
    partnerId: line.partnerId,
    companyName: line.companyName,
    slug: line.slug,
    payoutTypeLabel: line.payoutType
      ? (PAYOUT_TYPE_LABELS[line.payoutType as PayoutType] ?? line.payoutType)
      : null,
    payoutDetailsText: payoutDetailsText(line.payoutDetails),
    agreementSigned: Boolean(line.agreementSignedAt),
    agreementNumber: line.agreementNumber,
    payableRub: line.payableRub,
    carryOver: line.carryOver,
    accrualCount: line.accrualCount,
  }));

  const ruleVersions = rules.map((rule) => ({
    id: rule.id,
    version: rule.version,
    subscriptionPercent: rule.subscriptionPercent,
    subscriptionMonths: rule.subscriptionMonths,
    hardwarePercent: rule.hardwarePercent,
    bonusAmountRub: rule.bonusAmountRub,
    bonusAfterPayments: rule.bonusAfterPayments,
    minPayoutRub: rule.minPayoutRub,
    comment: rule.comment,
    effectiveFrom: rule.effectiveFrom.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
          <Handshake className="size-5" />
        </span>
        <div>
          <h1 className="text-[clamp(1.625rem,1.5vw+1.2rem,2rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
            Партнёры
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[14px] leading-relaxed text-[#6f7282]">
            Заявки консультантов и интеграторов, их клиенты и вознаграждение. Одобрение включает партнёру
            кабинет <code className="rounded bg-[#f4f5fb] px-1">/partner</code>, ссылку{" "}
            <code className="rounded bg-[#f4f5fb] px-1">/p/&lt;slug&gt;</code> и white-label; отклонение и
            приостановка — с комментарием, который партнёр увидит у себя. Начисления считаются автоматически
            по версии правил, действовавшей на момент платежа; 1-го числа они переходят в «к выплате», выплату
            отмечаете вручную после перевода.
          </p>
        </div>
      </div>

      <PartnersAdminClient
        initialTab={initialTab}
        partners={partners}
        counts={counts}
        payoutLines={payoutLines}
        minPayoutRub={sheet.minPayoutRub}
        rules={ruleVersions}
      />
    </div>
  );
}
