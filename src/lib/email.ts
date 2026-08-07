import nodemailer from "nodemailer";
import { escapeHtml } from "@/lib/html-escape";

/**
 * Локальный relay на той же машине. Прод отправляет через exim на
 * 127.0.0.1, а он отдаёт самоподписанный сертификат — проверять его
 * бессмысленно (трафик не покидает хост), но и слать в обход TLS не
 * нужно. Поэтому для петлевых адресов проверку цепочки отключаем,
 * для внешних SMTP — оставляем строгой.
 */
const LOCAL_SMTP_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLocalSmtpHost(): boolean {
  return LOCAL_SMTP_HOSTS.has((process.env.SMTP_HOST ?? "localhost").trim());
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: Number(process.env.SMTP_PORT) || 25,
  secure: false,
  tls: {
    rejectUnauthorized: !isLocalSmtpHost(),
  },
  connectionTimeout: 5000,
  socketTimeout: 5000,
});

const FROM = process.env.SMTP_FROM || "WeSetup <noreply@wesetup.ru>";
const APP_URL = process.env.NEXTAUTH_URL || "https://haccp.magday.ru";

function layout(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
  <tr><td style="background:#18181b;padding:24px 32px">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700">WeSetup</h1>
  </td></tr>
  <tr><td style="padding:32px">
    <h2 style="margin:0 0 16px;font-size:18px;color:#18181b">${title}</h2>
    ${body}
  </td></tr>
  <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7">
    <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center">&copy; 2026 WeSetup. Электронные журналы СанПиН и ХАССП.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Пустой SMTP_HOST (или дефолтный "localhost" без реального relay) =
 * dev-режим. В этом случае не ломаем регистрацию таймаутом на 127.0.0.1:25,
 * а просто логируем тело в консоль. Так разработчик видит код/ссылку
 * приглашения сразу в выводе dev-сервера.
 */
function isSmtpConfigured(): boolean {
  const host = (process.env.SMTP_HOST ?? "").trim();
  return host.length > 0 && host !== "localhost";
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!isSmtpConfigured()) {
    const stripped = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    console.info(
      `[email/dev] SMTP не настроен — письмо не отправлено на ${to}.`
    );
    console.info(`[email/dev] Subject: ${subject}`);
    console.info(`[email/dev] Body:    ${stripped}`);
    return;
  }
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (error) {
    console.error("Email send error:", error);
  }
}

export async function sendVerificationEmail(to: string, code: string) {
  // Dev-mode explicit code line so it's grep'able in the server log
  // separately from the long HTML body stripped above.
  if (!isSmtpConfigured()) {
    console.info(`[email/dev] Код подтверждения для ${to}: ${code}`);
  }
  const subject = `Код подтверждения — WeSetup`;
  const body = `
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Здравствуйте!</p>
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Ваш код подтверждения регистрации:</p>
    <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px;text-align:center">
      <p style="margin:0;font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b">${escapeHtml(code)}</p>
    </div>
    <p style="margin:0;color:#71717a;font-size:13px">Код действителен 10 минут. Если вы не запрашивали регистрацию, проигнорируйте это письмо.</p>`;
  await sendEmail(to, subject, layout(subject, body));
}

export async function sendInviteTokenEmail(params: {
  to: string;
  name: string;
  organizationName: string;
  inviteUrl: string;
}) {
  const { to, name, organizationName, inviteUrl } = params;
  const subject = `Вас пригласили в ${organizationName} — WeSetup`;
  const body = `
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Здравствуйте, <strong>${escapeHtml(name)}</strong>!</p>
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Вас пригласили в организацию <strong>${escapeHtml(organizationName)}</strong>. Нажмите кнопку ниже, чтобы установить пароль и войти.</p>
    <a href="${inviteUrl}" style="display:inline-block;background:#5566f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Установить пароль</a>
    <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa">Ссылка действительна 7 дней. После установки пароля приглашение станет недействительным.</p>`;
  await sendEmail(to, subject, layout(subject, body));
}

export async function sendInviteEmail(params: {
  to: string;
  name: string;
  password: string;
  organizationName: string;
}) {
  const { to, name, password, organizationName } = params;
  const subject = `Вас пригласили в ${organizationName} — WeSetup`;

  const body = `
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Здравствуйте, <strong>${escapeHtml(name)}</strong>!</p>
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Вас пригласили в организацию <strong>${escapeHtml(organizationName)}</strong> для ведения электронных журналов ХАССП.</p>
    <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:13px;color:#71717a">Ваши данные для входа:</p>
      <p style="margin:0 0 4px;color:#18181b"><strong>Email:</strong> ${escapeHtml(to)}</p>
      <p style="margin:0;color:#18181b"><strong>Пароль:</strong> ${escapeHtml(password)}</p>
    </div>
    <a href="${APP_URL}/login" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Войти в систему</a>
    <p style="margin:24px 0 0;font-size:13px;color:#a1a1aa">Рекомендуем сменить пароль после первого входа.</p>`;

  await sendEmail(to, subject, layout("Приглашение в систему", body));
}

