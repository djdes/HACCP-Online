"use client";

import { useEffect } from "react";

const BUILD_ID_STORAGE_KEY = "wesetup-build-id";
const BUILD_RELOAD_FLAG = "wesetup-build-reloaded";

async function disableLegacyServiceWorkers() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  }
}

export function ServiceWorkerRegister() {
  useEffect(() => {
    let cancelled = false;

    async function syncBuild() {
      await disableLegacyServiceWorkers();

      const response = await fetch("/api/build-info", { cache: "no-store" });
      if (!response.ok || cancelled) return;

      const data = await response.json();
      const nextBuildId = typeof data?.buildId === "string" ? data.buildId : "";
      if (!nextBuildId || cancelled) return;

      const previousBuildId = window.localStorage.getItem(BUILD_ID_STORAGE_KEY);
      const reloadFlag = window.sessionStorage.getItem(BUILD_RELOAD_FLAG);

      if (previousBuildId && previousBuildId !== nextBuildId && reloadFlag !== nextBuildId) {
        if ("caches" in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }

        window.localStorage.setItem(BUILD_ID_STORAGE_KEY, nextBuildId);
        window.sessionStorage.setItem(BUILD_RELOAD_FLAG, nextBuildId);
        window.location.reload();
        return;
      }

      window.localStorage.setItem(BUILD_ID_STORAGE_KEY, nextBuildId);
      if (reloadFlag === nextBuildId) {
        window.sessionStorage.removeItem(BUILD_RELOAD_FLAG);
      }
    }

    syncBuild().catch((error) => {
      console.error("Failed to sync build state:", error);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
