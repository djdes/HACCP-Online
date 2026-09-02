"use client";

import { useState } from "react";
import { CalendarPlus, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  JournalAutomationEnableDialog,
  type AutomationChoice,
} from "@/components/journals/journal-automation-enable-dialog";

/**
 * Автоматика журнала: два переключателя над списком документов.
 *
 *   1. «Создавать журнал на новый период автоматически» — в начале
 *      периода заводится новый документ со строками и ответственными.
 *   2. «Заполнять журнал ежедневно автоматически» — отметки, показатели
 *      и подписи проставляются сами (только там, где движок это умеет).
 *
 * Стоит в самом журнале, а не только в настройках организации: решение
 * «пусть ведётся само» человек принимает ровно тогда, когда впервые
 * заводит документ руками и понимает, что через месяц придётся снова.
 * Идти за этим в `/settings/auto-journals` он не догадается.
 *
 * Состояние приходит пропсами со страницы (журнал и так грузит
 * `journalAutomationJson`): раньше компонент спрашивал его сам и
 * переключатель на секунду показывал «выключено» на включённом журнале.
 *
 * Включение идёт через модалку: она показывает реальные периоды и
 * фамилии и даёт выбрать ответственных и состав строк. Свитч
 * переключается только после успешного сохранения — иначе оптимизм
 * врал бы при отменённой модалке.
 */
