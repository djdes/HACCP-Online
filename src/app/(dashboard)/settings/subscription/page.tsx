import { Coins, Users } from "lucide-react";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { SubscriptionManager } from "@/components/settings/subscription-manager";
import { calculatePerEmployeePrice } from "@/lib/per-employee-pricing";

export default async function SubscriptionPage() {
  const session = await requireRole(["owner"]);

  const org = await db.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      subscriptionPlan: true,
      subscriptionEnd: true,
      _count: { select: { users: { where: { isActive: true } } } },
    },
  });

  const employees = org?._count.users || 1;
  const price = calculatePerEmployeePrice(employees);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Управление подпиской</h1>

      {/* Per-employee pricing card — расчёт по числу активных сотрудников.
          До 5 чел — бесплатно (free tier), после — 100/80/60 ₽/чел. */}
      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <Coins className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[#0b1024]">
              Стоимость по числу сотрудников
            </h2>
            <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-[#6f7282]">
              Платите только за реально работающих в системе. До{" "}
              {price.freeAllowance} сотрудников — бесплатно. Дальше —{" "}
              {price.pricePerUserRub} ₽ за каждого активного в месяц.
              Скидки автоматически применяются при росте.
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
            </div>

            {/* H9 — годовая скидка 20% — отображается только при платной
                подписке (бесплатной нечего скидывать). */}
            {!price.isFree ? (
              <div className="mt-3 rounded-2xl border border-[#86efac] bg-[#ecfdf5] p-4 text-[13px] leading-relaxed text-[#3c4053]">
                <strong className="text-[#116b2a]">
                  Годовая подписка: −20%
                </strong>
                <div className="mt-1">
                  Оплатив сразу 12 месяцев, вы платите{" "}
                  <span className="font-semibold tabular-nums">
                    {Math.round(price.yearlyRub * 0.8).toLocaleString("ru-RU")} ₽
                  </span>{" "}
                  вместо{" "}
                  <span className="line-through tabular-nums">
                    {price.yearlyRub.toLocaleString("ru-RU")} ₽
                  </span>{" "}
                  — экономия{" "}
                  <span className="font-semibold text-[#116b2a] tabular-nums">
                    {Math.round(price.yearlyRub * 0.2).toLocaleString("ru-RU")} ₽
                  </span>
                  . Свяжитесь с поддержкой через виджет, мы выставим
                  отдельный счёт.
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <SubscriptionManager
        currentPlan={org?.subscriptionPlan || "trial"}
        subscriptionEnd={org?.subscriptionEnd?.toISOString() || null}
        activeUsers={employees}
      />
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
      <div className="mt-1 text-[26px] font-semibold tabular-nums leading-none text-[#0b1024]">
        {value}
      </div>
      <div className="mt-1.5 text-[12px]">{hint}</div>
    </div>
  );
}
