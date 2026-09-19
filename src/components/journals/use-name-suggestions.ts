"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  mergeSuggestions,
  promoteSuggestions,
  type NameSuggestionScope,
} from "@/lib/name-suggestions";

/**
 * Недавние наименования организации для выпадающего списка окна строки.
 *
 * `options(catalog)` — готовый список: недавние сверху, затем справочник
 * документа. `remember(values)` — после сохранения строки: значения сразу
 * поднимаются наверх локально и уходят на сервер; ошибка сети подсказки не
 * ломает (список документа остаётся).
 */
export function useNameSuggestions(scope: NameSuggestionScope) {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/name-suggestions?scope=${scope}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (cancelled || !payload || !Array.isArray(payload.values)) return;
        setRecent(payload.values.filter((value: unknown): value is string => typeof value === "string"));
      })
      .catch(() => {
        /* без сети — работаем по справочнику документа */
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const remember = useCallback(
    async (values: readonly (string | null | undefined)[]) => {
      const clean = values.filter((value): value is string => typeof value === "string" && value.trim() !== "");
      if (clean.length === 0) return;
      setRecent((current) => promoteSuggestions(current, clean));
      await fetch("/api/name-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, values: clean }),
      }).catch(() => {
        /* подсказка не критична */
      });
    },
    [scope]
  );

  const options = useCallback(
    (...catalogs: readonly (readonly string[])[]) => mergeSuggestions(recent, ...catalogs),
    [recent]
  );

  return useMemo(() => ({ recent, remember, options }), [recent, remember, options]);
}
