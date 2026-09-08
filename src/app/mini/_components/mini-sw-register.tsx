"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { MINI_SW_SCOPE_PATH } from "@/lib/service-worker-scope";

const MINI_SW_URL = "/mini-sw.js";

/**
 * Регистрация service worker'а кабинета.
 *
 * Живёт только внутри `/mini` и только в этом scope: на сайте воркер не
 * нужен, а лишний scope означал бы перехват страниц дашборда.
 *
 * Обновление применяется ТОЛЬКО по нажатию. Новый воркер встаёт в
 * ожидание, человек видит тост и решает сам. Автоматический
 * `skipWaiting` перезагрузил бы страницу посреди заполнения журнала — а
 * там бывает десять полей и фото.
 */
export function MiniServiceWorkerRegister() {
  const promptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // На http (кроме localhost) регистрация всё равно упадёт.
    if (!window.isSecureContext) return;

    let cancelled = false;

    /** Показать «Доступно обновление» — один раз на загрузку страницы. */
    function offerUpdate(worker: ServiceWorker) {
      if (promptedRef.current || cancelled) return;
      promptedRef.current = true;
      toast("Доступно обновление", {
        description: "Приложение обновится и страница перезагрузится.",
        duration: Infinity,
        action: {
          label: "Обновить",
          onClick: () => {
            // Перезагружаем не сразу, а когда новый воркер реально взял
            // управление, иначе перезагрузка попадёт на старый и тост
            // вернётся при следующем заходе.
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => window.location.reload(),
              { once: true },
            );
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    }

    void (async () => {
      try {
        // Scope берём из общего модуля: по нему же корневой
        // `sw-register.tsx` отличает нашу регистрацию от исторических.
        const registration = await navigator.serviceWorker.register(
          MINI_SW_URL,
          { scope: MINI_SW_SCOPE_PATH },
        );
        if (cancelled) return;

        // Обновление уже ждало с прошлого раза.
        if (registration.waiting && navigator.serviceWorker.controller) {
          offerUpdate(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // `controller` пуст при самой первой установке — тогда
            // обновлять нечего, человек и так видит свежую версию.
            if (
              installing.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              offerUpdate(installing);
            }
          });
        });
      } catch (error) {
        // Тихо: без воркера кабинет работает, просто не устанавливается.
        console.warn("[mini-sw] регистрация не удалась", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
