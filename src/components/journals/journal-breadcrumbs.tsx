import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";

/**
 * Хлебные крошки раздела журналов: «<Организация> › <Журнал> › <Документ>».
 *
 * Тонкая обёртка над общими `Breadcrumbs` — разметка одна на весь кабинет.
 *
 * Рендерится СЕРВЕРНО на уровне страниц `(dashboard)/journals/*`, а НЕ внутри
 * `*-document-client.tsx`. Причина: клиенты переиспользуются Mini App'ом
 * (`/mini/documents/[id]`), у которого своя навигация (MiniTopBar + MiniNav),
 * и вторая цепочка крошек там была бы лишней.
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
