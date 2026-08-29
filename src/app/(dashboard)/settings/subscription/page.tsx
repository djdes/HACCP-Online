import { Coins, Users } from "lucide-react";
import { redirect } from "next/navigation";
import { requireAuth, getActiveOrgId } from "@/lib/auth-helpers";
import { hasFullWorkspaceAccess } from "@/lib/role-access";
import { db } from "@/lib/db";
import { PlanUpgrade } from "@/components/settings/plan-upgrade";
import { calculatePerEmployeePrice } from "@/lib/per-employee-pricing";
import { HARDWARE_BUNDLES, bundleTotal } from "@/lib/hardware-pricing";
import {
  BILLING_TEST_MODE,
  FREE_MAX_USERS,
  planLabel,
} from "@/lib/plan-limits";

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
      _count: { select: { users: { where: { isActive: true } } } },
    },
  });

  const employees = org?._count.users || 1;
  const price = calculatePerEmployeePrice(employees);
  const plan = org?.subscriptionPlan ?? "trial";
  // Та же цифра, что в карточке железа на лендинге — считаем из одного
  // источника, чтобы витрины не разъехались.
  const hardwareFromRub = Math.min(...HARDWARE_BUNDLES.map(bundleTotal));

  return (
    <div className="space-y-5">
      <h1 className="text-[32px] font-semibold leading-tight tracking-[-0.02em] text-[#0b1024]">
        Улучшение тарифа
      </h1>

      {/* Витрина тарифов — главное на странице, поэтому первым блоком.
          Раньше здесь висел SubscriptionManager с мёртвыми
          starter/standard/pro, которые никогда не писались в БД. */}
      <PlanUpgrade
        currentPlan={plan}
        currentPlanLabel={planLabel(plan)}
        activeUsers={employees}
        freeUserLimit={FREE_MAX_USERS}
        billingTestMode={BILLING_TEST_MODE}
        hardwareFromRub={hardwareFromRub}
      />

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
              Платите только за реально работающих в системе. До{" "}
              {price.freeAllowance} сотрудников — бесплатно. Дальше —{" "}
              {price.pricePerUserRub} ₽ за каждого активного в месяц.
              Скидки применяются автоматически при росте команды.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <PricingStat
                label="Активных"
                value={String(employees)}
                hint={
                  <span className="inline-flex items-center gap-1 text-[#6f7282]">
                    <Users className="size-3" /> {price.bracketLabel}
                  </span>
                }
              />
              <PricingStat
                label="Платно"
                value={String(price.paidEmployees)}
                hint={
                  <span className="text-[#6f7282]">
                    бесплатно {price.freeAllowance} → платно остальные
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
                    <span className="text-[#6f7282]">
                      {price.yearlyRub.toLocaleString("ru-RU")} ₽/год
                    </span>
                  )
                }
                accent={price.isFree}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[13px] leading-relaxed text-[#6f7282]">
              <strong className="text-[#0b1024]">Шкала тарифов:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>1–5 сотрудников: бесплатно</li>
                <li>6–29: 100 ₽/чел/мес (сверх первых 5)</li>
                <li>30–99: 80 ₽/чел/мес</li>
                <li>100+ (сети): 60 ₽/чел/мес</li>
              </ul>
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
