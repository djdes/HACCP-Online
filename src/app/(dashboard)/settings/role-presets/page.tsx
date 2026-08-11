import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { getServerSession } from "@/lib/server-session";
import { authOptions } from "@/lib/auth";
import {
  getDefaultCapabilities,
  hasCapability,
  listAllPresets,
  type PermissionPreset,
} from "@/lib/permission-presets";
import { db } from "@/lib/db";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { RolePresetsClient } from "@/components/settings/role-presets-client";

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

export default async function RolePresetsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!hasCapability(session.user, "admin.full")) redirect("/journals");

  const orgId = getActiveOrgId(session);
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { presetCapabilitiesJson: true },
  });
  const initialOverrides =
    org?.presetCapabilitiesJson &&
    typeof org.presetCapabilitiesJson === "object" &&
    !Array.isArray(org.presetCapabilitiesJson)
      ? (org.presetCapabilitiesJson as Record<string, string[]>)
      : null;

  const presets = listAllPresets().map((p) => ({
    ...p,
    defaults: getDefaultCapabilities(p.value as PermissionPreset),
  }));
  const capabilityKeys = Object.keys(CAPABILITY_LABELS);

  return (
    <div className="space-y-5">
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
              <h1 className="text-[clamp(1.75rem,2vw+1rem,2rem)] font-bold leading-tight tracking-[-0.02em]">
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
        <strong>Заведующая (head_chef)</strong> по умолчанию НЕ имеет
        capability <code className="rounded bg-white/50 px-1 font-mono">journals.view</code>
        — она видит «задачи» вместо «журналы», работает на Контрольной
        доске и проверяет выполненные задачи. Если нужно — поставь
        галочку ниже и она получит доступ к /journals.
      </div>

      <RolePresetsClient
        presets={presets}
        capabilityKeys={capabilityKeys}
        capabilityLabels={CAPABILITY_LABELS}
        initialOverrides={initialOverrides}
      />

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
