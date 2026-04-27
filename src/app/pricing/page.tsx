import Link from "next/link";
import { ArrowRight, Coins } from "lucide-react";
import { RoiCalculator } from "@/components/landing/roi-calculator";

export const metadata = {
  title: "Стоимость WeSetup — калькулятор ROI",
  description:
    "Сколько вы сэкономите с WeSetup? Калькулятор: стоимость, экономия часов, защита от штрафов РПН.",
};

/**
 * Публичная страница `/pricing` со ROI-калькулятором + кратким
 * описанием тарификации. H10 в brainstorm.
 */
export default function PricingPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          ← На главную
        </Link>
        <h1 className="mt-4 text-[clamp(2rem,2vw+1.5rem,2.75rem)] font-semibold tracking-[-0.02em] text-[#0b1024]">
          Сколько стоит WeSetup
        </h1>
        <p className="mt-3 max-w-[640px] text-[16px] leading-relaxed text-[#3c4053]">
          Платите только за активных сотрудников. До 5 человек — бесплатно
          навсегда. Дальше скидки растут с количеством. Никаких скрытых
          платежей.
        </p>
      </div>

      {/* Tarification overview */}
      <section className="rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-8">
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#3848c7]">
            <Coins className="size-6" />
          </span>
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.01em] text-[#0b1024]">
              Шкала тарифов
            </h2>
            <ul className="mt-3 space-y-1.5 text-[14px] leading-relaxed text-[#3c4053]">
              <li>
                <strong>1–5 сотрудников:</strong>{" "}
                <span className="text-[#116b2a]">бесплатно навсегда</span>
              </li>
              <li>
                <strong>6–29:</strong> 100 ₽ за каждого активного в месяц
                (сверх первых 5)
              </li>
              <li>
                <strong>30–99 (средний бизнес):</strong> 80 ₽/чел/мес
              </li>
              <li>
                <strong>100+ (сети):</strong> 60 ₽/чел/мес
              </li>
            </ul>
            <p className="mt-3 text-[13px] text-[#6f7282]">
              Скидка −20% при оплате за год вперёд. Подписка сразу со всеми
              функциями: AI-помощник по СанПиН, авто-CAPA, отчёты,
              интеграция с TasksFlow и Telegram-бот.
            </p>
          </div>
        </div>
      </section>

      <RoiCalculator />

      {/* CTA */}
      <section className="rounded-3xl border border-[#ececf4] bg-[#0b1024] p-8 text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)] md:p-10">
        <h2 className="text-[24px] font-semibold tracking-[-0.02em]">
          Попробуйте бесплатно
        </h2>
        <p className="mt-2 max-w-[480px] text-[15px] leading-relaxed text-white/70">
          Регистрация занимает 2 минуты. До 5 сотрудников — бесплатно
          навсегда. Карта не требуется.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-6 text-[15px] font-medium text-[#0b1024] hover:bg-white/90"
        >
          Зарегистрироваться <ArrowRight className="size-4" />
        </Link>
      </section>
    </div>
  );
}
