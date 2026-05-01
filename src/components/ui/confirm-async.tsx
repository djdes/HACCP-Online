"use client";

import { createRoot, type Root } from "react-dom/client";
import { ConfirmDialog, type ConfirmDialogProps } from "./confirm-dialog";

/**
 * Imperative confirmation API. Drop-in замена для `window.confirm`/
 * `window.prompt` — рендерит красивый <ConfirmDialog> в стиле сайта,
 * возвращает Promise<boolean>.
 *
 * Использование:
 *   const ok = await confirmAsync({
 *     title: "Удалить документ?",
 *     description: 'Документ "X" будет удалён.',
 *     variant: "danger",
 *     confirmLabel: "Да, удалить",
 *   });
 *   if (!ok) return;
 *
 * Под капотом:
 *   1. Создаём отдельный <div> в document.body.
 *   2. Mount'им React 18 root + ConfirmDialog с open=true.
 *   3. На confirm/cancel — resolve(boolean), unmount'им и удаляем
 *      div из DOM. Гарантировано single-instance: предыдущий dialog
 *      закрывается перед новым.
 *
 * Только client-side. SSR no-op (возвращает Promise.resolve(false)).
 */
type ConfirmOptions = Omit<ConfirmDialogProps, "open" | "onClose" | "onConfirm">;

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

function cleanup() {
  if (activeRoot) {
    try {
      activeRoot.unmount();
    } catch {
      /* ignore */
    }
    activeRoot = null;
  }
  if (activeContainer) {
    activeContainer.remove();
    activeContainer = null;
  }
}

export function confirmAsync(opts: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(false);
  }
  // Закрываем предыдущий dialog если ещё висит.
  cleanup();

  return new Promise<boolean>((resolve) => {
    const container = document.createElement("div");
    container.dataset.testid = "confirm-async-host";
    document.body.appendChild(container);
    activeContainer = container;

    const root = createRoot(container);
    activeRoot = root;

    function close(result: boolean) {
      // Сначала render с open=false для closing animation, затем
      // через 200ms cleanup — но в простой версии сразу cleanup,
      // ConfirmDialog тоже умеет clean при open=false.
      root.render(
        <ConfirmDialog
          {...opts}
          open={false}
          onClose={() => {}}
          onConfirm={() => {}}
        />,
      );
      setTimeout(() => {
        if (activeContainer === container) cleanup();
        resolve(result);
      }, 50);
    }

    root.render(
      <ConfirmDialog
        {...opts}
        open={true}
        onClose={() => close(false)}
        onConfirm={() => close(true)}
      />,
    );
  });
}

/**
 * Quick helper для destructive operations: предзаполняет variant=danger.
 */
export function confirmDestructive(
  title: string,
  description?: React.ReactNode,
  confirmLabel = "Удалить",
): Promise<boolean> {
  return confirmAsync({
    title,
    description,
    variant: "danger",
    confirmLabel,
  });
}
