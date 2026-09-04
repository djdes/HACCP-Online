"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Разовое уведомление «в аккаунте»: `seen === null` — ещё грузится,
 * `false` — человек этого не видел, `true` — видел (или узнать не
 * удалось: при ошибке сети/401 лишнее окно хуже молчания).
 *
 * `markSeen()` ставит флаг оптимистично и пишет его через
 * `POST /api/me/notices` — отметка переживает смену браузера и устройства.
 * `key === null` выключает хук целиком (журнал без гайда).
 */
export function useSeenNotice(key: string | null): {
  seen: boolean | null;
  markSeen: () => void;
} {
  const [seen, setSeen] = useState<boolean | null>(null);
  // markSeen() мог сработать раньше, чем ответил GET (например, ?tour= на
  // первом заходе) — поздний ответ «не видел» не должен перебить отметку.
  const markedRef = useRef(false);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    markedRef.current = false;
    fetch(`/api/me/notices?key=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { seen: true }))
      .then((data: { seen?: unknown }) => {
        if (!cancelled && !markedRef.current) setSeen(data?.seen === false ? false : true);
      })
      .catch(() => {
        if (!cancelled) setSeen(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const markSeen = useCallback(() => {
    if (!key) return;
    markedRef.current = true;
    setSeen(true);
    fetch("/api/me/notices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    }).catch(() => {});
  }, [key]);

  return { seen, markSeen };
}
