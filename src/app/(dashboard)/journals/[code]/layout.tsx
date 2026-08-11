import { JournalDocGuideOverlay } from "@/components/journals/journal-doc-guide";

/**
 * Shared layout for the `/journals/<code>` subtree.
 *
 * Фон раздела — белый, во всю ширину `<main>` (эталон lk.haccp-online.ru:
 * страница и документ одного цвета, без «серой рамки» вокруг бумаги).
 * `-m-4 p-4` / `md:-m-6 md:p-6` компенсируют padding `<main>` из
 * `(dashboard)/layout.tsx`. `bg-white` намеренно — в тёмной теме он
 * автоматически мапится в `--app-surface` (см. `app-theme.css`).
 *
 * Навигация вверх — хлебные крошки (`JournalBreadcrumbs`), которые
 * рендерятся серверно на самих страницах; отдельной кнопки «Назад»
 * больше нет.
 *
 * `JournalDocGuideOverlay` рендерит floating-кнопку «Как заполнять» —
 * сама компонента детектит по URL, что мы на странице документа, и
 * скрывается на других URL'ах. Контент гайда — из journal-doc-guides.ts.
 */
export default function JournalCodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-4 min-h-full bg-white p-4 md:-m-6 md:p-6">
      {/* 1296px — ширина контейнера эталона. Широкие таблицы журналов
          скроллятся внутри собственного viewport-контейнера
          (JOURNAL_TABLE_VIEWPORT_CLASS), поэтому сужение их не режет. */}
      <div className="mx-auto max-w-[1296px] space-y-5">
        {children}
        <JournalDocGuideOverlay />
      </div>
    </div>
  );
}
