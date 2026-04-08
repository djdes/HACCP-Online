"use client";

import { useEffect } from "react";

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
    disableLegacyServiceWorkers().catch((error) => {
      console.error("Failed to disable legacy service workers:", error);
    });
  }, []);

  return null;
}
