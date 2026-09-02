"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Save } from "lucide-react";
import { toast } from "sonner";
import type { BrandingSettings } from "@/lib/partners/branding-admin";
import { DEFAULT_ACCENT, PLATFORM_BADGE_TEXT, checkAccent, darkenHex } from "@/lib/partners/validation";
import { LogoUploader } from "@/components/partner/logo-uploader";
import { Field, btnPrimary, inputClass, readError, textareaClass } from "@/components/partner/ui";
import { cn } from "@/lib/utils";

type Props = {
  initial: BrandingSettings;
  /** Онбординг: только имя, логотип и контакты — без PDF/приветствия. */
  compact?: boolean;
  onSaved?: (settings: BrandingSettings) => void;
};

/**
 * Форма брендинга партнёра. Акцент проверяется на лету тем же
 * `checkAccent`, что и на сервере: при провале WCAG AA показываем
 * предупреждение и предпросмотр со стандартным индиго — ровно то, что
 * увидят клиенты.
 */
export function BrandingForm({ initial, compact = false, onSaved }: Props) {
  const [form, setForm] = useState({
    brandName: initial.brandName,
    accentColor: initial.accentColor,
    supportPhone: initial.supportPhone,
    supportTelegram: initial.supportTelegram,
    supportEmail: initial.supportEmail,
    pdfSignature: initial.pdfSignature,
    loginGreeting: initial.loginGreeting,
  });
  const [logoLightUrl, setLogoLightUrl] = useState(initial.logoLightUrl);
  const [logoDarkUrl, setLogoDarkUrl] = useState(initial.logoDarkUrl);
  const [saving, setSaving] = useState(false);
  const limits = initial.limits;

  const accent = useMemo(() => (form.accentColor.trim() ? checkAccent(form.accentColor) : null), [form.accentColor]);
  const previewAccent = accent?.ok ? accent.effective : DEFAULT_ACCENT;

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/partner/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await readError(res, "Не удалось сохранить брендинг"));
      const data = (await res.json()) as { accentWarning: string | null; settings: BrandingSettings };
      toast.success("Брендинг сохранён — клиенты увидят изменения в течение 5 минут");
      if (data.accentWarning) toast.warning(data.accentWarning);
      onSaved?.(data.settings);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить брендинг");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Название бренда"
          hint={`Показывается клиентам вместо названия компании. ${form.brandName.length}/${limits.brandName}`}
          className="md:col-span-2"
        >
          <input
            className={inputClass}
            value={form.brandName}
            maxLength={limits.brandName}
            required
            onChange={(e) => set("brandName", e.target.value)}
            placeholder="Например, «СанПиН Консалт»"
          />
        </Field>

        <LogoUploader
          variant="light"
          url={logoLightUrl}
          onChange={setLogoLightUrl}
          title="Логотип для светлой темы"
          hint="Основной. Шапка кабинета клиента, страница входа, письма."
        />
        <LogoUploader
          variant="dark"
          url={logoDarkUrl}
          onChange={setLogoDarkUrl}
          title="Логотип для тёмной темы"
          hint="Необязательно. Если не загружен — используется светлый."
        />

        <Field label="Телефон консультанта" hint="Показывается в блоке «Ваш консультант»">
          <input
            className={inputClass}
            value={form.supportPhone}
            onChange={(e) => set("supportPhone", e.target.value)}
            placeholder="+7 900 000-00-00"
            inputMode="tel"
          />
        </Field>
        <Field label="Telegram консультанта" hint="Ник или ссылка t.me">
          <input
            className={inputClass}
            value={form.supportTelegram}
            onChange={(e) => set("supportTelegram", e.target.value)}
            placeholder="@consultant"
          />
        </Field>
        <Field label="Почта консультанта" className={compact ? "md:col-span-2" : undefined}>
          <input
            className={inputClass}
            type="email"
            value={form.supportEmail}
            onChange={(e) => set("supportEmail", e.target.value)}
            placeholder="help@partner.ru"
          />
        </Field>

        {!compact ? (
          <>
            <Field
              label="Акцентный цвет"
              hint="HEX. Красит кнопки и активные элементы в кабинете клиента. Должен проходить WCAG AA — иначе останется стандартный."
            >
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Выбрать цвет"
                  className="h-11 w-14 shrink-0 cursor-pointer rounded-2xl border border-[#dcdfed] bg-white p-1"
                  value={accent?.hex ?? DEFAULT_ACCENT}
                  onChange={(e) => set("accentColor", e.target.value)}
                />
                <input
                  className={cn(inputClass, "font-mono uppercase")}
                  value={form.accentColor}
                  onChange={(e) => set("accentColor", e.target.value)}
                  placeholder={DEFAULT_ACCENT}
                  maxLength={7}
                />
              </div>
              {accent ? (
                <span
                  className={cn(
                    "mt-2 flex items-start gap-1.5 text-[12px] leading-[1.5]",
                    accent.ok ? "text-[#116b2a]" : "text-[#a13a32]",
                  )}
                >
                  {accent.ok ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
                  {accent.ok
                    ? `Контраст ${accent.onWhite}:1 к белому, ${accent.onDark}:1 к тёмному — подходит`
                    : accent.warning}
                </span>
              ) : null}
            </Field>

            <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6f7282]">Предпросмотр</div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex h-10 items-center rounded-2xl px-4 text-[14px] font-medium text-white"
                  style={{ backgroundColor: previewAccent }}
                >
                  Заполнить журнал
                </span>
                <span
                  className="inline-flex h-10 items-center rounded-2xl border bg-white px-4 text-[14px] font-medium"
                  style={{ borderColor: previewAccent, color: darkenHex(previewAccent, 0.2) }}
                >
                  Вторичная кнопка
                </span>
                <span className="text-[13px] font-medium" style={{ color: previewAccent }}>
                  Активная ссылка
                </span>
              </div>
              <p className="mt-3 text-[12px] text-[#9b9fb3]">
                {accent && !accent.ok ? "Показан стандартный цвет: введённый не прошёл проверку контраста." : "Так будут выглядеть кнопки в кабинете клиента."}
              </p>
            </div>

            <Field
              label="Подпись в PDF"
              hint={`Печатается в нижнем колонтитуле каждой страницы журналов клиента. ${form.pdfSignature.length}/${limits.pdfSignature}`}
              className="md:col-span-2"
            >
              <input
                className={inputClass}
                value={form.pdfSignature}
                maxLength={limits.pdfSignature}
                onChange={(e) => set("pdfSignature", e.target.value)}
                placeholder="Сопровождение: СанПиН Консалт, +7 900 000-00-00"
              />
            </Field>

            <Field
              label="Приветствие на странице входа"
              hint={`Показывается на вашей странице /p/<slug> над кнопками регистрации. ${form.loginGreeting.length}/${limits.loginGreeting}`}
              className="md:col-span-2"
            >
              <textarea
                className={textareaClass}
                rows={3}
                value={form.loginGreeting}
                maxLength={limits.loginGreeting}
                onChange={(e) => set("loginGreeting", e.target.value)}
                placeholder="Добро пожаловать! Мы поможем настроить электронные журналы за один день."
              />
            </Field>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ececf4] pt-4">
        <p className="text-[12px] text-[#6f7282]">
          Подпись «{PLATFORM_BADGE_TEXT}» остаётся у клиентов всегда — её нельзя убрать.
        </p>
        <button type="submit" className={btnPrimary} disabled={saving}>
          <Save className="size-4" />
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
