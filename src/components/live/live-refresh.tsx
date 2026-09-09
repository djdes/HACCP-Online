"use client";

import { useRouter } from "next/navigation";

import { useLiveRefetch, type LiveRefetchOptions } from "@/lib/use-live-refetch";

/**
 * Серверная страница перечитывает себя по живому событию.
 *
 * Кладётся первым ребёнком в JSX страницы (дашборд, список журналов,
 * страница журнала), ничего не рисует. `router.refresh()` перезапрашивает
 * серверные компоненты, не трогая клиентское состояние — открытые
 * диалоги и введённый текст остаются.
 */
export function LiveRefresh(props: Pick<LiveRefetchOptions, "types" | "codes" | "minIntervalMs">) {
  const router = useRouter();
  const { types, codes, minIntervalMs } = props;
  useLiveRefetch(() => router.refresh(), { types, codes, minIntervalMs });
  return null;
}
