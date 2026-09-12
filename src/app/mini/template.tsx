"use client";

/**
 * Въезд экрана вместо белой вспышки.
 *
 * `template.tsx`, а не `layout.tsx`: layout между переходами
 * переиспользуется, поэтому анимацию входа на нём не проиграть —
 * template же пересоздаётся на каждой навигации, что здесь и нужно.
 *
 * Движение короткое и сдержанное: 0.22 с и сдвиг на 8 px. Длиннее —
 * и переход начинает мешать человеку, который на кухне тапает быстро.
 * Классы из `tw-animate-css`, он уже подключён в `globals.css`.
 * Уважение `prefers-reduced-motion` обеспечивает правило в
 * `mini-theme.css`, гасящее длительности.
 *
 * Состояние страниц сбрасывается при пересоздании — для `/mini` это
 * безопасно: экраны и так загружают себя сами через `fetch`, а
 * незаконченный ввод хранится отдельно (`use-form-draft.ts`).
 */
export default function MiniTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out">
      {children}
    </div>
  );
}
