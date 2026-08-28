"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { getRouteTitle } from "@/lib/route-titles";

/**
 * Единая навигация страницы кабинета: «← Назад» + хлебные крошки.
 *
 * Рендерится один раз в `(dashboard)/layout.tsx` над `{children}` — вместо
 * сорока рукописных ссылок «← Настройки» с шестью разными подписями.
 *
 * Крошки собираются из `usePathname()` по словарю `ROUTE_TITLES`. Сегменты,
 * которых в словаре нет (динамические `[id]`, `[code]`), пропускаются: без
 * этого в пути светились бы сырые cuid'ы. Страница может уточнить хвост
 * цепочки, отрендерив `<PageCrumbs items={[…]} />` — серверный компонент
 * знает название документа, а `PageNav` про него знать не может.
 */

type CrumbOverride = { items: Crumb[] } | null;

const BreadcrumbContext = createContext<{
  override: CrumbOverride;
  setOverride: (value: CrumbOverride) => void;
}>({ override: null, setOverride: () => {} });

export function PageNavProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<CrumbOverride>(null);
  const value = useMemo(() => ({ override, setOverride }), [override]);
  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Уточнение крошек для страниц с динамическим сегментом. Ничего не рисует —
 * только кладёт хвост цепочки в контекст и снимает его при уходе.
 *
 * Сериализуем items в ключ эффекта: массив-литерал из серверного компонента
 * каждый рендер новый, и зависимость по ссылке зациклила бы setState.
 */
export function PageCrumbs({ items }: { items: Crumb[] }) {
  const { setOverride } = useContext(BreadcrumbContext);
  const key = JSON.stringify(items);
  useEffect(() => {
    setOverride({ items: JSON.parse(key) as Crumb[] });
    return () => setOverride(null);
  }, [key, setOverride]);
  return null;
}

/** Разделы, где своя навигация: корни и журналы с их `JournalBreadcrumbs`. */
function isHiddenPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/settings") return true;
  return pathname.startsWith("/journals/");
}

export function PageNav({ organizationName }: { organizationName: string }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { override } = useContext(BreadcrumbContext);

  const segments = pathname.split("/").filter(Boolean);

  const autoCrumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const result: Crumb[] = [];
    let prefix = "";
    parts.forEach((segment, index) => {
      prefix += `/${segment}`;
      const title = getRouteTitle(prefix);
      if (!title) return;
      const isLast = index === parts.length - 1;
      result.push({ label: title, href: isLast ? undefined : prefix });
    });
    return result;
  }, [pathname]);

  const crumbs: Crumb[] = [
    { label: organizationName, href: "/dashboard" },
    ...(override?.items ?? autoCrumbs),
  ];

  // Родитель — предпоследняя крошка со ссылкой; если её нет, уходим на
  // «Главную». Это запасной адрес для прямого захода по ссылке, когда
  // истории в табе ещё нет и `router.back()` увёл бы с сайта.
  const parentHref =
    [...crumbs].reverse().find((crumb) => crumb.href)?.href ?? "/dashboard";

  if (isHiddenPath(pathname) || segments.length === 0) return null;

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(parentHref);
  }

  return (
    <div className="mb-4 flex flex-col gap-1.5 print:hidden">
      <button
        type="button"
        onClick={goBack}
        className="-ml-3 inline-flex h-9 w-fit items-center gap-2 rounded-2xl px-3 text-[14px] text-[#6f7282] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15"
      >
        <ArrowLeft className="size-4" />
        Назад
      </button>
      <Breadcrumbs items={crumbs} />
    </div>
  );
}
