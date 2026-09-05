import { escapeHtml } from "@/lib/html-escape";
import { FREE_MAX_USERS } from "@/lib/plan-limits";
import { renderEmailLayout, sendRawEmail } from "@/lib/email";

import { formatPoints, REFERRAL_REWARD_PERCENT } from "./constants";

/**
 * Письма системы баллов. Отправитель — WeSetup: приглашение приходит от
 * сервиса, а имя рекомендателя стоит в теле, чтобы письмо не выглядело
 * подделкой под личную переписку.
 */

const APP_URL = (process.env.NEXTAUTH_URL || "https://wesetup.ru").replace(
  /\/+$/,
  "",
);

const P = 'style="margin:0 0 16px;color:#3f3f46;line-height:1.6"';
const MUTED = 'style="margin:24px 0 0;font-size:13px;color:#a1a1aa"';
const BUTTON =
  'style="display:inline-block;background:#5566f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px"';
const BOX = 'style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px"';

function button(href: string, label: string) {
  return `<a href="${href}" ${BUTTON}>${escapeHtml(label)}</a>`;
}

/** Приглашение другу: ссылка с реферальным кодом рекомендателя. */
export async function sendReferralInviteEmail(params: {
  to: string;
  fromOrganizationName: string;
  fromUserName: string;
  code: string;
  message?: string | null;
}): Promise<boolean> {
  const link = `${APP_URL}/r/${params.code}`;
  const subject = `${params.fromOrganizationName} рекомендует WeSetup — электронные журналы СанПиН`;
  const personal = params.message?.trim()
    ? `<div ${BOX}><p style="margin:0;color:#18181b;line-height:1.6">${escapeHtml(
        params.message.trim(),
      )}</p><p style="margin:12px 0 0;font-size:13px;color:#71717a">— ${escapeHtml(
        params.fromUserName,
      )}, ${escapeHtml(params.fromOrganizationName)}</p></div>`
    : "";
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}><strong>${escapeHtml(params.fromUserName)}</strong> из «${escapeHtml(
      params.fromOrganizationName,
    )}» рекомендует вам WeSetup — сервис электронных журналов СанПиН и ХАССП.</p>
    ${personal}
    <p ${P}>По этой ссылке вы начнёте бесплатно — до ${FREE_MAX_USERS} сотрудников, без ограничений по записям, — а рекомендателю начислим бонус на баланс, когда вы оформите подписку.</p>
    ${button(link, "Попробовать WeSetup")}
    <p ${MUTED}>Ссылка: ${escapeHtml(link)}</p>
    <p ${MUTED}>Если письмо пришло по ошибке — просто не переходите по ссылке, больше мы не напишем.</p>`;
  return sendRawEmail(
    params.to,
    subject,
    renderEmailLayout("Вам рекомендуют WeSetup", body),
  );
}

/** Решение по отзыву — автору. */
export async function sendReviewModeratedEmail(params: {
  to: string;
  approved: boolean;
  rewardRub: number;
  rejectReason?: string | null;
}): Promise<boolean> {
  const subject = params.approved
    ? "Ваш отзыв принят — баллы начислены"
    : "Отзыв вернулся на доработку";
  const body = params.approved
    ? `
    <p ${P}>Спасибо за отзыв!</p>
    <p ${P}>Мы его опубликовали, а на баланс вашей организации начислено <strong>${escapeHtml(
      formatPoints(params.rewardRub),
    )}</strong>. Баллы спишутся автоматически при следующей оплате подписки — 1 балл = 1 ₽.</p>
    ${button(`${APP_URL}/settings/balance`, "Открыть баланс и бонусы")}
    <p ${MUTED}>Хотите ещё бонусов? Порекомендуйте нас коллегам — ${REFERRAL_REWARD_PERCENT} % их первой подписки придут вам баллами.</p>`
    : `
    <p ${P}>Спасибо, что нашли время написать отзыв.</p>
    <p ${P}>Опубликовать его в текущем виде мы не смогли. Причина:</p>
    <div ${BOX}><p style="margin:0;color:#18181b;line-height:1.6">${escapeHtml(
      params.rejectReason ?? "не указана",
    )}</p></div>
    <p ${P}>Отправить новый отзыв можно в любой момент — форма в разделе «Баланс и бонусы».</p>
    ${button(`${APP_URL}/settings/balance`, "Исправить и отправить заново")}`;
  return sendRawEmail(
    params.to,
    subject,
    renderEmailLayout(
      params.approved ? "Отзыв принят" : "Отзыв не опубликован",
      body,
    ),
  );
}

/** Реферальная награда начислена — организации-рекомендателю. */
export async function sendReferralRewardEmail(params: {
  to: string;
  friendOrganizationName: string;
  rewardRub: number;
  balanceRub: number;
}): Promise<boolean> {
  const subject = "Друг оформил подписку — баллы на балансе";
  const body = `
    <p ${P}>Хорошая новость!</p>
    <p ${P}>Заведение <strong>${escapeHtml(params.friendOrganizationName)}</strong>, которое пришло по вашей рекомендации, оформило подписку. На баланс вашей организации начислено <strong>${escapeHtml(
      formatPoints(params.rewardRub),
    )}</strong>.</p>
    <div ${BOX}>
      <p style="margin:0;color:#18181b;font-size:14px">Баланс: <strong>${escapeHtml(
        formatPoints(params.balanceRub),
      )}</strong> — спишется автоматически при следующей оплате подписки.</p>
    </div>
    ${button(`${APP_URL}/settings/balance`, "Открыть баланс и бонусы")}
    <p ${MUTED}>Бонус начисляется один раз за каждое приглашённое заведение — ${REFERRAL_REWARD_PERCENT} % его первой подписки.</p>`;
  return sendRawEmail(
    params.to,
    subject,
    renderEmailLayout("Баллы за рекомендацию", body),
  );
}
