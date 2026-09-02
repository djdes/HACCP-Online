"use client";

import type { MouseEvent, ReactNode } from "react";

/**
 * Ссылка-якорь с плавным переходом по лендингу.
 *
 * Обычный `next/link` по хешу прыгает мгновенно — это первая половина
 * проблемы. Вторая: секции лендинга объявлены `content-visibility: auto` с
 * заглушкой высоты в 720px, поэтому до первого показа браузер не знает их
 * настоящих размеров. Пока страница летит вниз, секции дорисовываются,
 * растут, и якорь уезжает — заголовок оказывается посреди экрана.
 *
 * Поэтому перед расчётом мы на время снимаем `content-visibility` (класс
 * `anchor-measuring` в globals.css), даём браузеру разложить страницу
 * по-настоящему и только потом считаем цель. Обратно класс снимаем после
 * приезда: `contain-intrinsic-size: auto` запоминает измеренные высоты, так
 * что второй раз страница уже не дёрнется.
 */

const HEADER_GAP = 8;
const SCROLL_END_FALLBACK_MS = 1000;
const SETTLE_STEP_MS = 120;
const SETTLE_DEADLINE_MS = 2400;
const STABLE_TICKS_TO_STOP = 3;
const DRIFT_TOLERANCE_PX = 4;

function headerOffset() {
  const nav = document.querySelector<HTMLElement>(".landing-nav");
  return (nav?.offsetHeight ?? 0) + HEADER_GAP;
}

function targetTop(element: HTMLElement) {
  return element.getBoundingClientRect().top + window.scrollY - headerOffset();
}

export function AnchorScrollLink({
  href,
  className,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // Ctrl/Cmd-клик и «открыть в новой вкладке» оставляем браузеру.
    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    const element = document.querySelector<HTMLElement>(href);
    if (!element) return;

    event.preventDefault();

    const page = document.querySelector<HTMLElement>(".landing-page");
    page?.classList.add("anchor-measuring");
    // Синхронное чтение layout'а — заставляет браузер разложить всё
    // сейчас, до того как мы посчитаем позицию цели.
    void document.body.offsetHeight;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: targetTop(element),
      behavior: reduceMotion ? "auto" : "smooth",
    });
    history.replaceState(null, "", href);

    /**
     * Доводка до цели — уже после того, как плавный скролл отыграл.
     * Картинки и шрифты догружаются позже и каждый раз двигают якорь, так
     * что одной проверки мало: держим цель, пока страница не перестанет
     * шевелиться, но не дольше дедлайна. Если человек в это время крутит
     * сам — сразу уходим с дороги.
     */
    let settleTimer = 0;
    const cleanup = () => {
      window.clearInterval(settleTimer);
      page?.classList.remove("anchor-measuring");
      window.removeEventListener("wheel", cleanup);
      window.removeEventListener("touchstart", cleanup);
      window.removeEventListener("keydown", cleanup);
    };

    window.addEventListener("wheel", cleanup, { once: true, passive: true });
    window.addEventListener("touchstart", cleanup, { once: true, passive: true });
    window.addEventListener("keydown", cleanup, { once: true });

    const startSettling = () => {
      const startedAt = Date.now();
      let stableTicks = 0;
      settleTimer = window.setInterval(() => {
        const drift = Math.abs(window.scrollY - targetTop(element));
        if (drift > DRIFT_TOLERANCE_PX) {
          stableTicks = 0;
          // Мгновенно: анимация уже отыграла, и вторая плавная поездка
          // читалась бы как «страницу шатает».
          window.scrollTo({ top: targetTop(element), behavior: "auto" });
        } else {
          stableTicks += 1;
        }
        if (
          stableTicks >= STABLE_TICKS_TO_STOP ||
          Date.now() - startedAt > SETTLE_DEADLINE_MS
        ) {
          cleanup();
        }
      }, SETTLE_STEP_MS);
    };

    if (reduceMotion) {
      startSettling();
      return;
    }
    // Дожидаемся конца плавной поездки, иначе доводка перебьёт анимацию.
    let started = false;
    const onScrollEnd = () => {
      if (started) return;
      started = true;
      window.removeEventListener("scrollend", onScrollEnd);
      startSettling();
    };
    window.addEventListener("scrollend", onScrollEnd, { once: true });
    window.setTimeout(onScrollEnd, SCROLL_END_FALLBACK_MS);
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </a>
  );
}
