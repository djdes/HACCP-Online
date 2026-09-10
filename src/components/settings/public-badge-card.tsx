"use client";

import { BadgeCheck, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type BadgeState = {
  enabled: boolean;
  code: string | null;
  publicUrl: string | null;
  imageUrl: string | null;
  embedHtml: string | null;
  percent: number | null;
};

const CARD = "rounded-3xl border border-[#ececf4] bg-white p-6 shadow-[0_0_0_1px_rgba(240,240,250,0.45)] md:p-7";
const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_30px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0] disabled:opacity-60";
const SECONDARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-4 text-[14px] font-medium text-[#0b1024] transition-colors hover:border-[#5566f6]/40 hover:bg-[#f5f6ff] disabled:opacity-60";

/** Публичный бейдж: включить, вставить на сайт, перевыпустить код, выключить. */
export function PublicBadgeCard({ initial }: { initial: BadgeState }) {
  const [state, setState] = useState<BadgeState>(initial);
  const [busy, setBusy] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);

  async function call(method: "PATCH" | "POST", body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch("/api/settings/badge", {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as (BadgeState & { error?: string }) | null;
      if (!response.ok || !data) throw new Error(data?.error ?? "Не удалось сохранить");
      setState(data);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Ошибка");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} — скопировано`);
    } catch {
      toast.error("Не удалось скопировать — выделите текст вручную");
    }
  }

  return (
    <section id="badge" className={CARD}>
      <div className="flex items-center gap-2 text-[15px] font-semibold text-[#0b1024]">
        <BadgeCheck className="size-4 text-[#5566f6]" />
        Публичный бейдж «Журналы ведутся в WeSetup»
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6f7282]">
        Картинка для сайта, меню или страницы в соцсетях: посетитель видит, что производственный контроль ведётся в электронном виде,
        и долю заполненных журналов за 30 дней. Без имён сотрудников и содержимого записей. Выключить можно в любой момент.
      </p>

      {state.enabled && state.code && state.imageUrl && state.publicUrl && state.embedHtml ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#ececf4] bg-[#fafbff] px-4 py-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- живой SVG с сервера, как его увидят снаружи */}
            <img src={`${state.imageUrl}?v=${state.code}`} alt="Бейдж WeSetup" height={22} data-testid="badge-preview" />
            <a href={state.publicUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#3848c7] underline-offset-2 hover:underline" data-testid="badge-public-link">
              Открыть публичную страницу
              <ExternalLink className="size-3.5" />
            </a>
            {state.percent !== null ? <span className="ml-auto text-[12.5px] text-[#6f7282]">Сейчас: {state.percent}% за 30 дней</span> : null}
          </div>
          <div>
            <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">Код для вставки на сайт</div>
            <textarea
              readOnly
              value={state.embedHtml}
              rows={3}
              data-testid="badge-embed"
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-2xl border border-[#dcdfed] bg-[#fafbff] px-4 py-3 font-mono text-[12px] text-[#0b1024] focus:border-[#5566f6] focus:outline-none focus:ring-4 focus:ring-[#5566f6]/15"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy(state.embedHtml ?? "", "HTML-код")} className={PRIMARY}>
              <Copy className="size-4" />
              Скопировать код
            </button>
            <button type="button" onClick={() => void copy(state.publicUrl ?? "", "Ссылка")} className={SECONDARY}>
              <Copy className="size-4 text-[#5566f6]" />
              Скопировать ссылку
            </button>
            <button type="button" onClick={() => setRotateOpen(true)} disabled={busy} className={SECONDARY}>
              <RefreshCw className="size-4 text-[#5566f6]" />
              Перевыпустить
            </button>
            <button type="button" onClick={() => setDisableOpen(true)} disabled={busy} className={`${SECONDARY} text-[#a13a32]`}>
              Выключить
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <button type="button" onClick={() => void call("PATCH", { enabled: true })} disabled={busy} className={PRIMARY}>
            <BadgeCheck className="size-4" />
            {busy ? "Включаем…" : "Включить бейдж"}
          </button>
          <p className="mt-2 text-[12.5px] text-[#9b9fb3]">Появится ссылка на публичную страницу и HTML-код картинки. Бейдж на вашем сайте или в меню — это ещё и ссылка на вашу публичную страницу: гости видят статус, а поисковики — что заведение ведёт контроль.</p>
        </div>
      )}

      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        variant="warn"
        title="Перевыпустить код бейджа?"
        description="Старая ссылка и старый HTML-код перестанут работать — картинку на сайте нужно будет заменить."
        bullets={[{ label: "Новый код появится сразу" }, { label: "Старые вставки покажут «нет данных»" }]}
        confirmLabel="Перевыпустить"
        onConfirm={async () => {
          if (await call("POST")) toast.success("Код перевыпущен");
          setRotateOpen(false);
        }}
        confirmDisabled={busy}
      />
      <ConfirmDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        variant="danger"
        title="Выключить бейдж?"
        description="Публичная страница и картинка перестанут открываться. Включить снова можно в любой момент — код сохранится."
        confirmLabel="Выключить"
        onConfirm={async () => {
          if (await call("PATCH", { enabled: false })) toast.success("Бейдж выключен");
          setDisableOpen(false);
        }}
        confirmDisabled={busy}
      />
    </section>
  );
}
