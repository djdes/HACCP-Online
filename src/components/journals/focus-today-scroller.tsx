"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Small client-only component dropped into each document editor that
 * supports "jump to today" from the list-page banner. When the URL
 * carries `?focus=today`, this waits for the target to appear in the
 * DOM, scrolls it into view, and applies a brief highlight pulse so
 * the user immediately sees which row to fill.
 *
 * Each client passes a CSS selector (e.g. `[data-focus-today]`). The
 * editor is responsible for tagging today's row/column with that data
 * attribute — this component doesn't know about per-journal markup.
 */
export function FocusTodayScroller({
  selector = "[data-focus-today]",
}: {
  selector?: string;
}) {
  const searchParams = useSearchParams();
  const focus = searchParams.get("focus");

  useEffect(() => {
    if (focus !== "today") return;
    // Give the editor a tick to paint before we scroll. Waiting for the
    // selector handles async data loads too (e.g. entries fetched on
    // mount before the table renders).
    let attempts = 0;
    const maxAttempts = 30; // ~3s at 100ms intervals
    const interval = window.setInterval(() => {
      const el = document.querySelector(selector);
      attempts += 1;
      if (!el && attempts < maxAttempts) return;
      window.clearInterval(interval);
      if (!el) return;

      try {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      } catch {
        // older WebViews that don't support smooth or inline options
        (el as HTMLElement).scrollIntoView();
      }
      el.classList.add("ring-4", "ring-[#5566f6]/40", "transition-shadow");
      window.setTimeout(() => {
        el.classList.remove("ring-4", "ring-[#5566f6]/40");
      }, 2000);
    }, 100);
    return () => window.clearInterval(interval);
  }, [focus, selector]);

  return null;
}
