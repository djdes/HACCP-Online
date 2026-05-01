import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireAuth } from "@/lib/auth-helpers";
import { hasCapability } from "@/lib/permission-presets";
import { ORG_TEMPLATES } from "@/lib/onboarding-templates";
import { OnboardingTemplateClient } from "@/components/settings/onboarding-template-client";

export const dynamic = "force-dynamic";

export default async function OnboardingTemplatePage() {
  const session = await requireAuth();
  if (!hasCapability(session.user, "admin.full")) redirect("/settings");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-[13px] text-[#6f7282] hover:text-[#0b1024]"
        >
          <ArrowLeft className="size-4" />
          К настройкам
        </Link>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-[#ececf4] bg-[#0b1024] text-white shadow-[0_20px_60px_-30px_rgba(11,16,36,0.55)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#5566f6] opacity-40 blur-[120px]" />
          <div className="absolute -bottom-40 -right-32 size-[460px] rounded-full bg-[#7a5cff] opacity-30 blur-[140px]" />
        </div>
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <Sparkles className="size-6" />
            </span>
            <div>
              <h1 className="text-[clamp(1.5rem,2vw+1rem,2rem)] font-semibold tracking-[-0.02em]">
                Шаблоны заведений
              </h1>
              <p className="mt-2 max-w-[680px] text-[14px] text-white/70">
                Один клик — и у организации настроены: должности,
                помещения, оборудование, обязательные журналы. Сотрудников
                и их телефоны добавишь сам потом. Можно применять
                несколько шаблонов подряд — будет добавление, не замена.
              </p>
            </div>
          </div>
        </div>
      </section>

      <OnboardingTemplateClient templates={ORG_TEMPLATES} />
    </div>
  );
}