export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  organizationName: string;
}) {
  const { to, name, organizationName } = params;
  const subject = "Добро пожаловать в WeSetup!";

  const body = `
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Здравствуйте, <strong>${escapeHtml(name)}</strong>!</p>
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Организация <strong>${escapeHtml(organizationName)}</strong> успешно зарегистрирована. Ваш пробный период — <strong>14 дней</strong> с полным доступом ко всем функциям.</p>
    <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#18181b">С чего начать:</p>
      <p style="margin:0 0 8px;color:#3f3f46;font-size:14px">1. Добавьте производственные зоны в <strong>Настройки → Зоны</strong></p>
      <p style="margin:0 0 8px;color:#3f3f46;font-size:14px">2. Добавьте оборудование в <strong>Настройки → Оборудование</strong></p>
      <p style="margin:0 0 8px;color:#3f3f46;font-size:14px">3. Заполните первый журнал в разделе <strong>Журналы</strong></p>
      <p style="margin:0;color:#3f3f46;font-size:14px">4. Пригласите сотрудников в <strong>Настройки → Сотрудники</strong></p>
    </div>
    <a href="${APP_URL}/dashboard" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Перейти в панель</a>`;

  await sendEmail(to, subject, layout("Добро пожаловать!", body));
}

/**
 * Письмо после успешной оплаты через Робокассу.
 *
 * Новому клиенту уходит ссылка с одноразовым токеном на достройку
 * профиля (название организации, имя, пароль), существующему —
 * подтверждение продления со ссылкой на вход.
 */
export async function sendPaymentReceiptEmail(params: {
  to: string;
  amountRub: number;
  description: string;
  actionUrl: string;
  isNewClient: boolean;
  subscriptionEnd: Date;
}) {
  const { to, amountRub, description, actionUrl, isNewClient, subscriptionEnd } =
    params;
  const subject = isNewClient
    ? "Оплата получена — завершите настройку"
    : "Оплата получена — подписка продлена";
  const amount = new Intl.NumberFormat("ru-RU").format(amountRub) + " ₽";
  const until = subscriptionEnd.toLocaleDateString("ru-RU");

  const body = `
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Здравствуйте!</p>
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Мы получили вашу оплату. Спасибо!</p>
    <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="margin:0 0 8px;color:#3f3f46;font-size:14px">Тариф: <strong>${escapeHtml(description)}</strong></p>
      <p style="margin:0 0 8px;color:#3f3f46;font-size:14px">Сумма: <strong>${escapeHtml(amount)}</strong></p>
      <p style="margin:0;color:#3f3f46;font-size:14px">Подписка действует до: <strong>${escapeHtml(until)}</strong></p>
    </div>
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">${
      isNewClient
        ? "Осталось задать пароль и указать название организации — это займёт минуту."
        : "Подписка вашей организации продлена, дополнительных действий не требуется."
    }</p>
    <a href="${actionUrl}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">${
      isNewClient ? "Завершить настройку" : "Войти в кабинет"
    }</a>
    <p style="margin:24px 0 0;color:#71717a;font-size:13px">Вопросы по оплате и возврату — support@wesetup.ru.</p>`;

  await sendEmail(to, subject, layout(subject, body));
}

