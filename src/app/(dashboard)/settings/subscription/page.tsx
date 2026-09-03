import { Coins, FlaskConical, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { PlanUpgrade } from "@/components/settings/plan-upgrade";
import { pricingScaleRows, quoteSubscription } from "@/lib/subscription-pricing";
import {
  EXTRA_USER_PRICE_RUB,
  SUBSCRIPTION_MAX_USERS,
} from "@/lib/plan-catalog";
import { HARDWARE_BUNDLES, bundleTotal } from "@/lib/hardware-pricing";
import {
  readTariffs,
  fallbackTariffs,
  TARIFF_MONTHLY,
} from "@/lib/tariffs";
import {
  BILLING_TEST_MODE,
  FREE_MAX_USERS,
  planLabel,
} from "@/lib/plan-limits";
import { RecurringCard } from "@/components/settings/recurring-card";
import { getTrialUsage } from "@/lib/trial-limits.server";
import { formatDaysRu, formatTrialEndDate } from "@/lib/trial";

export default async function SubscriptionPage() {
  // Раньше здесь стоял `requireRole(["owner"])`, и страница была
  // недостижима: normalizeUserRole переводит legacy-«owner» в «manager»,
  // так что список ["owner"] не совпадал ни с кем. Тариф правит тот же,
  // кто имеет полный доступ к кабинету, — как и в POST /upgrade.
  const session = await requireAuth();
  if (!hasFullWorkspaceAccess(session.user)) {
    redirect("/dashboard");
  }

  const org = await db.organization.findUnique({
    where: { id: getActiveOrgId(session) },
    select: {
      subscriptionPlan: true,
      subscriptionEnd: true,
      recurringActive: true,
      isDemo: true,
      _count: { select: { users: { where: { isActive: true } } } },
    },
  });

  // В демо-организации сотрудники тестовые и в тариф не входят — иначе
  // калькулятор показал бы «15 человек» и цену, которой не будет.
  const isDemo = org?.isDemo === true;
  const employees = isDemo ? 1 : org?._count.users || 1;
  const plan = org?.subscriptionPlan ?? "trial";
  // Тестовый период и лимиты бесплатного тарифа — одной строкой под
  // названием плана. null на платном.
  const trialUsage = await getTrialUsage(getActiveOrgId(session));
  const limitsLine = trialUsage
    ? `Лимиты: ${trialUsage.entriesLimit} записей в день, ${trialUsage.sensorsLimit} датчика, ${trialUsage.aiQuota} AI-сообщений в месяц.`
    : "";
  const trialNote = !trialUsage
    ? null
    : trialUsage.status.phase === "trial"
      ? `Тестовый период: ${trialUsage.status.daysLeft <= 1 ? "последний день" : `осталось ${formatDaysRu(trialUsage.status.daysLeft)}`} (до ${formatTrialEndDate(trialUsage.status.endsAt)}). ${limitsLine}`
      : trialUsage.status.phase === "expired"
        ? `Тестовый период закончился. ${limitsLine}`
        : limitsLine;
  // Та же цифра, что в карточке железа на лендинге — считаем из одного
  // источника, чтобы витрины не разъехались.
  const hardwareFromRub = Math.min(...HARDWARE_BUNDLES.map(bundleTotal));
  // Цена подписки живёт в БД и правится ROOT'ом — калькулятор берёт её
  // оттуда же, что и лендинг, иначе итоги на двух витринах разойдутся.
  const tariffs = await readTariffs().catch(() => fallbackTariffs());
  const monthly =
    tariffs.find((t) => t.key === TARIFF_MONTHLY) ?? fallbackTariffs()[0];
  const price = quoteSubscription(employees, monthly.priceRub);
  // Пример для справки: команда чуть больше подписки — видно и базу,
  // и доплату.
  const exampleEmployees = SUBSCRIPTION_MAX_USERS + 5;
  const example = quoteSubscription(exampleEmployees, monthly.priceRub);
  // История платежей организации. Только проведённые идут в итог: заказ
  // в статусе pending денег не принёс, и складывать его в «оплачено»
  // значит показывать выручку, которой нет.
  const payments = await db.paymentOrder.findMany({
    where: { organizationId: getActiveOrgId(session) },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      description: true,
      amountRub: true,
      status: true,
      isTest: true,
      paidAt: true,
      createdAt: true,
    },
  });
  const paidTotalRub = payments
    .filter((payment) => payment.status === "paid" && !payment.isTest)
    .reduce((sum, payment) => sum + Number(payment.amountRub), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[#0b1024]">
        Улучшение тарифа
      </h1>

      {isDemo ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#dcdfed] bg-[#f5f6ff] px-4 py-3 text-[13.5px] leading-[1.5] text-[#3848c7]">
          <FlaskConical className="mt-0.5 size-4 shrink-0" />
          <span>
            Это демо-организация — её сотрудники не учитываются в тарифе.
            Тариф общий для аккаунта и настраивается из вашей организации.
          </span>
        </div>
      ) : null}

      {/* Витрина тарифов — главное на странице, поэтому первым блоком.
          Раньше здесь висел SubscriptionManager с мёртвыми
          starter/standard/pro, которые никогда не писались в БД. */}
      <PlanUpgrade
        currentPlan={plan}
        currentPlanLabel={planLabel(plan)}
        trialNote={trialNote}
        activeUsers={employees}
        freeUserLimit={FREE_MAX_USERS}
        billingTestMode={BILLING_TEST_MODE}
        hardwareFromRub={hardwareFromRub}
        subscriptionMonthly={monthly.priceRub}
      />

      <RecurringCard
        active={org?.recurringActive === true}
        nextChargeAt={org?.subscriptionEnd?.toISOString() ?? null}
        monthlyRub={monthly.priceRub}
      />

      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <span className="text-[16px] font-semibold text-[#0b1024]">
            История платежей
          </span>
          {paidTotalRub > 0 ? (
            <span className="text-[13.5px] text-[#6f7282]">
              Оплачено за всё время:{" "}
              <span className="font-semibold tabular-nums text-[#0b1024]">
                {paidTotalRub.toLocaleString("ru-RU")} ₽
              </span>
            </span>
          ) : null}
        </div>

        {payments.length === 0 ? (
          <p className="mt-4 text-[13.5px] text-[#9b9fb3]">
            Платежей пока не было.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-[#9b9fb3]">
                  <th className="pb-2 font-medium">Дата и время</th>
                  <th className="pb-2 font-medium">Назначение</th>
                  <th className="pb-2 font-medium">Статус</th>
                  <th className="pb-2 text-right font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-[#f2f3f8]">
                    <td className="py-2.5 text-[#0b1024]">
                      {(payment.paidAt ?? payment.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="py-2.5 text-[#6f7282]">
                      {payment.description}
                      {/* Тестовый платёж помечаем и не считаем в итог —
                          иначе «оплачено» покажет деньги, которых не было. */}
                      {payment.isTest ? (
                        <span className="ml-2 rounded-full bg-[#f5f6ff] px-2 py-0.5 text-[11px] text-[#6f7282]">
                          тест
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={
                          payment.status === "paid"
                            ? "rounded-full bg-[#ecfdf5] px-2.5 py-0.5 text-[12px] text-[#116b2a]"
                            : "rounded-full bg-[#f5f6ff] px-2.5 py-0.5 text-[12px] text-[#6f7282]"
                        }
                      >
                        {payment.status === "paid" ? "оплачен" : payment.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums text-[#0b1024]">
                      {Number(payment.amountRub).toLocaleString("ru-RU")} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Расчёт по числу сотрудников — «как считается платный тариф».
          Справка второго уровня: нужна тем, кто уже решил улучшать. */}
      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <Coins className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Как считается стоимость
            </h2>
            <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-[#6f7282]">
              До {FREE_MAX_USERS} сотрудников — бесплатно. Команда до{" "}
              {SUBSCRIPTION_MAX_USERS} — одна подписка{" "}
              {monthly.priceRub.toLocaleString("ru-RU")} ₽/мес на всех, не за
              человека. Каждый сотрудник сверх {SUBSCRIPTION_MAX_USERS} —{" "}
              {`+${EXTRA_USER_PRICE_RUB} ₽/мес.`}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <PricingStat
                label="Активных"
                value={String(employees)}
                hint={
                  <span className="inline-flex items-center gap-1 text-[#6f7282]">
                    <Users className="size-3" /> {price.tierLabel}
                  </span>
                }
              />
              <PricingStat
                label={`Сверх ${SUBSCRIPTION_MAX_USERS}`}
                value={String(price.extraEmployees)}
                hint={
                  <span className="text-[#6f7282]">
                    {price.extraEmployees > 0
                      ? `+${EXTRA_USER_PRICE_RUB} ₽/мес за каждого`
                      : "входит в подписку"}
                  </span>
                }
              />
              <PricingStat
                label="В месяц"
                value={
                  price.isFree
                    ? "0 ₽"
                    : `${price.monthlyRub.toLocaleString("ru-RU")} ₽`
                }
                hint={
                  price.isFree ? (
                    <span className="font-medium text-[#116b2a]">
                      Бесплатно
                    </span>
                  ) : (
                    // Годового тарифа нет — ×12 только для ориентира.
                    <span className="text-[#6f7282]">
                      {price.yearlyRub.toLocaleString("ru-RU")} ₽/год без скидки
                    </span>
                  )
                }
                accent={price.isFree}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[13px] leading-relaxed text-[#6f7282]">
              <strong className="text-[#0b1024]">Шкала тарифов:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {pricingScaleRows(monthly.priceRub).map((row) => (
                  <li key={row.range}>
                    {row.range}: {row.price}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Например, {exampleEmployees} сотрудников:{" "}
                {example.baseRub.toLocaleString("ru-RU")} +{" "}
                {example.extraEmployees} × {EXTRA_USER_PRICE_RUB} ={" "}
                {example.monthlyRub.toLocaleString("ru-RU")} ₽/мес.
              </p>
              {BILLING_TEST_MODE ? (
                <p className="mt-3 text-[#3c4053]">
                  Пока сайт в тестовом режиме, суммы выше — справочные:
                  оплата не списывается.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PricingStat({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3"
      style={
        accent
          ? { borderColor: "#7cf5c0", backgroundColor: "#ecfdf5" }
          : undefined
      }
    >
      <div className="text-[12px] font-medium uppercase tracking-[0.06em] text-[#6f7282]">
        {label}
      </div>
      <div className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-[#0b1024]">
        {value}
      </div>
      <div className="mt-1.5 text-[12px]">{hint}</div>
    </div>
  );
}
