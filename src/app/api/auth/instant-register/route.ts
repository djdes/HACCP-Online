import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { issueSession } from "@/lib/issue-session";
import { sendAccountPasswordEmail } from "@/lib/email";
import { attachAccountForNewOrganization } from "@/lib/create-organization";
import { escapeTelegramHtml } from "@/lib/telegram";
import { notifyPlatformAdmin } from "@/lib/platform-admin";
import { registrationCodeRateLimiter } from "@/lib/rate-limit";
import { domainAcceptsMail } from "@/lib/mail-domain";
import { DEFAULT_ORG_NAME } from "@/lib/org-profile";
import { defaultDisabledCodesFor } from "@/lib/sphere-journal-rules";
import { defaultJournalAutomationJson } from "@/lib/journal-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Мгновенная регистрация с лендинга: человек вводит почту — аккаунт
 * создаётся сразу, вход происходит автоматически, пароль уходит письмом.
 * Анкета (организация, имя, телефон) заполняется уже внутри кабинета.
 *
 * Только POST и только по явному клику: если бы аккаунт заводился при
 * GET-заходе на `/register?email=…`, любой краулер или префетч ссылки
 * плодил бы пустые организации и рассылал письма живым людям.
 */

/** Без похожих символов: 0/O, 1/l/I — пароль диктуют по телефону. */
const PASSWORD_ALPHABET =
  "23456789abcdefghjkmnpqrstuvwxyzACDEFHJKLMNPRTUVWXY";
const PASSWORD_LENGTH = 12;
const TRIAL_DAYS = 14;
// Название-заглушка живёт в org-profile: по нему кабинет понимает,
// что анкета ещё не заполнена (см. (dashboard)/layout.tsx).

function generatePassword(): string {
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)];
  }
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || "unknown";
  // Для rate-limit «unknown» — рабочий ключ, для БД это мусор: пусть
  // лучше стоит NULL, чем строка, по которой ROOT ничего не найдёт.
  const ipForLog = ip === "unknown" ? null : ip;

  const body = await request.json().catch(() => null);
  const email =
    typeof (body as { email?: unknown } | null)?.email === "string"
      ? (body as { email: string }).email.trim().toLowerCase()
      : "";

  // Мусор отсекаем ДО расхода лимита, чтобы бот пустыми запросами не
  // выжигал квоту живому пользователю с того же IP (общий офисный NAT).
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Укажите корректный адрес электронной почты" },
      { status: 400 },
    );
  }

  if (!registrationCodeRateLimiter.consume(`instant:${ip}`)) {
    return NextResponse.json(
      { error: "Слишком часто. Попробуйте через несколько минут" },
      { status: 429 },
    );
  }

  // Домен обязан принимать почту. Проверка в поле ввода — для удобства,
  // а здесь она обязательна: пароль существует только в письме, и на
  // несуществующий домен уйдёт в никуда вместе с доступом к аккаунту.
  if (!(await domainAcceptsMail(email.split("@")[1] ?? ""))) {
    return NextResponse.json(
      {
        error:
          "Такого почтового домена не существует — проверьте адрес. Письмо с паролем на него не дойдёт",
      },
      { status: 400 },
    );
  }

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    // Факт существования аккаунта и так раскрывался прежним визардом
    // (409 в register/request), поэтому здесь ничего нового не утекает —
    // зато человек сразу попадает на вход с подсказкой.
    return NextResponse.json({ exists: true });
  }

  const password = generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          // Нейтральная заглушка: почта в названии протекала
          // в шапку кабинета, PDF-выгрузки и селектор организаций.
          // Настоящее название человек задаёт в анкете после входа.
          name: DEFAULT_ORG_NAME,
          type: "other",
          // Сразу минимальный набор журналов, а не все 35: иначе до
          // анкеты дашборд встречает человека счётчиком «0 из 35».
          // Сферу спросим в анкете — тогда набор пересчитается.
          disabledJournalCodes: defaultDisabledCodesFor("other"),
          // Автоматика гигиенического журнала — сразу, см.
          // defaultJournalAutomationJson.
          journalAutomationJson: defaultJournalAutomationJson(),
          subscriptionPlan: "trial",
          subscriptionEnd: new Date(
            Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      });
      const user = await tx.user.create({
        data: {
          email,
          // Имя пока равно почте — по этому признаку кабинет понимает,
          // что анкета не заполнена, и показывает баннер «Завершите
          // регистрацию».
          name: email,
          passwordHash,
          role: "manager",
          organizationId: organization.id,
          journalAccessMigrated: true,
          // Регистрация с лендинга сразу же и логинит человека, поэтому
          // адрес пишем в оба поля: первый вход — он же и есть.
          registrationIp: ipForLog,
          lastLoginIp: ipForLog,
          lastLoginAt: new Date(),
        },
      });
      // Аккаунт — владелец тарифа и общего лимита мест. Заводим сразу:
      // без него организация не умеет ни переключаться, ни расти во
      // вторую точку (см. lib/create-organization.ts).
      await attachAccountForNewOrganization(tx, {
        ownerUserId: user.id,
        organizationId: organization.id,
        subscriptionPlan: organization.subscriptionPlan,
        subscriptionEnd: organization.subscriptionEnd,
      });
      return { organization, user };
    });
  } catch (error) {
    // Гонка двух одновременных сабмитов с одной почтой: unique-индекс
    // на email не даст создать дубль — отправляем на вход.
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ exists: true });
    }
    console.error("instant-register failed", error);
    return NextResponse.json(
      { error: "Не получилось создать аккаунт. Попробуйте ещё раз" },
      { status: 500 },
    );
  }

  // Письмо и уведомление — не блокируют вход: пользователь уже в кабинете,
  // упавшая почта не должна оборачиваться ошибкой регистрации.
  sendAccountPasswordEmail({ to: email, password }).catch((err) =>
    console.error("sendAccountPasswordEmail failed", err),
  );
  notifyOwner(email).catch((err) =>
    console.error("instant-register telegram notify failed", err),
  );

  return issueSession(
    NextResponse.json({ ok: true, created: true }),
    created.user,
    created.organization.name,
  );
}

async function notifyOwner(email: string): Promise<void> {
  // Единая точка админ-уведомлений: регистрации и обращения больше не
  // разъезжаются по двум разным chat id из разных env-переменных.
  await notifyPlatformAdmin(
    [
      "🆕 Новая регистрация с лендинга",
      `Почта: ${escapeTelegramHtml(email)}`,
    ].join("\n"),
    { kind: "registration" },
  );
}
