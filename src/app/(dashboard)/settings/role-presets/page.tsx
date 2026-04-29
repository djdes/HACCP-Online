import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import { hasCapability, listAllPresets } from "@/lib/permission-presets";

export const dynamic = "force-dynamic";

const CAPABILITY_LABELS: Record<string, string> = {
  "journals.view": "Видит журналы как журналы",
  "journals.manage": "Редактирует журналы и документы",
  "staff.manage": "Управление сотрудниками",
  "staff.view": "Видит сотрудников (read-only)",
  "tasks.verify": "Проверка выполненных задач",
  "reports.view": "Доступ к отчётам",
  "admin.full": "Полные права админа",
  "mini.tasks": "Mini App — задачи смены",
  "mini.acceptance": "Mini App — приёмка",
  "mini.writeoff": "Mini App — списания",
  "mini.cashier": "Mini App — касса",
  "stats.view": "Видит compliance-статистику",
};

const PRESET_CAPABILITIES_MIRROR: Record<string, string[]> = {
  admin: [
    "journals.view",
    "journals.manage",
    "staff.manage",
    "staff.view",
    "tasks.verify",
    "reports.view",
    "admin.full",
    "mini.tasks",
    "mini.acceptance",
    "mini.writeoff",
    "mini.cashier",
    "stats.view",
  ],
  head_chef: ["staff.view", "tasks.verify", "stats.view", "mini.tasks"],
  cook: ["mini.tasks"],
  waiter: ["mini.tasks"],
  seller: ["mini.tasks", "mini.acceptance"],
  cashier: ["mini.tasks", "mini.acceptance", "mini.writeoff", "mini.cashier"],
  cleaner: ["mini.tasks"],
};

export default async function RolePresetsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasCapability(session.user, "admin.full")) redirect("/journals");

  const presets = listAllPresets();
  const capabilityKeys = Object.keys(CAPABILITY_LABELS);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 md:p-10">
          <Link
            href="/settings"
            className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Настройки
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold leading-tight tracking-[-0.02em]">
                Пресеты ролей
              </h1>
              <p className="mt-2 max-w-[640px] text-[15px] text-white/70">
                Что видит каждая роль на сайте и в Telegram-боте. Назначить
                пресет конкретному сотруднику можно в{" "}
                <Link
                  href="/settings/users"
                  className="text-white underline underline-offset-2"
                >
                  «Сотрудники»
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-3xl border border-[#ffe9b0] bg-[#fff8eb] p-4 text-[13px] text-[#a13a32]">
        <strong>Заведующая (head_chef)</strong> намеренно НЕ имеет
        capability <code className="rounded bg-white/50 px-1 font-mono">journals.view</code>
        — она видит «задачи» вместо «журналы», работает на Контрольной
        доске и проверяет выполненные задачи. Технически это
        compliance-журнал, но сотрудник не должен это слово видеть.
      </div>

      <div className="rounded-3xl border border-[#ececf4] bg-white p-2 shadow-[0_0_0_1px_rgba(240,240,250,0.45)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-[#ececf4] bg-white px-3 py-3 text-left text-[12px] font-semibold uppercase tracking-[0.14em] text-[#9b9fb3]">
                  Возможность
                </th>
                {presets.map((p) => (
                  <th
                    key={p.value}
                    className="border-b border-[#ececf4] px-2 py-3 text-center text-[11px] font-semibold text-[#3c4053]"
                    title={p.description}
                  >
                    <div className="text-[12px] font-semibold text-[#0b1024]">
                      {p.label}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#9b9fb3]">
                      {p.value}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {capabilityKeys.map((cap) => (
                <tr key={cap}>
                  <td className="sticky left-0 z-10 border-b border-[#ececf4] bg-white px-3 py-2 align-middle">
                    <div className="text-[12px] font-medium text-[#0b1024]">
                      {CAPABILITY_LABELS[cap]}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[#9b9fb3]">
                      {cap}
                    </div>
                  </td>
                  {presets.map((p) => {
                    const has =
                      PRESET_CAPABILITIES_MIRROR[p.value]?.includes(cap) ?? false;
                    return (
                      <td
                        key={p.value + cap}
                        className="border-b border-[#ececf4] px-2 py-2 text-center"
                      >
                        {has ? (
                          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#136b2a]">
                            ✓
                          </span>
                        ) : (
                          <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[#fafbff] text-[#dcdfed]">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4 text-[12px] text-[#6f7282]">
        Чтобы сменить пресет конкретному сотруднику — открой{" "}
        <Link href="/settings/users" className="text-[#3848c7] underline">
          /settings/users
        </Link>{" "}
        и выбери из списка. Изменения применяются live — сотрудник сразу
        видит новый интерфейс при следующем reload.
      </div>
    </div>
  );
}
