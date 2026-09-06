import { redirect } from "next/navigation";
import { Palette } from "lucide-react";

import { requireAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { PageHeader } from "@/components/ui/page-header";
import { ThemeModeControls } from "@/components/theme/theme-quick-switch";

export const dynamic = "force-dynamic";

/**
 * «Внешний вид» — светлая/тёмная тема кабинета.
 *
 * Переключатель раньше жил подменю в меню профиля: на телефоне это был
 * выпадающий список внутри выпадающего списка, и второй уровень уезжал
 * за край экрана. Тема — редкая настройка, её место в настройках.
 * Выбор хранится в аккаунте, поэтому применяется и на телефоне, и на
 * компьютере.
 */
export default async function AppearanceSettingsPage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/journals");

  return (
    <div className="space-y-5">
      <PageHeader
        title="Внешний вид"
        description="Тема кабинета: светлая, тёмная или как в системе."
      />

      <section className="rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
            <Palette className="size-5" />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-[#0b1024]">Тема</div>
            <div className="text-[13px] text-[#6f7282]">
              Выбор запоминается в вашем аккаунте.
            </div>
          </div>
        </div>

        <ThemeModeControls className="max-w-[420px]" />
      </section>
    </div>
  );
}
