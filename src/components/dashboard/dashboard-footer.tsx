import Link from "next/link";

/**
 * Компактный футер дашборда — одна строка вместо трёхколоночного
 * `PublicFooter`. Виден на КАЖДОЙ странице `(dashboard)`: подключён
 * в `(dashboard)/layout.tsx` сразу после `<main>`.
 *
 * Фон прозрачный — чтобы тёмная тема (`app-theme.css`) не требовала
 * отдельного override'а: подложка приходит от `.app-shell`.
 * Mini App (`/mini/*`) живёт в своём layout'е и этот футер не получает.
 */
export function DashboardFooter() {
  const linkClass = "transition-colors hover:text-[#5566f6]";

  return (
    <footer className="mt-auto border-t border-[#ececf4] px-4 py-5 text-[12.5px] text-[#9b9fb3] md:px-6 print:hidden">
      <div className="mx-auto flex max-w-[1760px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[13px] font-semibold tracking-[0.22em] text-[#6f7282]">
            WESETUP
          </span>
          <span>© 2026</span>
        </div>

        {/* sm:pr-[104px] — коридор под плавающие кнопки (support + AI-чат
            занимают правые ~123px: `fixed bottom-5 right-5` и `right-[68px]`,
            размер size-11). Без него «support@wesetup.ru» и «Telegram»
            перекрывались виджетами, когда футер попадал в нижнюю часть окна. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:pr-[104px]">
          <Link href="/oferta" className={linkClass}>
            Договор-оферта
          </Link>
          <Link href="/privacy" className={linkClass}>
            Политика конфиденциальности
          </Link>
          <Link href="/blog" className={linkClass}>
            База знаний
          </Link>
          <a href="mailto:support@wesetup.ru" className={linkClass}>
            support@wesetup.ru
          </a>
          <a
            href="https://t.me/wesetupbot"
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            Telegram
          </a>
        </div>
      </div>
    </footer>
  );
}
