import { escapeHtml } from "@/lib/html-escape";
import {
  emailBrandForPartnerSlug,
  renderEmailLayout,
  sendRawEmail,
  type EmailBrand,
} from "@/lib/email";

/**
 * Письма партнёрской программы. Отправитель всегда WeSetup (П. 4.2 ТЗ):
 * партнёрский бренд — только в теле письма.
 */
const APP_URL = process.env.NEXTAUTH_URL || "https://wesetup.ru";

const P = 'style="margin:0 0 16px;color:#3f3f46;line-height:1.6"';
const MUTED = 'style="margin:24px 0 0;font-size:13px;color:#a1a1aa"';
const BUTTON =
  'style="display:inline-block;background:#5566f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px"';
const BOX = 'style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px"';

function button(href: string, label: string) {
  return `<a href="${href}" ${BUTTON}>${escapeHtml(label)}</a>`;
}

/** Заявка принята — партнёру-заявителю. */
export async function sendPartnerApplicationReceivedEmail(params: {
  to: string;
  companyName: string;
  slug: string;
}) {
  const subject = "Заявка на партнёрство принята — WeSetup";
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}>Мы получили заявку от <strong>${escapeHtml(params.companyName)}</strong>. Обычно рассматриваем за 1–2 рабочих дня и напишем на эту почту и в Telegram.</p>
    <div ${BOX}>
      <p style="margin:0 0 6px;font-size:13px;color:#71717a">Ваша будущая партнёрская ссылка</p>
      <p style="margin:0;color:#18181b;font-family:monospace">${escapeHtml(`${APP_URL}/p/${params.slug}`)}</p>
    </div>
    <p ${MUTED}>Ссылка заработает после одобрения заявки.</p>`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Заявка принята", body));
}

/** Заявка одобрена — открываем кабинет. */
export async function sendPartnerApprovedEmail(params: {
  to: string;
  companyName: string;
  slug: string;
  code: string;
}) {
  const subject = "Вы партнёр WeSetup — кабинет открыт";
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}>Заявка <strong>${escapeHtml(params.companyName)}</strong> одобрена. Партнёрский кабинет уже доступен — осталось три шага: загрузить логотип и контакты, скопировать ссылку для клиентов, заполнить реквизиты для выплат.</p>
    <div ${BOX}>
      <p style="margin:0 0 8px;color:#18181b"><strong>Ссылка для клиентов:</strong> ${escapeHtml(`${APP_URL}/p/${params.slug}`)}</p>
      <p style="margin:0;color:#18181b"><strong>Код партнёра:</strong> <span style="font-family:monospace;font-size:16px;letter-spacing:2px">${escapeHtml(params.code)}</span></p>
    </div>
    ${button(`${APP_URL}/partner/onboarding`, "Открыть партнёрский кабинет")}
    <p ${MUTED}>Переключиться между своей организацией и партнёрским кабинетом можно в шапке сайта.</p>`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Добро пожаловать в партнёрскую программу", body));
}

export async function sendPartnerRejectedEmail(params: {
  to: string;
  companyName: string;
  comment: string;
}) {
  const subject = "Заявка на партнёрство отклонена — WeSetup";
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}>К сожалению, заявку <strong>${escapeHtml(params.companyName)}</strong> мы пока не одобрили.</p>
    <div ${BOX}>
      <p style="margin:0 0 6px;font-size:13px;color:#71717a">Комментарий</p>
      <p style="margin:0;color:#18181b;line-height:1.6">${escapeHtml(params.comment)}</p>
    </div>
    <p ${P}>Если что-то изменится — подайте заявку заново из настроек организации, раздел «Стать партнёром».</p>`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Заявка отклонена", body));
}

export async function sendPartnerSuspendedEmail(params: {
  to: string;
  companyName: string;
  comment: string;
}) {
  const subject = "Партнёрский кабинет приостановлен — WeSetup";
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}>Партнёрский кабинет <strong>${escapeHtml(params.companyName)}</strong> приостановлен: доступ к клиентам и начисления остановлены до выяснения.</p>
    <div ${BOX}>
      <p style="margin:0 0 6px;font-size:13px;color:#71717a">Комментарий</p>
      <p style="margin:0;color:#18181b;line-height:1.6">${escapeHtml(params.comment)}</p>
    </div>
    <p ${MUTED}>Вопросы — support@wesetup.ru.</p>`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Кабинет приостановлен", body));
}

