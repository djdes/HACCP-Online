import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Хлебные крошки раздела журналов: «<Организация> › <Журнал> › <Документ>».
 *
 * Рендерится СЕРВЕРНО на уровне страниц `(dashboard)/journals/*`, а НЕ внутри
 * `*-document-client.tsx`. Причина: клиенты переиспользуются Mini App'ом
 * (`/mini/documents/[id]`), у которого своя навигация (MiniTopBar + MiniNav),
 * и вторая цепочка крошек там была бы лишней.
 *
 * Последний элемент — не ссылка (текущая страница), остальные ведут вверх
 * по иерархии. Заменяет собой кнопку «Назад» — как на эталоне.
 */

export type JournalCrumb = {
  label: string;
  href?: string;
};

export function JournalBreadcrumbs({
  items,
  className = "",
}: {
  items: JournalCrumb[];
  className?: string;
}) {
  const visible = items.filter((item) => item.label.trim().length > 0);
  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="Хлебные крошки"
      className={`flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px] font-medium leading-[1.4] print:hidden ${className}`}
    >
      {visible.map((item, index) => {
        const isLast = index === visible.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-x-1">
            {index > 0 ? (
              <ChevronRight
                aria-hidden
                className="size-3.5 shrink-0 self-center text-[#c6c9d8]"
              />
            ) : null}
            {isLast || !item.href ? (
              <span
                className={isLast ? "text-[#0b1024]" : "text-[#6f7282]"}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-[#6f7282] transition-colors hover:text-[#5566f6]"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
