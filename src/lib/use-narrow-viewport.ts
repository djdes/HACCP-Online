"use client";

import { useEffect, useState } from "react";

/**
 * `true` на телефоне (< 640px).
 *
 * Жил внутри `spotlight-tour.tsx` — компонента обучающего тура, — и это
 * заставляло пять других файлов, к туру отношения не имеющих, тянуть
 * весь тур ради двух строк. Здесь же ему и место.
 */
const NARROW_QUERY = "(max-width: 639px)";

export function useIsNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return narrow;
}
