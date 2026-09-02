"use client";

import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { labelClass, readError, textareaClass } from "@/components/partner/ui";

export type ReviewAction = "approve" | "reject" | "suspend" | "reactivate";

type ReviewMeta = {
  title: (name: string) => string;
  description: string;
  bullets: Array<{ label: string; tone?: "default" | "warn" | "info" }>;
  confirmLabel: string;
  variant: "default" | "info" | "warn" | "danger";
  commentRequired: boolean;
  commentLabel: string;
  commentPlaceholder: string;
  success: string;
};

/**
 * Одна модалка на четыре решения ROOT по партнёру. Тексты объясняют
 * последствия — что именно включится или выключится у партнёра и его
 * клиентов, — чтобы решение принималось осознанно.
 */
const META: Record<ReviewAction, ReviewMeta> = {
  approve: {
    title: (name) => `Одобрить партнёра «${name}»?`,
    description: "Партнёр получит письмо и уведомление в Telegram, а в кабинете — онбординг из трёх шагов.",
    bullets: [
      { label: "Откроется кабинет /partner и публичная страница /p/<slug>", tone: "info" },
      { label: "Заработают ссылка и код приглашения, white-label брендинг", tone: "info" },
      { label: "Начисления пойдут по текущей версии правил", tone: "info" },
    ],
    confirmLabel: "Одобрить",
    variant: "info",
    commentRequired: false,
    commentLabel: "Комментарий партнёру (необязательно)",
    commentPlaceholder: "Например: договор пришлём на почту в течение дня",
    success: "Партнёр одобрен",
  },
  reject: {
    title: (name) => `Отклонить заявку «${name}»?`,
    description: "Партнёр увидит причину в настройках и сможет подать заявку заново, исправив данные.",
    bullets: [
      { label: "Кабинет и ссылка /p/<slug> не откроются", tone: "warn" },
      { label: "Причина отклонения показывается заявителю дословно", tone: "default" },
    ],
    confirmLabel: "Отклонить",
    variant: "warn",
    commentRequired: true,
    commentLabel: "Причина отклонения",
    commentPlaceholder: "Например: не подтверждена деятельность по ХАССП-консалтингу",
    success: "Заявка отклонена",
  },
  suspend: {
    title: (name) => `Приостановить партнёра «${name}»?`,
    description: "Клиенты остаются привязанными, но партнёр теряет доступ к их кабинетам до возобновления.",
    bullets: [
      { label: "Кабинет /partner и вход в кабинеты клиентов закрываются сразу", tone: "warn" },
      { label: "Страница /p/<slug> перестаёт принимать новых клиентов", tone: "warn" },
      { label: "Новые начисления не создаются; накопленные — сохраняются", tone: "default" },
      { label: "Клиенты видят пометку «партнёр приостановлен» в настройках консультанта", tone: "default" },
    ],
    confirmLabel: "Приостановить",
    variant: "danger",
    commentRequired: true,
    commentLabel: "Причина приостановки",
    commentPlaceholder: "Например: жалобы клиентов на изменения в журналах без согласования",
    success: "Партнёр приостановлен",
  },
  reactivate: {
    title: (name) => `Возобновить партнёра «${name}»?`,
    description: "Доступ к кабинету, клиентам и начислениям вернётся сразу после подтверждения.",
    bullets: [
      { label: "Кабинет и доступ к клиентам открываются снова", tone: "info" },
      { label: "Ссылка /p/<slug> снова принимает новых клиентов", tone: "info" },
    ],
    confirmLabel: "Возобновить",
    variant: "info",
    commentRequired: false,
    commentLabel: "Комментарий партнёру (необязательно)",
    commentPlaceholder: "Например: вопрос по клиенту решён, спасибо за оперативность",
    success: "Партнёр возобновлён",
  },
};

export const REVIEW_ACTION_LABELS: Record<ReviewAction, string> = {
  approve: "Одобрить",
  reject: "Отклонить",
  suspend: "Приостановить",
  reactivate: "Возобновить",
};

/** Какие решения доступны из текущего статуса. */
export function availableReviewActions(status: string): ReviewAction[] {
  switch (status) {
    case "pending":
      return ["approve", "reject"];
    case "active":
      return ["suspend"];
    case "suspended":
      return ["reactivate", "reject"];
    case "rejected":
      return ["approve"];
    default:
      return [];
  }
}

export function ReviewDialog({
  target,
  onClose,
  onDone,
}: {
  target: { partnerId: string; name: string; action: ReviewAction } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [comment, setComment] = useState("");
  const meta = target ? META[target.action] : null;
  const commentMissing = Boolean(meta?.commentRequired) && comment.trim().length === 0;

  function close() {
    setComment("");
    onClose();
  }

  async function confirm() {
    if (!target || !meta) return;
    if (commentMissing) {
      toast.error(`${meta.commentLabel} обязательна`);
      return;
    }
    const res = await fetch(`/api/root/partners/${target.partnerId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: target.action, comment: comment.trim() }),
    });
    if (!res.ok) {
      toast.error(await readError(res, "Не удалось сохранить решение"));
      return;
    }
    toast.success(meta.success);
    setComment("");
    onDone();
  }

  return (
    <ConfirmDialog
      open={Boolean(target && meta)}
      onClose={close}
      onConfirm={confirm}
      title={target && meta ? meta.title(target.name) : ""}
      description={meta?.description}
      bullets={meta?.bullets}
      confirmLabel={meta?.confirmLabel}
      variant={meta?.variant ?? "default"}
    >
      {meta ? (
        <label className="block text-left">
          <span className={labelClass}>{meta.commentLabel}</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder={meta.commentPlaceholder}
            className={textareaClass}
          />
          {meta.commentRequired && commentMissing ? (
            <span className="mt-1.5 block text-[12px] text-[#a13a32]">Без причины решение не сохранится.</span>
          ) : null}
        </label>
      ) : null}
    </ConfirmDialog>
  );
}
