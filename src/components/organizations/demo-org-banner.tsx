"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FlaskConical, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { demoDaysLeft } from "@/lib/demo-organization.shared";

/**
 * Полоса «вы в демо» над контентом.
 *
 * Не закрывается: человек должен всегда видеть, что журналы, сотрудники
 * и compliance перед ним — тестовые, и что они исчезнут. Две кнопки —
 * ровно два выхода из песочницы: вернуться в свою организацию (демо
 * остаётся до срока) или удалить демо прямо сейчас.
 *
 * `?welcome-demo=1` — первый показ сразу после создания: баннер тот же,
 * плюс тост, чтобы переключение не осталось незамеченным.
 */
export function DemoOrgBanner({
  organizationName,
  demoExpiresAt,
  homeOrganizationId,
  staffCount,
  documentsCount,
}: {
  organizationName: string;
  /** ISO — из server component дату сериализуем строкой. */
  demoExpiresAt: string | null;
  homeOrganizationId: string;
  staffCount: number;
  documentsCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const welcome = searchParams.get("welcome-demo") === "1";

  const [leaving, setLeaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const welcomed = useRef(false);

  useEffect(() => {
    if (!welcome || welcomed.current) return;
    welcomed.current = true;
    toast.success("Вы в демо-организации", {
      description:
        "Сотрудники и журналы здесь тестовые. Вернуться к себе можно в один клик.",
    });
    // Параметр из адреса убираем: перезагрузка не должна повторять тост.
    router.replace("/dashboard");
  }, [welcome, router]);

  const expires = demoExpiresAt ? new Date(demoExpiresAt) : null;
  const daysLeft = expires ? demoDaysLeft(expires, new Date()) : null;
  const expiresLabel = expires
    ? expires.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })
    : null;

  async function leave() {
    setLeaving(true);
    try {
      const res = await fetch("/api/me/active-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: homeOrganizationId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Не удалось переключиться");
      toast.success("Вы вернулись в свою организацию");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setLeaving(false);
    }
  }

  async function remove() {
    const res = await fetch("/api/organizations/demo", { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      toast.error(data?.error ?? "Не удалось удалить демо");
      return;
    }
    toast.success(
      `Демо удалено: ${pluralize(data.staff, "сотрудник", "сотрудника", "сотрудников")}, ${pluralize(data.documents, "документ", "документа", "документов")}, ${pluralize(data.entries, "запись", "записи", "записей")}`,
    );
    setConfirmOpen(false);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 pt-4 md:px-8">
      <div
        data-testid="demo-org-banner"
        className="rounded-3xl border border-[#dcdfed] bg-[#fafbff] p-4 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-5"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#5566f6]">
              <FlaskConical className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-[#0b1024]">
                Демо-организация «{organizationName}» — данные тестовые
              </div>
              <p className="mt-0.5 text-[13px] leading-[1.5] text-[#6f7282]">
                {daysLeft !== null && expiresLabel
                  ? `Удалится автоматически через ${pluralize(daysLeft, "день", "дня", "дней")} (${expiresLabel})`
                  : "Удалится автоматически через 7 дней"}
                {" · "}
                ваша организация не пострадает.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 md:pl-3">
            <button
              type="button"
              onClick={leave}
              disabled={leaving}
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-[#5566f6] px-4 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors duration-150 hover:bg-[#4a5bf0] disabled:cursor-not-allowed disabled:bg-[#c9cef7] disabled:shadow-none"
            >
              {leaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowLeft className="size-4" />
              )}
              Вернуться в мою организацию
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#a13a32] transition-colors duration-150 hover:border-[#a13a32]/40 hover:bg-[#fff4f2]"
            >
              <Trash2 className="size-4" />
              Удалить демо
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={remove}
        variant="danger"
        title="Удалить демо-организацию?"
        description={`«${organizationName}» исчезнет вместе со всем содержимым. Создать демо заново можно из меню профиля.`}
        bullets={[
          { label: `Сотрудников: ${staffCount}`, tone: "warn" },
          { label: `Документов журналов: ${documentsCount}`, tone: "warn" },
          { label: "Ваша организация не пострадает", tone: "info" },
        ]}
        confirmLabel="Удалить демо"
      />
    </div>
  );
}

function pluralize(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? one
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? few
        : many;
  return `${n} ${word}`;
}
