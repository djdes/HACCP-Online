"use client";

import { useEffect } from "react";

/**
 * Mouse-follow indigo glow for the landing page.
 *
 * Sets `--cursor-x` / `--cursor-y` CSS variables on `<html>` based on
 * the smoothed cursor position. CSS in `globals.css` reads them via
 * `radial-gradient(... at var(--cursor-x) var(--cursor-y), ...)` to
 * draw a soft indigo wash that follows the pointer.
 *
 * Why JS: pure-CSS cursor tracking exists (CSS scroll-driven works for
 * scroll, not pointer). `mousemove` → CSS var is a tiny RAF loop, no
 * re-renders.
 *
 * Disabled when:
 *   - `prefers-reduced-motion: reduce` — accessibility
 *   - `pointer: coarse` — touch devices have no hovering pointer, so
 *     the gradient would just sit awkwardly somewhere
 */
export function CursorGlow() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduceMotion) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const root = document.documentElement;
    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    function tick() {
      // Lerp factor 0.12 — следует за курсором с лёгкой инерцией,
      // не дёргается. На быстром движении мыши glow «догоняет».
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      root.style.setProperty("--cursor-x", `${cx.toFixed(1)}px`);
      root.style.setProperty("--cursor-y", `${cy.toFixed(1)}px`);
      raf = requestAnimationFrame(tick);
    }

    function onMove(e: MouseEvent) {
      tx = e.clientX;
      ty = e.clientY;
    }

    document.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    root.classList.add("landing-cursor-active");

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
      root.classList.remove("landing-cursor-active");
      root.style.removeProperty("--cursor-x");
      root.style.removeProperty("--cursor-y");
    };
  }, []);

  return null;
}
