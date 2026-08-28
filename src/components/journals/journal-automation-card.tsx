"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  AUTOMATION_ENABLE_BULLETS,
  AUTOMATION_TOGGLE_HINT,
  AUTOMATION_TOGGLE_LABEL,
} from "@/lib/journal-automation";

/**
 * Карточка-тумблер «Автосоздание новых журналов и ежедневное
 * автозаполнение» над списком документов гигиенического журнала и
 * журнала здоровья.
 *
 * Почему целая карточка, а не голый Switch: включение меняет поведение
 * всей организации (документы появляются сами, прошлые дни закрываются
 * на редактирование) — человек обязан прочитать, на что подписывается.
 * Поэтому одно и то же объяснение живёт в трёх местах: модалка
 * включения, ⓘ-модалка и разовое уведомление после backfill'а.
 */
/**
 * Ключ разового уведомления. Хранится в аккаунте (`User.seenNoticesJson`),
 * а не в localStorage: раньше отметка жила в браузере, и человек, который
 * заходит с ноутбука и с телефона, видел уведомление снова и снова.
 */
const NOTICE_KEY = "hygiene-automation";

type DialogMode = "enable" | "disable" | "info" | "notice" | null;

export function JournalAutomationCard({
  code,
  enabled: initialEnabled,
  canManage,
  noticeSeen,
}: {
  code: string;
  enabled: boolean;
  canManage: boolean;
  /** Человек уже видел разовое уведомление про автоматику. */
  noticeSeen: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [saving, setSaving] = useState(false);

  // Разовое уведомление после массового включения автоматики: человек
  // не нажимал тумблер сам, поведение изменилось «само» — обязаны
  // сказать об этом один раз и дать выключить.
  //
  // Отметку ставим сразу при показе и не ждём ответа сервера: если
  // запрос не дойдёт, уведомление всплывёт ещё раз — это терпимо, а вот
  // показать его дважды подряд из-за гонки нельзя.
  useEffect(() => {
    if (!initialEnabled || noticeSeen) return;
    setDialog("notice");
    void fetch("/api/me/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: NOTICE_KEY }),
    }).catch(() => {
      /* не смогли отметить — увидит ещё раз, это не ошибка */
    });
  }, [initialEnabled, noticeSeen]);

  async function apply(next: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/settings/journal-automation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, enabled: next }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(data?.error ?? "Не удалось сохранить");
        return;
      }
      setEnabled(next);
      setDialog(null);
      toast.success(
        next
          ? "Автоматика включена — первый прогон завтра в 06:00"
          : "Автоматика выключена. Уже заполненное осталось на месте"
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setSaving(false);
    }
  }

  const bullets = AUTOMATION_ENABLE_BULLETS.map((label, index) => ({
    label,
    // Последний пункт — про запрет правок задним числом: он важнее
    // остальных, поэтому красный маркер.
    tone: index === AUTOMATION_ENABLE_BULLETS.length - 1 ? ("warn" as const) : ("info" as const),
  }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ececf4] bg-white px-4 py-3 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] sm:px-5">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-2xl transition-colors duration-150 ${
            enabled ? "bg-[#eef1ff] text-[#5566f6]" : "bg-[#f5f6ff] text-[#9b9fb3]"
          }`}
        >
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] font-medium leading-[1.35] text-[#0b1024]">
              {AUTOMATION_TOGGLE_LABEL}
            </span>
            <button
              type="button"
              onClick={() => setDialog("info")}
              aria-label="Что делает автоматика"
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[#9b9fb3] transition-colors duration-150 hover:bg-[#f5f6ff] hover:text-[#5566f6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
            >
              <Info className="size-4" />
            </button>
          </div>
          <div className="mt-0.5 text-[12px] leading-[1.4] text-[#6f7282]">
            {enabled
              ? AUTOMATION_TOGGLE_HINT
              : "Выключено — документы и отметки заводите вручную"}
          </div>
          {enabled ? (
            <div className="mt-1 text-[12px] leading-[1.4] text-[#9b9fb3]">
              Журналы создаются сами каждый день в 06:00 — создавать вручную
              нужно только для другого периода.
            </div>
          ) : null}
        </div>
        {saving ? (
          <Loader2 className="size-4 animate-spin text-[#5566f6]" />
        ) : null}
        <Switch
          checked={enabled}
          disabled={!canManage || saving}
          onCheckedChange={(value) => setDialog(value ? "enable" : "disable")}
          aria-label={AUTOMATION_TOGGLE_LABEL}
          className="shrink-0"
        />
      </div>

      <ConfirmDialog
        open={dialog === "enable"}
        onClose={() => setDialog(null)}
        onConfirm={() => apply(true)}
        variant="info"
        title="Включить автоматизацию гигиенического журнала?"
        bullets={bullets}
        confirmLabel="Включить"
        cancelLabel="Не сейчас"
      />

      <ConfirmDialog
        open={dialog === "disable"}
        onClose={() => setDialog(null)}
        onConfirm={() => apply(false)}
        variant="warn"
        title="Выключить автоматизацию?"
        description="Журналы перестанут создаваться и заполняться сами. Уже заполненное останется."
        confirmLabel="Выключить"
        cancelLabel="Оставить как есть"
      />

      <ConfirmDialog
        open={dialog === "info"}
        onClose={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
        variant="info"
        title="Как работает автоматика журнала"
        bullets={bullets}
        confirmLabel="Понятно"
        cancelLabel="Закрыть"
      />

      <ConfirmDialog
        open={dialog === "notice"}
        onClose={() => setDialog(null)}
        onConfirm={() => setDialog(null)}
        variant="info"
        title="Гигиенический журнал теперь ведётся сам"
        description={
          canManage ? (
            <span>
              Ничего делать не нужно. Если хотите вести журнал вручную —{" "}
              <button
                type="button"
                onClick={() => apply(false)}
                className="font-medium text-[#5566f6] underline underline-offset-2 transition-colors duration-150 hover:text-[#4a5bf0]"
              >
                выключить автоматику
              </button>
              .
            </span>
          ) : (
            "Ничего делать не нужно — журнал заполняется сам."
          )
        }
        bullets={bullets}
        confirmLabel="Понятно"
        cancelLabel="Закрыть"
      />
    </>
  );
}
