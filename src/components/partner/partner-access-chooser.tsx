"use client";

import { useState } from "react";
import { ArrowRight, Eye, PencilLine } from "lucide-react";

import { PARTNER_ACCESS_LEVEL_LABELS, type PartnerAccessLevel } from "@/lib/partners/access-guard";
import { cn } from "@/lib/utils";

/**
 * Выбор уровня доступа консультанта на странице `/p/<slug>` и кнопки
 * «Зарегистрировать компанию» / «Войти». Уровень уезжает в cookie через
 * `/p/<slug>/start` — после регистрации организация привяжется с ним.
 * По умолчанию — только просмотр: безопасный вариант без настройки.
 */
export function PartnerAccessChooser({ slug, brandName }: { slug: string; brandName: string }) {
  const [level, setLevel] = useState<PartnerAccessLevel>("view");
  const start = (to: "register" | "login") => `/p/${encodeURIComponent(slug)}/start?level=${level}&to=${to}`;

  const options: { value: PartnerAccessLevel; icon: typeof Eye; hint: string }[] = [
    { value: "view", icon: Eye, hint: "Консультант видит журналы, отчёты и просрочки. Записи вносите вы." },
    { value: "edit", icon: PencilLine, hint: `${brandName} сможет заполнять журналы и настраивать их за вас.` },
  ];

  return (
    <div className="mt-7">
      <div className="text-[13px] font-medium text-[#3c4053]">Какой доступ дать консультанту {brandName}?</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Уровень доступа консультанта">
        {options.map((opt) => {
          const active = level === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLevel(opt.value)}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors duration-150",
                active
                  ? "border-[var(--partner-accent)] bg-[#f5f6ff] ring-4 ring-[var(--partner-accent)]/10"
                  : "border-[#dcdfed] bg-white hover:border-[var(--partner-accent)]/40 hover:bg-[#fafbff]",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl",
                  active ? "text-white" : "bg-[#eef1ff] text-[#3848c7]",
                )}
                style={active ? { backgroundColor: "var(--partner-accent)" } : undefined}
              >
                <opt.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-[#0b1024]">
                  {PARTNER_ACCESS_LEVEL_LABELS[opt.value]}
                  {opt.value === "view" ? <span className="ml-1.5 text-[12px] font-normal text-[#6f7282]">по умолчанию</span> : null}
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.5] text-[#6f7282]">{opt.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <a
          href={start("register")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-medium text-white shadow-[0_12px_36px_-12px_rgba(11,16,36,0.35)] transition-colors"
          style={{ backgroundColor: "var(--partner-accent)" }}
        >
          Зарегистрировать компанию
          <ArrowRight className="size-4" />
        </a>
        <a
          href={start("login")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#dcdfed] bg-white px-5 text-[15px] font-medium text-[#0b1024] transition-colors hover:border-[var(--partner-accent)]/40 hover:bg-[#f5f6ff]"
        >
          У меня уже есть аккаунт
        </a>
      </div>
      <p className="mt-2.5 text-center text-[12px] text-[#6f7282]">
        Бесплатно, без карты. Аккаунт создадим за минуту.
      </p>
    </div>
  );
}
