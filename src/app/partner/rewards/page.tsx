import Link from "next/link";
import { Download, FileSignature } from "lucide-react";

import { AccrualsTable, serializeAccrual } from "@/components/partner/accruals-table";
import { MonthFilter } from "@/components/partner/month-filter";
import { PayoutForm } from "@/components/partner/payout-form";
import { Card, Pill, btnOutline, formatDate, formatMonth, formatRubFixed } from "@/components/partner/ui";
import { PageGuide } from "@/components/ui/page-guide";
import { db } from "@/lib/db";
import { listAccruals, summarizeBalances, summarizeByMonth } from "@/lib/partners/accruals";
import { loadPayoutForm, requirePartnerPage } from "@/lib/partners/page-context";
import { getCurrentRewardRule } from "@/lib/partners/schema-extras";
import { PARTNER_AGREEMENT_URL } from "@/lib/partners/validation";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export default async function PartnerRewardsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { membership } = await requirePartnerPage();
  const { month } = await searchParams;
  const periodMonth = month && MONTH_RE.test(month) ? month : null;
  const partnerId = membership.partnerId;

  const [all, rule, payout, agreement] = await Promise.all([
    listAccruals({ partnerId }),
    getCurrentRewardRule(),
    loadPayoutForm(partnerId),
    db.partner.findUnique({ where: { id: partnerId }, select: { agreementSignedAt: true, agreementNumber: true } }),
  ]);

  const months = summarizeByMonth(all);
  const balances = summarizeBalances(all);
  const rows = (periodMonth ? all.filter((r) => r.periodMonth === periodMonth) : all).map(serializeAccrual);
  const monthTotal = periodMonth ? months.find((m) => m.periodMonth === periodMonth) : null;
  const csvHref = `/api/partner/rewards/csv${periodMonth ? `?month=${periodMonth}` : ""}`;
  const canEditPayout = membership.role === "owner";
  const payoutFilled = Boolean(payout.payoutType && payout.details.inn && payout.details.account);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#0b1024]">Вознаграждение</h1>
          <p className="mt-1 text-[14px] text-[#6f7282]">
            Начисления по вашим клиентам, итоги по месяцам и реквизиты для выплат.
          </p>
        </div>
        <a href={csvHref} className={btnOutline} download>
          <Download className="size-4 text-[#5566f6]" />
          Скачать CSV{periodMonth ? ` за ${formatMonth(periodMonth)}` : ""}
        </a>
      </div>

      <PageGuide
        title="Как считается и выплачивается"
        storageKey="partner-rewards"
        bullets={[
          `Подписка: ${rule.subscriptionPercent}% от каждого платежа клиента в течение ${rule.subscriptionMonths} месяцев с его первой оплаты.`,
          `Оборудование: ${rule.hardwarePercent}% от стоимости после статуса «оплачен и отгружен».`,
          `Бонус ${formatRubFixed(rule.bonusAmountRub)} — после ${rule.bonusAfterPayments}-го платежа клиента за подписку.`,
          "Возврат клиенту — сторно на ту же сумму со знаком минус. Начисления за месяц становятся «к выплате» 1-го числа следующего месяца.",
          `Минимальная выплата — ${formatRubFixed(rule.minPayoutRub)}; меньшая сумма переносится на следующий месяц. Выплату подтверждает WeSetup, указывая дату и номер документа.`,
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Начислено, ждёт закрытия месяца" value={formatRubFixed(balances.accrued)} />
        <Tile label="К выплате" value={formatRubFixed(balances.payable)} accent />
        <Tile label="Выплачено всего" value={formatRubFixed(balances.paid)} />
      </div>

      <Card
        title="Начисления"
        eyebrow="Таблица"
        actions={monthTotal ? <Pill tone="indigo">итого за месяц {formatRubFixed(monthTotal.total)}</Pill> : null}
      >
        <div className="mb-4">
          <MonthFilter months={months.map((m) => m.periodMonth)} current={periodMonth} />
        </div>
        <AccrualsTable rows={rows} />
      </Card>

      {months.length > 0 ? (
        <Card title="Итоги по месяцам" eyebrow="Сводка">
          <div className="overflow-x-auto rounded-2xl border border-[#ececf4]">
            <table className="w-full min-w-[520px] text-left text-[14px]">
              <thead className="bg-[#fafbff] text-[12px] uppercase tracking-[0.08em] text-[#6f7282]">
                <tr className="border-b border-[#ececf4]">
                  <th className="px-4 py-2.5 font-medium">Месяц</th>
                  <th className="px-3 py-2.5 text-right font-medium">Начислено</th>
                  <th className="px-3 py-2.5 text-right font-medium">К выплате</th>
                  <th className="px-3 py-2.5 text-right font-medium">Выплачено</th>
                  <th className="px-4 py-2.5 text-right font-medium">Итого</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.periodMonth} className="border-b border-[#f0f1f7] last:border-b-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/partner/rewards?month=${m.periodMonth}`} className="font-medium text-[#0b1024] hover:text-[#5566f6]">
                        {formatMonth(m.periodMonth)}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#3c4053]">{formatRubFixed(m.accrued)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#3c4053]">{formatRubFixed(m.payable)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-[#3c4053]">{formatRubFixed(m.paid)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums text-[#0b1024]">{formatRubFixed(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card
          title="Реквизиты для выплат"
          eyebrow="Куда переводить"
          actions={payoutFilled ? <Pill tone="ok">заполнены</Pill> : <Pill tone="warn">не заполнены</Pill>}
        >
          <PayoutForm initial={payout} canEdit={canEditPayout} />
          {!canEditPayout ? (
            <p className="mt-3 text-[12px] text-[#6f7282]">Реквизиты меняет владелец партнёрского аккаунта.</p>
          ) : null}
        </Card>

        <div className="space-y-5">
          <Card title="Договор" eyebrow="Партнёрское соглашение">
            {agreement?.agreementSignedAt ? (
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#ecfdf5] text-[#116b2a]">
                  <FileSignature className="size-5" />
                </span>
                <div>
                  <div className="font-medium text-[#0b1024]">Договор подписан</div>
                  <div className="text-[13px] text-[#6f7282]">
                    {agreement.agreementNumber ? `№ ${agreement.agreementNumber}, ` : ""}
                    {formatDate(agreement.agreementSignedAt.toISOString())}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#fff7ed] text-[#9a4a06]">
                    <FileSignature className="size-5" />
                  </span>
                  <div>
                    <div className="font-medium text-[#0b1024]">Договор ещё не подписан</div>
                    <p className="text-[13px] leading-[1.5] text-[#6f7282]">
                      Выплаты возможны только по подписанному договору. Отметку о подписании ставит WeSetup.
                    </p>
                  </div>
                </div>
                <Link href={PARTNER_AGREEMENT_URL} target="_blank" className={btnOutline}>
                  Открыть текст договора
                </Link>
              </div>
            )}
          </Card>

          <Card title="Правила вознаграждения" eyebrow={`Версия ${rule.version}`}>
            <dl className="space-y-2 text-[14px]">
              <Rule label="Подписка" value={`${rule.subscriptionPercent}% · ${rule.subscriptionMonths} мес.`} />
              <Rule label="Оборудование" value={`${rule.hardwarePercent}%`} />
              <Rule label="Бонус" value={`${formatRubFixed(rule.bonusAmountRub)} после ${rule.bonusAfterPayments}-го платежа`} />
              <Rule label="Минимальная выплата" value={formatRubFixed(rule.minPayoutRub)} />
            </dl>
            <p className="mt-3 text-[12px] leading-[1.5] text-[#6f7282]">
              Правила задаёт WeSetup. Каждое начисление помнит версию правил, по которой рассчитано, — новая версия
              не меняет старые строки.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={
        accent
          ? "rounded-3xl border border-[#5566f6]/30 bg-[#eef1ff] p-4"
          : "rounded-3xl border border-[#ececf4] bg-white p-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]"
      }
    >
      <div className="text-[12px] text-[#6f7282]">{label}</div>
      <div className="mt-1 text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-[#0b1024]">{value}</div>
    </div>
  );
}

function Rule({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#f0f1f7] pb-2 last:border-b-0 last:pb-0">
      <dt className="text-[#6f7282]">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-[#0b1024]">{value}</dd>
    </div>
  );
}