export function JournalAutoCreateToggle({
  templateCode,
  initialAutoCreate,
  initialAutoFill,
  autofillSupported,
  disabled = false,
}: {
  templateCode: string;
  initialAutoCreate: boolean;
  initialAutoFill: boolean;
  /** Умеет ли движок заполнять этот журнал — второй ряд иначе не нужен. */
  autofillSupported: boolean;
  disabled?: boolean;
}) {
  const [autoCreate, setAutoCreate] = useState(initialAutoCreate);
  const [autoFill, setAutoFill] = useState(initialAutoFill);
  const [busy, setBusy] = useState<"create" | "fill" | null>(null);
  const [dialog, setDialog] = useState<"auto-create" | "auto-fill" | null>(null);
  const [disableConfirm, setDisableConfirm] = useState(false);

  async function save(body: Record<string, unknown>): Promise<void> {
    // Эндпоинт СЛИВАЕТ переданные пункты с сохранённой картой, а не
    // заменяет её — поэтому одного пункта достаточно, остальные журналы
    // не пострадают.
    const res = await fetch("/api/organizations/auto-journals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ code: templateCode, ...body }] }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Не удалось сохранить");
    }
  }

  async function enableAutoCreate(choice: AutomationChoice) {
    setBusy("create");
    try {
      await save({
        autoCreate: true,
        responsibles: choice.responsibles,
        ...(choice.staff ? { staff: choice.staff } : {}),
      });
      setAutoCreate(true);
      setDialog(null);
      toast.success("Документ на новый период будет создаваться сам");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить",
      );
      throw error;
    } finally {
      setBusy(null);
    }
  }

  async function enableAutoFill(choice: AutomationChoice) {
    setBusy("fill");
    try {
      // Автозаполнять можно только существующий документ, поэтому
      // автосоздание включается заодно — модалка об этом предупреждает.
      await save({
        autoCreate: true,
        autoFill: true,
        responsibles: choice.responsibles,
        ...(choice.staff ? { staff: choice.staff } : {}),
      });
      setAutoCreate(true);
      setAutoFill(true);
      setDialog(null);

      // Догоняем уже начатый период: без этого человек включает тумблер
      // и до утра не видит ни одной заполненной ячейки.
      try {
        const res = await fetch("/api/organizations/auto-journals/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: templateCode }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "backfill failed");
        const filled = Number(data?.created ?? 0) + Number(data?.updated ?? 0);
        toast.success(
          filled > 0
            ? `Журнал будет вестись сам · Заполнено: ${filled}`
            : "Журнал будет вестись сам",
        );
      } catch {
        toast.success("Журнал будет вестись сам · остальное крон догонит ночью");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить",
      );
      throw error;
    } finally {
      setBusy(null);
    }
  }

  async function disableAutoCreate(alsoAutoFill: boolean) {
    setBusy("create");
    const previousCreate = autoCreate;
    const previousFill = autoFill;
    setAutoCreate(false);
    if (alsoAutoFill) setAutoFill(false);
    try {
      await save({
        autoCreate: false,
        ...(alsoAutoFill ? { autoFill: false } : {}),
      });
      setDisableConfirm(false);
      toast.success(
        alsoAutoFill
          ? "Автосоздание и автозаполнение выключены"
          : "Автосоздание выключено",
      );
    } catch (error) {
      setAutoCreate(previousCreate);
      setAutoFill(previousFill);
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить",
      );
      throw error;
    } finally {
      setBusy(null);
    }
  }

  async function disableAutoFill() {
    setBusy("fill");
    const previous = autoFill;
    setAutoFill(false);
    try {
      await save({ autoCreate, autoFill: false });
      toast.success("Автозаполнение выключено");
    } catch (error) {
      setAutoFill(previous);
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить",
      );
    } finally {
      setBusy(null);
    }
  }

  function onAutoCreateChange(next: boolean) {
    if (next) {
      setDialog("auto-create");
      return;
    }
    // Выключение автосоздания при живом автозаполнении гасит и его:
    // заполнять станет нечего, и молча это делать нельзя.
    if (autoFill) {
      setDisableConfirm(true);
      return;
    }
    void disableAutoCreate(false);
  }

  function onAutoFillChange(next: boolean) {
    if (next) {
      setDialog("auto-fill");
      return;
    }
    void disableAutoFill();
  }

  return (
    <>
      <div className="divide-y divide-white/70 rounded-2xl bg-[#f5f6ff] print:hidden">
        <label className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#5566f6]">
            {busy === "create" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarPlus className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-[#0b1024]">
              Создавать журнал на новый период автоматически
            </span>
            <span className="block text-[12px] leading-snug text-[#6f7282]">
              В начале периода заведётся новый документ со строками и
              ответственными — как продолжение последнего.
            </span>
          </span>
          <Switch
            checked={autoCreate}
            onCheckedChange={(value) => onAutoCreateChange(value)}
            disabled={disabled || busy !== null}
          />
        </label>

        {autofillSupported ? (
          <label className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-[#5566f6]">
              {busy === "fill" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-[#0b1024]">
                Заполнять журнал ежедневно автоматически
              </span>
              <span className="block text-[12px] leading-snug text-[#6f7282]">
                Отметки, показатели и подписи проставятся сами — на основе
                последнего журнала, с использованием ИИ, чтобы данные были
                реалистичными. За вами — проверка и корректировка.
              </span>
            </span>
            <Switch
              checked={autoFill}
              onCheckedChange={(value) => onAutoFillChange(value)}
              disabled={disabled || busy !== null}
            />
          </label>
        ) : null}
      </div>

      <JournalAutomationEnableDialog
        open={dialog !== null}
        mode={dialog ?? "auto-create"}
        templateCode={templateCode}
        autoCreateEnabled={autoCreate}
        onClose={() => setDialog(null)}
        onConfirm={dialog === "auto-fill" ? enableAutoFill : enableAutoCreate}
      />

      <ConfirmDialog
        open={disableConfirm}
        onClose={() => setDisableConfirm(false)}
        onConfirm={() => disableAutoCreate(true)}
        variant="warn"
        title="Выключить автосоздание?"
        description="Вместе с ним выключится и ежедневное автозаполнение: заполнять будет нечего, пока новый документ не заведут вручную."
        bullets={[
          { label: "Уже созданные документы останутся на месте", tone: "info" },
          {
            label: "Новый период придётся заводить кнопкой «Создать документ»",
            tone: "warn",
          },
        ]}
        confirmLabel="Выключить оба"
        cancelLabel="Оставить как есть"
      />
    </>
  );
}
