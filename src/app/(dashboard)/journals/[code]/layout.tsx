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
    // Full-bleed белая подложка: `<main>` в (dashboard)/layout ограничен
    // 1296px, поэтому выходим из контейнера через w-screen + центрирование —
    // белый фон тянется от края до края, как на эталоне (body имеет
    // overflow-x-clip, поэтому скроллбар не появляется).
    <div className="relative left-1/2 -my-4 w-screen -translate-x-1/2 bg-white py-4 md:-my-6 md:py-6">
      {/* 1296px — ширина контейнера эталона. Широкие таблицы журналов
          скроллятся внутри собственного viewport-контейнера
          (JOURNAL_TABLE_VIEWPORT_CLASS), поэтому сужение их не режет. */}
      {/* space-y-3 — шаг «хлебные крошки → H1» эталона (12px). Дальше
          ритм страницы задают токены DOC_* из journal-responsive.ts. */}
      {/* px-4 md:px-6 — ВНУТРИ коробки 1296px, один в один как в <Header>
          и в контейнере (dashboard)/layout.tsx. Раньше padding стоял на
          full-bleed обёртке (снаружи коробки) и сдвигал весь раздел
          журналов на 24px влево относительно шапки. */}
      <div className="mx-auto w-full max-w-[1296px] space-y-3 px-4 md:px-6">
        {children}
        <JournalDocGuideOverlay />
      </div>
    </div>
  );
}
