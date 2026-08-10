"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmAsync } from "@/components/ui/confirm-async";

/**
 * Общие действия над `JournalDocument`, которые до этого копипастились
 * в каждом `*-documents-client.tsx` / `*-document-client.tsx`:
 *
 *   • DELETE  /api/journal-documents/[id]      — удалить документ
 *   • PATCH   /api/journal-documents/[id]      — { status: 'active'|'closed' }
 *   • GET     /api/journal-documents/[id]/pdf  — открыть печатную форму
 *
 * Поведение намеренно повторяет то, что было в журналах-донорах
 * (accident / climate / breakdown-history / disinfectant / hygiene):
 * `toast.error` с текстом ошибки от API, `router.refresh()` после
 * успеха, никаких редиректов.
 *
 * Списочные экраны работают с НЕСКОЛЬКИМИ документами, поэтому
 * `documentId` можно не передавать в хук, а указывать в опциях каждого
 * вызова. Экраны одного документа передают id один раз в хук.
 *
 * Пример (список):
 *   const actions = useJournalDocumentActions();
 *   await actions.deleteDocument({
 *     documentId: doc.id,
 *     description: `Документ «${doc.title}» будет удалён.`,
 *     bullets: [{ label: "Записей будет удалено: 42", tone: "warn" }],
 *   });
 *
 * Пример (документ):
 *   const { setStatus, openPdf, isChangingStatus } = useJournalDocumentActions(documentId);
 */

export type JournalDocumentStatus = "active" | "closed";

type ConfirmBullet = { label: string; tone?: "default" | "warn" | "info" };

export type DeleteDocumentOptions = {
  /** Перебивает documentId, переданный в хук (нужно спискам). */
  documentId?: string;
  /** Заголовок confirm-диалога. По умолчанию «Удалить документ?». */
  title?: string;
  /** Описание внутри confirm-диалога. */
  description?: ReactNode;
  /** Список последствий («Записей будет удалено: N»). */
  bullets?: ConfirmBullet[];
  /** Подпись кнопки подтверждения. По умолчанию «Удалить». */
  confirmLabel?: string;
  /** Фраза, которую нужно ввести (для самых опасных удалений). */
  typeToConfirm?: string;
  /** Пропустить confirm — когда вызывающий уже показал свою модалку. */
  skipConfirm?: boolean;
  /** Текст успеха. `null` — не показывать toast. */
  successMessage?: string | null;
  /** Текст ошибки по умолчанию, если API не вернул `error`. */
  errorMessage?: string;
  /** Вызвать `router.refresh()` после успеха. По умолчанию — да. */
  refresh?: boolean;
  onSuccess?: () => void;
};

export type SetStatusOptions = {
  documentId?: string;
  successMessage?: string | null;
  errorMessage?: string;
  refresh?: boolean;
  onSuccess?: () => void;
};

export type OpenPdfOptions = {
  documentId?: string;
};

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return payload?.error || fallback;
}

export function useJournalDocumentActions(documentId?: string | null) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const resolveId = useCallback(
    (override?: string) => override || documentId || null,
    [documentId],
  );

  const deleteDocument = useCallback(
    async (opts: DeleteDocumentOptions = {}) => {
      const id = resolveId(opts.documentId);
      if (!id) return false;

      if (!opts.skipConfirm) {
        const confirmed = await confirmAsync({
          title: opts.title ?? "Удалить документ?",
          description:
            opts.description ??
            "Документ и все его записи будут удалены безвозвратно.",
          bullets: opts.bullets,
          variant: "danger",
          confirmLabel: opts.confirmLabel ?? "Удалить",
          typeToConfirm: opts.typeToConfirm,
        });
        if (!confirmed) return false;
      }

      setIsDeleting(true);
      try {
        const response = await fetch(`/api/journal-documents/${id}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          toast.error(
            await readApiError(
              response,
              opts.errorMessage ?? "Не удалось удалить документ",
            ),
          );
          return false;
        }
        if (opts.successMessage !== null) {
          toast.success(opts.successMessage ?? "Документ удалён");
        }
        opts.onSuccess?.();
        if (opts.refresh !== false) router.refresh();
        return true;
      } catch {
        toast.error("Сетевая ошибка — документ не удалён");
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [resolveId, router],
  );

  const setStatus = useCallback(
    async (status: JournalDocumentStatus, opts: SetStatusOptions = {}) => {
      const id = resolveId(opts.documentId);
      if (!id) return false;

      setIsChangingStatus(true);
      try {
        const response = await fetch(`/api/journal-documents/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) {
          toast.error(
            await readApiError(
              response,
              opts.errorMessage ??
                (status === "closed"
                  ? "Не удалось закрыть документ"
                  : "Не удалось вернуть документ в активные"),
            ),
          );
          return false;
        }
        if (opts.successMessage !== null) {
          toast.success(
            opts.successMessage ??
              (status === "closed"
                ? "Документ перенесён в закрытые"
                : "Документ снова активен"),
          );
        }
        opts.onSuccess?.();
        if (opts.refresh !== false) router.refresh();
        return true;
      } catch {
        toast.error("Сетевая ошибка — статус не изменён");
        return false;
      } finally {
        setIsChangingStatus(false);
      }
    },
    [resolveId, router],
  );

  const openPdf = useCallback(
    (opts: OpenPdfOptions = {}) => {
      const id = resolveId(opts.documentId);
      if (!id) return;
      const opened = window.open(
        `/api/journal-documents/${id}/pdf`,
        "_blank",
        "noopener,noreferrer",
      );
      if (!opened) {
        toast.error(
          "Браузер заблокировал новое окно — разрешите всплывающие окна для печати",
        );
      }
    },
    [resolveId],
  );

  return {
    deleteDocument,
    setStatus,
    openPdf,
    isDeleting,
    isChangingStatus,
  } as const;
}
