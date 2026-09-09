import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { badgeTone } from "@/lib/badge/render";
import { getBadgeStatusByCode } from "@/lib/badge/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const status = await getBadgeStatusByCode(code);
  if (!status) return { title: "Бейдж не найден — WeSetup" };
  return {
    title: `${status.name} — электронные журналы ХАССП в WeSetup`,
    description: `Организация ведёт производственный контроль в WeSetup. Заполнено ${status.percent ?? "—"}% журналов за последние ${status.days} дней.`,
  };
}

const CHECKS = [
  "Журналы температуры, гигиены, уборки и приёмки ведутся в электронном виде",
  "Записи с датой, временем и автором — их нельзя дописать задним числом",
  "Отклонения от норм фиксируются и закрываются корректирующими действиями",
];

/** Публичная страница бейджа: без сотрудников, без содержимого записей — только статус. */
export default async function PublicBadgePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const status = await getBadgeStatusByCode(code);
  if (!status) notFound();
  const tone = badgeTone(status.percent);
  const computed = new Date(status.computedAt).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", dateStyle: "medium", timeStyle: "short" });

  return (
    <main className="min-h-screen bg-[#fafbff] px-4 py-10 text-[#0b1024] sm:py-16">
      <div className="mx-auto max-w-[640px]">
        <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 size-[320px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
            <div className="absolute -bottom-32 -right-24 size-[360px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
          </div>
          <div className="relative z-10 p-7 sm:p-9">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/60">Проверено WeSetup</div>
            <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.02em] sm:text-[32px]">{status.name}</h1>
            <p className="mt-1 text-[14px] text-white/70">{status.sphere} · ведёт электронные журналы СанПиН и ХАССП</p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex size-24 shrink-0 items-center justify-center rounded-full border-4 text-[26px] font-semibold tabular-nums" style={{ borderColor: tone.color }}>
                {status.percent === null ? "—" : `${status.percent}%`}
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold">Заполнено журналов за {status.days} дней</div>
                <div className="mt-1 inline-flex rounded-full px-3 py-1 text-[13px] font-medium" style={{ background: tone.soft, color: tone.color }}>
                  {tone.label}
                </div>
                <p className="mt-2 text-[12.5px] text-white/60">
                  {status.percent === null ? "Журналы ещё не заполнялись." : `${status.filledSlots} из ${status.totalSlots} ежедневных записей.`} Обновлено {computed}.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-7">
          <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#6f7282]">Что это значит</div>
          <ul className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-[#3c4053]">
            {CHECKS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#5566f6]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-[#9b9fb3]">
            Страница обезличена: здесь нет имён сотрудников и содержимого записей — только факт ведения журналов и доля заполненных за последний месяц. Статус считается автоматически и не редактируется организацией.
          </p>
        </section>

        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
          >
            Узнать о WeSetup
          </Link>
          <span className="text-[12px] text-[#9b9fb3]">Электронные журналы СанПиН и ХАССП для кафе, ресторанов и производств</span>
        </div>
      </div>
    </main>
  );
}
