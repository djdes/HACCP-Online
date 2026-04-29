"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Lightbulb,
  ListChecks,
  Package,
  Sparkles,
  Users,
  X,
  XCircle,
} from "lucide-react";
import {
  getJournalDocGuide,
  type JournalDocGuide,
} from "@/lib/journal-doc-guides";
import { resolveJournalCodeAlias } from "@/lib/source-journal-map";

/**
 * Inline floating-кнопка «Как заполнять» + sheet с подробным гайдом
 * для текущего журнала. Монтируется в layout документа, читает code
 * из URL — поэтому добавлять её в каждый document-client не нужно.
 *
 * Если у журнала нет гайда — кнопка не рендерится (тихо).
 */
export function JournalDocGuideOverlay() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Detect /journals/<code>/documents/... and extract code.
  const code = useMemo(() => {
    const m = /^\/journals\/([^/]+)\/documents\/[^/]+/.exec(pathname ?? "");
    if (!m) return null;
    return resolveJournalCodeAlias(decodeURIComponent(m[1]));
  }, [pathname]);

  const guide = useMemo(
    () => (code ? getJournalDocGuide(code) : null),
    [code]
  );

  // Lock body scroll when sheet is open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Close on Esc.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!code || !guide) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-[#ececf4] bg-white px-4 text-[14px] font-medium text-[#0b1024] shadow-[0_12px_30px_-10px_rgba(11,16,36,0.25)] transition-all hover:scale-105 hover:border-[#5566f6]/40 hover:text-[#5566f6]"
        aria-label="Как заполнять этот журнал"
        title="Как заполнять этот журнал"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-[#5566f6] to-[#7a5cff] text-white">
          <BookOpen className="size-4" />
        </span>
        Как заполнять
      </button>

      {open ? <GuideSheet guide={guide} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function GuideSheet({
  guide,
  onClose,
}: {
  guide: JournalDocGuide;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Инструкция по заполнению"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#0b1024]/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet — slides from right on desktop, full-screen on mobile */}
      <div className="ml-auto flex h-full w-full max-w-[640px] flex-col bg-white shadow-[0_0_60px_-10px_rgba(11,16,36,0.4)] sm:rounded-l-3xl">
        {/* Hero header */}
        <div className="relative overflow-hidden bg-[#0b1024] text-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-24 size-[280px] rounded-full bg-[#5566f6] opacity-50 blur-[100px]" />
            <div className="absolute -right-20 -bottom-20 size-[260px] rounded-full bg-[#7a5cff] opacity-40 blur-[100px]" />
          </div>
          <div className="relative z-10 flex items-start justify-between gap-3 p-5 sm:p-7">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                <BookOpen className="size-5" />
              </span>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/60">
                  Инструкция по заполнению
                </div>
                <h2 className="mt-1 text-[20px] font-semibold leading-tight tracking-[-0.01em]">
                  Как заполнять этот журнал
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Закрыть"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-7">
            {/* Intro */}
            <p className="text-[14px] leading-[1.7] text-[#3c4053]">
              {guide.intro}
            </p>

            {/* Meta block: who + when */}
            <div className="grid gap-3 sm:grid-cols-2">
              <MetaCard
                icon={<Users className="size-4" />}
                label="Кто заполняет"
                value={guide.whoFills}
              />
              <MetaCard
                icon={<Clock className="size-4" />}
                label="Когда"
                value={guide.whenToFill}
              />
            </div>

            {/* Prepare */}
            {guide.prepare && guide.prepare.length > 0 ? (
              <Section
                title="Что подготовить"
                icon={<Package className="size-4" />}
                tone="info"
              >
                <ul className="space-y-1.5">
                  {guide.prepare.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13px] leading-[1.55] text-[#3c4053]"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#5566f6]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* Steps */}
            <Section
              title="Пошаговая инструкция"
              icon={<ListChecks className="size-4" />}
              tone="primary"
            >
              <ol className="space-y-3">
                {guide.steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-2xl border border-[#ececf4] bg-white p-3.5"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5566f6] to-[#7a5cff] text-[12px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-semibold leading-tight text-[#0b1024]">
                        {step.title}
                      </div>
                      <p className="mt-1 text-[13px] leading-[1.6] text-[#3c4053]">
                        {step.body}
                      </p>
                      {step.tip ? (
                        <div className="mt-2 flex items-start gap-2 rounded-xl bg-[#fff8eb] px-3 py-2">
                          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-[#a13a32]" />
                          <span className="text-[12px] leading-[1.55] text-[#7a4a00]">
                            {step.tip}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            {/* Examples */}
            {guide.examples && guide.examples.length > 0 ? (
              <Section
                title="Примеры заполнения"
                icon={<Sparkles className="size-4" />}
                tone="success"
              >
                <div className="space-y-2">
                  {guide.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#c8f0d5] bg-[#ecfdf5]/50 px-3 py-2.5"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#136b2a]">
                        {ex.label}
                      </div>
                      <div className="mt-1 text-[13px] leading-[1.55] text-[#0b1024]">
                        {ex.value}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {/* Common mistakes */}
            {guide.mistakes && guide.mistakes.length > 0 ? (
              <Section
                title="Типичные ошибки"
                icon={<XCircle className="size-4" />}
                tone="warn"
              >
                <ul className="space-y-1.5">
                  {guide.mistakes.map((m, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13px] leading-[1.55] text-[#3c4053]"
                    >
                      <span className="mt-0.5 inline-flex size-1.5 shrink-0 rounded-full bg-[#a13a32]" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* Red flags */}
            {guide.redFlags && guide.redFlags.length > 0 ? (
              <Section
                title="Что делать если что-то не так"
                icon={<AlertTriangle className="size-4" />}
                tone="warn"
              >
                <div className="space-y-2">
                  {guide.redFlags.map((rf, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-[#ffd2cd] bg-[#fff4f2] p-3"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#a13a32]" />
                        <div className="text-[13px] font-semibold text-[#a13a32]">
                          {rf.trigger}
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-start gap-2 pl-5">
                        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-[#3c4053]" />
                        <div className="text-[13px] leading-[1.55] text-[#3c4053]">
                          {rf.action}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            ) : null}

            {/* Legal ref */}
            {guide.legalRef ? (
              <div className="flex items-start gap-2 rounded-xl border border-[#ececf4] bg-[#fafbff] px-3 py-2.5">
                <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-[#6f7282]" />
                <div className="text-[12px] leading-[1.55] text-[#6f7282]">
                  <span className="font-semibold text-[#3c4053]">Норматив:</span>{" "}
                  {guide.legalRef}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#ececf4] bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#5566f6] px-5 text-[14px] font-medium text-white shadow-[0_10px_26px_-12px_rgba(85,102,246,0.55)] transition-colors hover:bg-[#4a5bf0]"
          >
            Понятно, поехали
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#ececf4] bg-[#fafbff] p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[#6f7282]">
        <span className="text-[#5566f6]">{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-[13px] leading-[1.55] text-[#0b1024]">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "info" | "primary" | "success" | "warn";
  children: React.ReactNode;
}) {
  const accent =
    tone === "primary"
      ? "text-[#5566f6]"
      : tone === "success"
        ? "text-[#136b2a]"
        : tone === "warn"
          ? "text-[#a13a32]"
          : "text-[#3848c7]";
  return (
    <section>
      <div
        className={`mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] ${accent}`}
      >
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}