/** Приглашение клиента от партнёра — с брендом партнёра и ссылкой «Не интересно». */
export async function sendPartnerClientInviteEmail(params: {
  to: string;
  partnerSlug: string;
  brandName: string;
  declineUrl: string;
  contactLine: string | null;
}) {
  const brand: EmailBrand | null = await emailBrandForPartnerSlug(params.partnerSlug);
  const inviteUrl = `${APP_URL}/p/${params.partnerSlug}`;
  const subject = `${params.brandName} приглашает вести журналы СанПиН в WeSetup`;
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}><strong>${escapeHtml(params.brandName)}</strong> предлагает вести электронные журналы СанПиН и ХАССП в WeSetup и сопровождать вас: помогать с настройкой, следить за просрочками и готовить документы к проверкам.</p>
    <div ${BOX}>
      <p style="margin:0 0 8px;color:#3f3f46;font-size:14px">Регистрация бесплатная — 14 дней полного доступа без карты.</p>
      ${params.contactLine ? `<p style="margin:0;color:#3f3f46;font-size:14px">${escapeHtml(params.contactLine)}</p>` : ""}
    </div>
    ${button(inviteUrl, "Зарегистрироваться по ссылке партнёра")}
    <p ${MUTED}>Не интересно? <a href="${params.declineUrl}" style="color:#71717a">Нажмите здесь</a> — и партнёр больше не будет присылать приглашения. Отправитель письма — платформа WeSetup.</p>`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Приглашение от консультанта", body, brand));
}

/** Клиент отвязался — партнёру. */
export async function sendPartnerClientDetachedEmail(params: {
  to: string;
  organizationName: string;
  detachedBy: "client" | "partner" | "admin";
}) {
  const who =
    params.detachedBy === "client"
      ? "Клиент отключил сопровождение"
      : params.detachedBy === "admin"
        ? "Администратор платформы отключил сопровождение"
        : "Сопровождение отключено";
  const subject = `${who}: ${params.organizationName}`;
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}>${escapeHtml(who)} организации <strong>${escapeHtml(params.organizationName)}</strong>. Доступ в кабинет клиента закрыт, новые начисления по нему не идут. История начислений сохранена в разделе «Вознаграждение».</p>
    ${button(`${APP_URL}/partner`, "Открыть партнёрский кабинет")}`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Клиент отключил сопровождение", body));
}

/** Клиент привязался — партнёру. */
export async function sendPartnerClientAttachedEmail(params: {
  to: string;
  organizationName: string;
  accessLevel: "view" | "edit";
}) {
  const subject = `Новый клиент: ${params.organizationName}`;
  const body = `
    <p ${P}>Здравствуйте!</p>
    <p ${P}>Организация <strong>${escapeHtml(params.organizationName)}</strong> подключила ваше сопровождение с уровнем доступа «${
      params.accessLevel === "edit" ? "просмотр и редактирование" : "только просмотр"
    }».</p>
    ${button(`${APP_URL}/partner`, "Открыть список клиентов")}`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Новый клиент", body));
}

/** Приглашение в команду партнёра. */
export async function sendPartnerTeamInviteEmail(params: {
  to: string;
  name: string;
  companyName: string;
  inviteUrl: string;
}) {
  const subject = `Вас добавили в команду партнёра ${params.companyName} — WeSetup`;
  const body = `
    <p ${P}>Здравствуйте, <strong>${escapeHtml(params.name)}</strong>!</p>
    <p ${P}>Вас добавили в команду партнёра <strong>${escapeHtml(params.companyName)}</strong>. После входа в шапке сайта появится переключатель «Партнёрский кабинет».</p>
    ${button(params.inviteUrl, "Установить пароль и войти")}
    <p ${MUTED}>Ссылка действительна 7 дней.</p>`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Команда партнёра", body));
}

/** Клиент написал в онлайн-чат — партнёру, который его сопровождает. */
export async function sendPartnerChatMessageEmail(params: {
  to: string;
  organizationName: string;
  authorName: string | null;
  preview: string;
  threadId: string;
}) {
  const subject = `Новое сообщение от клиента: ${params.organizationName}`;
  const who = params.authorName ? `${params.authorName}, ${params.organizationName}` : params.organizationName;
  const body = `
    <p ${P}>В онлайн-чат написал клиент: <strong>${escapeHtml(who)}</strong>.</p>
    <div ${BOX}>
      <p style="margin:0;color:#18181b;white-space:pre-wrap">${escapeHtml(params.preview)}</p>
    </div>
    ${button(`${APP_URL}/partner/chats?thread=${encodeURIComponent(params.threadId)}`, "Ответить в кабинете партнёра")}
    <p ${MUTED}>Клиент увидит ответ прямо в чате кабинета WeSetup, со звуком и всплывающим уведомлением.</p>`;
  return sendRawEmail(params.to, subject, renderEmailLayout("Сообщение от клиента", body));
}
