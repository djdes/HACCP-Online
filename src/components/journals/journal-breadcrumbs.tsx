import {
  Breadcrumbs,
  type Crumb,
  type CrumbMenuItem,
} from "@/components/ui/breadcrumbs";

/**
 * Хлебные крошки раздела журналов:
 * «<Организация> › Журналы › <Журнал> › <Документ>».
 *
 * Тонкая обёртка над общими `Breadcrumbs` — разметка одна на весь кабинет.
 *
 * Рендерится СЕРВЕРНО на уровне страниц `(dashboard)/journals/*`, а НЕ внутри
 * `*-document-client.tsx`. Причина: клиенты переиспользуются Mini App'ом
 * (`/mini/documents/[id]`), у которого своя навигация (MiniTopBar + MiniNav),
 * и вторая цепочка крошек там была бы лишней.
 *
 * Серверный рендер — ещё и причина, почему раздел не пользуется глобальным
 * `PageNav`: тот собирает крошки на клиенте, и на странице журнала имя
 * подставлялось бы вторым кадром, после вспышки «Журналы».
 */

export type JournalCrumb = Crumb;

export function JournalBreadcrumbs({
  items,
  className = "",
}: {
  items: JournalCrumb[];
  className?: string;
}) {
  return <Breadcrumbs items={items} className={className} />;
}

/**
 * Готовая цепочка раздела: организация → «Журналы» → журнал → хвост.
 *
 * Собирается здесь, а не на каждой странице, чтобы порядок и ссылки звеньев
 * не разъезжались между списком документов, бланком, гайдом и проверкой.
 * `tail` — то, что знает только конкретная страница: название документа,
 * «Новая запись», «Проверка».
 */
export function JournalPageCrumbs({
  organizationName,
  journalName,
  journalCode,
  journalMenu,
  tail = [],
  className = "",
}: {
  organizationName: string;
  journalName?: string;
  journalCode?: string;
  /** Набор журналов — звено «журнал» раскрывается в него по наведению. */
  journalMenu?: CrumbMenuItem[];
  tail?: JournalCrumb[];
  className?: string;
}) {
  const items: JournalCrumb[] = [
    { label: organizationName, href: "/dashboard" },
    {
      label: "Журналы",
      href: "/journals",
      // Двухуровневое, как «Проекты» в ProjectsFlow: журнал → его
      // документы. Отсюда можно попасть сразу в нужный бланк, не
      // открывая сперва журнал.
      menu: journalMenu,
      menuTitle: journalMenu ? "Перейти к журналу" : undefined,
    },
  ];

  if (journalName) {
    // Ссылкой журнал становится, только когда он не последнее звено —
    // ссылка «сам на себя» на текущей странице сбивает с толку. Меню при
    // этом есть всегда: перейти в соседний журнал полезно и с него самого.
    //
    // Здесь список ПЛОСКИЙ: на этом уровне нужен быстрый переход
    // «журнал → журнал» по цвету точки, а вложенность только добавила бы
    // шаг к тому же самому.
    items.push({
      label: journalName,
      href: tail.length > 0 && journalCode ? `/journals/${journalCode}` : undefined,
      menu: journalMenu?.map(({ submenuJournalCode: _drop, ...rest }) => rest),
      menuTitle: journalMenu ? "Журналы набора" : undefined,
    });
  }

  items.push(...tail);

  return <Breadcrumbs items={items} className={className} />;
}
