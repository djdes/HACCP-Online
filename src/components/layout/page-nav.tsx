"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";
import { getRouteTitle, getSiblingRoutes } from "@/lib/route-titles";

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

/**
 * Кнопка «← Назад» — ровно кнопка «назад» браузера, а не ссылка вверх по
 * иерархии. Человек пришёл сюда откуда-то конкретно (из списка, из поиска,
 * из уведомления) и ждёт, что вернётся туда же.
 *
 * `fallbackHref` нужен для прямого захода по ссылке: в новой вкладке
 * истории нет, и `router.back()` увёл бы с сайта.
 *
 * Отдельный экспорт, потому что раздел журналов рисует крошки серверно
 * (на своих страницах), а кнопка нужна и там — см. `journals/[code]/layout`.
 */
export function PageBackLink({
  fallbackHref = "/dashboard",
  className = "",
}: {
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className={`-ml-3 inline-flex h-9 w-fit items-center gap-2 rounded-2xl px-3 text-[14px] text-[#6f7282] transition-colors hover:bg-[#f5f6ff] hover:text-[#0b1024] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#5566f6]/15 print:hidden ${className}`}
    >
      <ArrowLeft className="size-4" />
      Назад
    </button>
  );
}

/**
 * Статические подпапки `/journals/*`, которые НЕ проходят через
 * `journals/[code]/layout.tsx` (в Next.js статический сегмент выигрывает у
 * динамического). Им нужна обычная глобальная навигация.
 */
const JOURNALS_STATIC_CHILDREN = new Set(["traceability"]);

/**
 * Подтверждает, что путь лежит в поддереве `journals/[code]`. Там своя
 * навигация: белая подложка раздела full-bleed, и крошки должны стоять
 * ВНУТРИ неё, а не над ней на сером фоне.
 */
function isJournalCodeSubtree(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "journals" || parts.length < 2) return false;
  return !JOURNALS_STATIC_CHILDREN.has(parts[1]);
}

export function PageNav({ organizationName }: { organizationName: string }) {
  const pathname = usePathname() || "/";
  const { override } = useContext(BreadcrumbContext);

  // Каждое звено раскрывается в соседей по уровню: из «Здания и
  // помещения» — сразу в «Оборудование», не возвращаясь в список
  // настроек. Данных для этого не нужно — весь словарь маршрутов уже
  // на клиенте.
  const autoCrumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    const result: Crumb[] = [];
    let prefix = "";
    parts.forEach((segment, index) => {
      prefix += `/${segment}`;
      const title = getRouteTitle(prefix);
      if (!title) return;
      const isLast = index === parts.length - 1;
      const here = prefix;
      const siblings = getSiblingRoutes(here);
      result.push({
        label: title,
        href: isLast ? undefined : here,
        menu:
          siblings.length > 0
            ? [
                { label: title, href: here, current: true },
                ...siblings.map((s) => ({ label: s.title, href: s.path })),
              ]
            : undefined,
        menuTitle: siblings.length > 0 ? "Соседние разделы" : undefined,
      });
    });
    return result;
  }, [pathname]);

  const crumbs: Crumb[] = [
    { label: organizationName, href: "/dashboard" },
    ...(override?.items ?? autoCrumbs),
  ];

  // Родитель — последняя крошка со ссылкой; это запасной адрес для прямого
  // захода, когда истории в табе ещё нет.
  const parentHref =
    [...crumbs].reverse().find((crumb) => crumb.href)?.href ?? "/dashboard";

  // Скрыт только на самой «Главной»: она и есть корень, возвращаться с
  // неё некуда, а цепочка из одного звена ничего не объясняет. Везде
  // остальное — включая `/settings` — навигация есть всегда.
  if (pathname === "/dashboard" || isJournalCodeSubtree(pathname)) return null;

  return (
    <div className="mb-4 flex flex-col gap-1.5 print:hidden">
      <PageBackLink fallbackHref={parentHref} />
      <Breadcrumbs items={crumbs} />
    </div>
  );
}
