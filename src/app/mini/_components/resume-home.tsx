"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { pageHasDirtyInput, shouldReturnHome } from "../_lib/resume-home";

/**
 * Открыл приложение утром — видишь задачи на сегодня, а не вчерашний
 * экран.
 *
 * Установленное приложение продолжает с той страницы, где его закрыли:
 * так устроены и Android, и iOS, и `start_url` из манифеста тут ни при
 * чём — он работает только при холодном запуске. Внутри смены это
 * удобно, а на следующий день сбивает с толку.
 *
 * Правило и все оговорки — в `_lib/resume-home.ts`, под тестом. Здесь
 * только подписка на видимость вкладки.
 */
export function ResumeHome() {
  const router = useRouter();
  const pathname = usePathname();
  // Держим в ref, чтобы подписка на видимость не пересоздавалась при
  // каждом переходе: иначе уход в фон ровно в момент навигации терял бы
  // отметку времени, и правило не срабатывало.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let hiddenAt: number | null = null;

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      if (hiddenAt === null) return;
      const hiddenMs = Date.now() - hiddenAt;
      hiddenAt = null;

      const decision = shouldReturnHome({
        hiddenMs,
        pathname: pathnameRef.current,
        hasDirtyInput: pageHasDirtyInput(document),
      });
      if (decision) router.replace("/mini");
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);

  return null;
}
