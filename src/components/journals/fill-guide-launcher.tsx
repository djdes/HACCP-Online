"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { MousePointerClick } from "lucide-react";
import { toast } from "sonner";
import { ACTIVE_JOURNAL_CATALOG } from "@/lib/journal-catalog";
import { getJournalDocGuide } from "@/lib/journal-doc-guides";
import {
  getJournalWalkthrough,
  visibleWalkthroughSteps,
  type WalkthroughPage,
  type WalkthroughStep,
} from "@/lib/journal-ui-walkthroughs";
import { useSeenNotice } from "@/lib/use-seen-notice";
import { FillGuideDialog } from "@/components/journals/fill-guide-dialog";
import { JournalGuideFab } from "@/components/journals/journal-guide-fab";
import {
  SpotlightTour,
  findTourTarget,
  useIsNarrowViewport,
  waitForTourTarget,
  type SpotlightStep,
} from "@/components/ui/spotlight-tour";

/**
 * Вход в «Как заполнить?»: кнопка (список журнала) или круглая кнопка
 * (документ) + окно + спотлайт-тур. Один компонент на сайт и Mini App
 * (П-3), различаются только пути (`basePath`).
 *
 * Поведение:
 * - Первый заход человека в журнал — окно открывается само один раз
 *   (флаг `fill-guide:<code>` в аккаунте, общий для списка и документа).
 * - `?tour=<stepId>` в URL — сразу тур с этого шага (так окно «перебрасывает»
 *   между списком и документом); параметр стирается без навигации.
 * - Шаг другой страницы → переход: список → первый активный документ,
 *   документ → список.
 *
 * Рендерится только у журналов с walkthrough — иначе null.
 */
const GHOST_BUTTON_CLASS =
  "inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border-0 bg-[#5566f6]/[0.04] px-3.5 text-[14px] font-semibold text-[#5566f6] transition-colors hover:bg-[#5566f6]/[0.09] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 sm:w-auto";

export function FillGuideLauncher({
  code,
  journalName,
  page,
  variant,
  basePath = "site",
  firstDocumentId,
  bottomOffset = 72,
  className,
  style,
}: {
  code: string;
  /** Название журнала в шапке окна; по умолчанию — из каталога. */
  journalName?: string;
  page: WalkthroughPage;
  variant: "button" | "fab";
  basePath?: "site" | "mini";
  /** Со списка: куда вести шаги «внутри документа». */
  firstDocumentId?: string;
  /** Для `fab`: отступ снизу (над стопкой других плавающих кнопок). */
  bottomOffset?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const narrow = useIsNarrowViewport();
  const steps = getJournalWalkthrough(code);
  const guide = getJournalDocGuide(code);
  const name =
    journalName ??
    ACTIVE_JOURNAL_CATALOG.find((item) => item.code === code)?.name ??
    "Журнал";

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tour, setTour] = useState<{ startId?: string } | null>(null);
  const { seen, markSeen } = useSeenNotice(steps ? `fill-guide:${code}` : null);

  const visible = useMemo(
    () => (steps ? visibleWalkthroughSteps(steps, { isMobile: narrow }) : []),
    [steps, narrow]
  );
  const tourSteps = useMemo<SpotlightStep[]>(
    () =>
      visible
        .filter((step) => step.page === page && step.anchor)
        .map((step) => ({
          id: step.id,
          anchor: step.anchor!,
          fallbackAnchor: step.fallbackAnchor,
          title: step.title,
          body: step.body,
        })),
    [visible, page]
  );

  const listPath = basePath === "mini" ? `/mini/journals/${code}` : `/journals/${code}`;
  const documentPath = (id: string) =>
    basePath === "mini" ? `/mini/documents/${id}` : `/journals/${code}/documents/${id}`;

  const startTour = useCallback(
    async (stepId?: string) => {
      const probe = tourSteps.find((s) => s.id === stepId) ?? tourSteps[0];
      if (!probe) return;
      await waitForTourTarget(probe.anchor, probe.fallbackAnchor);
      const present = tourSteps.some((s) => findTourTarget(s.anchor, s.fallbackAnchor));
      if (!present) {
        toast.info("На этой странице пока нечего показать — сначала создайте документ.");
        return;
      }
      setDialogOpen(false);
      setTour({ startId: stepId });
    },
    [tourSteps]
  );
  const startTourRef = useRef(startTour);
  startTourRef.current = startTour;

  // `?tour=<stepId>` — стартуем тур и убираем параметр без навигации
  // (router.replace на dynamic-страницах — лишний серверный round-trip;
  // `?tab=` и state роутера сохраняем).
  useEffect(() => {
    if (!steps) return;
    const url = new URL(window.location.href);
    const requested = url.searchParams.get("tour");
    if (!requested) return;
    url.searchParams.delete("tour");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash
    );
    markSeen();
    void startTourRef.current(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Автооткрытие один раз: отметку ставим сразу при открытии — даже если
  // человек уйдёт со страницы, не закрыв окно, второй раз оно не всплывёт.
  const autoOpened = useRef(false);
  useEffect(() => {
    if (seen !== false || autoOpened.current) return;
    autoOpened.current = true;
    markSeen();
    setDialogOpen(true);
  }, [seen, markSeen]);

  if (!steps) return null;

  function showStepHint(step: WalkthroughStep): string | null {
    if (step.page === "document" && page === "list" && !firstDocumentId) {
      return "Сначала создайте документ";
    }
    return null;
  }

  function showStep(step: WalkthroughStep) {
    if (step.page === page) {
      void startTour(step.id);
      return;
    }
    if (step.page === "document") {
      if (!firstDocumentId) return;
      router.push(`${documentPath(firstDocumentId)}?tour=${encodeURIComponent(step.id)}`);
      return;
    }
    router.push(`${listPath}?tour=${encodeURIComponent(step.id)}`);
  }

  const trigger =
    variant === "fab" ? (
      mounted ? (
        <JournalGuideFab
          onClick={() => setDialogOpen(true)}
          label="Как заполнить?"
          ariaLabel="Как заполнить этот журнал"
          bottomOffset={bottomOffset}
        />
      ) : null
    ) : (
      <button
        type="button"
        onClick={() => setDialogOpen(true)}
        className={className ?? GHOST_BUTTON_CLASS}
        style={style}
      >
        <MousePointerClick className="size-4" />
        Как заполнить?
      </button>
    );

  return (
    <>
      {trigger}
      {mounted ? (
        <FillGuideDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          journalName={name}
          steps={visible}
          page={page}
          guide={guide}
          guideHref={basePath === "site" ? `/journals/${code}/guide` : undefined}
          tourAvailable={tourSteps.length > 0}
          onShowStep={showStep}
          showStepHint={showStepHint}
          onStartTour={() => void startTour()}
        />
      ) : null}
      {tour ? (
        <SpotlightTour
          steps={tourSteps}
          startStepId={tour.startId}
          onClose={() => setTour(null)}
        />
      ) : null}
    </>
  );
}