export async function sendFeedbackAdminEmail(params: {
  to: string;
  type: "bug" | "suggestion";
  message: string;
  userName?: string | null;
  userEmail?: string | null;
  organizationName?: string | null;
  phone?: string | null;
  submittedAt?: Date;
}) {
  const {
    to,
    type,
    message,
    userName,
    userEmail,
    organizationName,
    phone,
    submittedAt,
  } = params;
  const typeLabel = type === "bug" ? "Ошибка" : "Предложение";
  const typeColor = type === "bug" ? "#dc2626" : "#5566f6";
  const typeBg = type === "bug" ? "#fef2f2" : "#eef1ff";
  const typeBorder = type === "bug" ? "#fecaca" : "#c7ccea";
  const whenLabel = (submittedAt ?? new Date()).toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
  });
  const subject = `[Feedback · ${typeLabel}] ${userName ?? userEmail ?? "Анонимно"}`;

  const row = (label: string, value: string | null | undefined) =>
    value
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;width:140px">${escapeHtml(label)}</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#18181b">${escapeHtml(value)}</td></tr>`
      : "";

  const body = `
    <div style="background:${typeBg};border:1px solid ${typeBorder};border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${typeColor}">${typeLabel}</p>
      <p style="margin:0;white-space:pre-wrap;color:#18181b;font-size:14px;line-height:1.55">${escapeHtml(message)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
      ${row("Отправитель", userName)}
      ${row("Email", userEmail)}
      ${row("Организация", organizationName)}
      ${row("Телефон для ответа", phone)}
      <tr><td style="padding:8px 0;color:#71717a;font-size:13px">Время</td><td style="padding:8px 0;color:#18181b">${whenLabel}</td></tr>
    </table>
    <a href="${APP_URL}/root/feedback" style="display:inline-block;background:#5566f6;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Открыть панель обращений</a>`;

  await sendEmail(to, subject, layout(`Обратная связь — ${typeLabel}`, body));
}

export async function sendDeviationAlertEmail(params: {
  to: string;
  journalName: string;
  journalCode: string;
  deviationType: string;
  details: string;
  filledBy: string;
}) {
  const { to, journalName, journalCode, deviationType, details, filledBy } = params;
  const subject = `⚠ ${deviationType} — ${journalName}`;

  const body = `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#dc2626">${escapeHtml(deviationType)}</p>
      <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.6">${escapeHtml(details)}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;width:140px">Журнал</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#18181b;font-weight:600">${escapeHtml(journalName)}</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px">Записал</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#18181b">${escapeHtml(filledBy)}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a;font-size:13px">Время</td><td style="padding:8px 0;color:#18181b">${new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</td></tr>
    </table>
    <a href="${APP_URL}/journals/${encodeURIComponent(journalCode)}" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Открыть журнал</a>`;

  await sendEmail(to, subject, layout("Отклонение зафиксировано", body));
}

export async function sendComplianceReminderEmail(params: {
  to: string;
  missingJournals: string[];
  organizationName: string;
}) {
  const { to, missingJournals, organizationName } = params;
  const subject = `📋 Незаполненные журналы — ${organizationName}`;

  const listHtml = missingJournals
    .map((j) => `<li style="margin:0 0 4px;color:#18181b;font-size:14px">${escapeHtml(j)}</li>`)
    .join("");

  const body = `
    <p style="margin:0 0 16px;color:#3f3f46;line-height:1.6">Следующие обязательные журналы не были заполнены сегодня:</p>
    <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:20px;margin:0 0 24px">
      <ul style="margin:0;padding:0 0 0 20px">${listHtml}</ul>
    </div>
    <a href="${APP_URL}/journals" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Заполнить журналы</a>`;

  await sendEmail(to, subject, layout("Напоминание о журналах", body));
}

export async function sendTemperatureAlertEmail(params: {
  to: string;
  equipmentName: string;
  temperature: number;
  tempMin: number | null;
  tempMax: number | null;
  areaName?: string;
  filledBy: string;
}) {
  const { to, equipmentName, temperature, tempMin, tempMax, areaName, filledBy } = params;
  const subject = `⚠ Нарушение температуры: ${equipmentName}`;

  const limitsText = tempMin != null && tempMax != null
    ? `${tempMin}°C — ${tempMax}°C`
    : tempMin != null ? `от ${tempMin}°C` : `до ${tempMax}°C`;

  const body = `
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#dc2626">Температура вне нормы!</p>
      <p style="margin:0;color:#7f1d1d;font-size:14px;line-height:1.6">Зафиксировано отклонение температуры. Требуется корректирующее действие.</p>
    </div>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px;width:140px">Оборудование</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#18181b;font-weight:600">${escapeHtml(equipmentName)}</td></tr>
      ${areaName ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px">Зона</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#18181b">${escapeHtml(areaName)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px">Факт. температура</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#dc2626;font-weight:700;font-size:18px">${escapeHtml(temperature)}°C</td></tr>
      <tr><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#71717a;font-size:13px">Допустимый диапазон</td><td style="padding:8px 0;border-bottom:1px solid #e4e4e7;color:#18181b">${escapeHtml(limitsText)}</td></tr>
      <tr><td style="padding:8px 0;color:#71717a;font-size:13px">Записал</td><td style="padding:8px 0;color:#18181b">${escapeHtml(filledBy)}</td></tr>
    </table>
    <a href="${APP_URL}/journals/temp_control" style="display:inline-block;background:#18181b;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Открыть журнал</a>`;

  await sendEmail(to, subject, layout("Температурный алерт", body));
}
