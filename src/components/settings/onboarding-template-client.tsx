"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { OrgTemplate } from "@/lib/onboarding-templates";

type Props = {
  templates: OrgTemplate[];
};

export function OnboardingTemplateClient({ templates }: Props) {
  const router = useRouter();
  const [pendingKind, setPendingKind] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  async function applyTemplate(kind: string) {
    setApplying(kind);
    try {
      const res = await fetch("/api/settings/onboarding-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(data?.error ?? "Не удалось применить");
        return;
      }
      toast.success(
        `Шаблон применён: создано ${data.positionsCreated} должностей, ${data.areasCreated} помещений, ${data.equipmentCreated} единиц оборудования.`,
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setApplying(null);
    }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <div
            key={t.kind}
            className="flex flex-col rounded-3xl border border-[#ececf4] bg-white p-5 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] transition-all hover:border-[#5566f6]/30 hover:shadow-[0_8px_24px_-12px_rgba(85,102,246,0.25)]"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[24px]">
                {t.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em] text-[#0b1024]">
                  {t.label}
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-[#9b9fb3]">
                  <Users className="size-3" />
                  {t.staffSize}
                </div>
              </div>
            </div>
            <p className="mt-3 text-[13px] leading-snug text-[#3c4053]">
              {t.description}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-[#6f7282]">
              <div className="rounded-xl bg-[#fafbff] p-2 text-center">
                <div className="text-[14px] font-semibold text-[#0b1024]">
                  {t.positions.length}
                </div>
                <div className="text-[10px]">должностей</div>
              </div>
              <div className="rounded-xl bg-[#fafbff] p-2 text-center">
                <div className="text-[14px] font-semibold text-[#0b1024]">
                  {t.areas.length}
                </div>
                <div className="text-[10px]">помещений</div>
              </div>
              <div className="rounded-xl bg-[#fafbff] p-2 text-center">
                <div className="text-[14px] font-semibold text-[#0b1024]">
                  {t.enabledJournals === null
                    ? "все"
                    : t.enabledJournals.length}
                </div>
                <div className="text-[10px]">журналов</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPendingKind(t.kind)}
              disabled={applying !== null}
              className="mt-4 inline-flex h-10 items-center justify-center gap-1.5 rounded-2xl bg-[#5566f6] px-4 text-[13px] font-medium text-white shadow-[0_8px_20px_-10px_rgba(85,102,246,0.5)] transition-colors hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying === t.kind ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Применить шаблон
            </button>
          </div>
        ))}
      </div>

      {pendingKind ? (
        <ConfirmDialog
          open={pendingKind !== null}
          onClose={() => setPendingKind(null)}
          onConfirm={async () => {
            const k = pendingKind;
            setPendingKind(null);
            if (k) await applyTemplate(k);
          }}
          title="Применить шаблон?"
          description={
            <>
              Будут созданы должности, помещения, оборудование и
              включены обязательные журналы для типа «
              <strong>
                {templates.find((t) => t.kind === pendingKind)?.label}
              </strong>
              ».
            </>
          }
          bullets={[
            {
              label:
                "Существующие должности и помещения не удаляются — только добавляются новые.",
              tone: "info",
            },
            {
              label:
                "После применения нужно зайти в /settings/users и создать сотрудников с телефонами.",
              tone: "info",
            },
          ]}
          confirmLabel="Применить"
          variant="default"
          icon={Sparkles}
        />
      ) : null}
    </>
  );
}
