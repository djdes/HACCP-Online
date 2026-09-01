import { NextResponse, after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sendFeedbackAdminEmail } from "@/lib/email";
import { getPlatformAdminEmail, notifyPlatformAdmin } from "@/lib/platform-admin";
import { escapeHtml } from "@/lib/html-escape";
import { clientIp } from "@/lib/client-ip";
import {
  guestSignature,
  normalizeContact,
  publicContactLimiter,
} from "@/lib/public-support";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXTAUTH_URL || "https://wesetup.ru";

const schema = z.object({
  type: z.enum(["bug", "suggestion", "partnership"], {
    message: "Выберите тип обращения",
  }),
  message: z
    .string()
    .trim()
    .min(3, "Сообщение слишком короткое")
    .max(4000, "Сообщение слишком длинное"),
  email: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  /// Ловушка для ботов: настоящий человек этого поля не видит.
  company: z.string().max(200).optional().or(z.literal("")),
});

const TYPE_LABELS: Record<string, string> = {
  bug: "🐞 Ошибка",
  suggestion: "💡 Улучшение",
  partnership: "🤝 Сотрудничество",
};

/**
 * POST /api/public/feedback — обращение с лендинга, без авторизации.
 *
 * Отличие от `/api/feedback` только в том, кто пишет: у гостя нет ни
 * аккаунта, ни организации, поэтому вместо профиля в отчёт идут
 * оставленные им контакты, а `source` = "landing" — чтобы в панели
 * обращений эти строки отличались от обращений изнутри кабинета.
 */
export async function POST(request: Request) {
  let parsed;
  try {
    parsed = schema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Некорректные данные" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Не удалось прочитать запрос" },
      { status: 400 }
    );
  }

  // Ловушка сработала — отвечаем как при успехе. Бот не должен понять,
  // что его отсекли, иначе следующий заход будет обходить проверку.
  if (parsed.company) return NextResponse.json({ ok: true });

  const contact = normalizeContact(parsed);
  if (!contact.email && !contact.phone) {
    return NextResponse.json(
      { error: "Оставьте телефон или почту — иначе некуда ответить" },
      { status: 400 }
    );
  }
  if (contact.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email)) {
    return NextResponse.json({ error: "Проверьте адрес почты" }, { status: 400 });
  }

  const ip = clientIp(request) ?? "unknown";
  if (!publicContactLimiter.consume(`feedback:${ip}`)) {
    return NextResponse.json(
      { error: "Слишком много обращений подряд. Попробуйте через 10 минут" },
      { status: 429 }
    );
  }

  const report = await db.feedbackReport.create({
    data: {
      userId: null,
      userEmail: contact.email,
      userName: null,
      organizationId: null,
      organizationName: null,
      type: parsed.type,
      source: "landing",
      message: parsed.message,
      phone: contact.phone,
    },
  });

  after(async () => {
    const lines = [
      `<b>${TYPE_LABELS[parsed.type] ?? parsed.type}</b> · с лендинга`,
      "",
      escapeHtml(parsed.message),
      "",
      `👤 ${escapeHtml(guestSignature(contact))}`,
      "",
      `#fb_${report.id}`,
      `<a href="${APP_URL}/root/feedback">Открыть панель обращений</a>`,
    ];

    const adminEmail = getPlatformAdminEmail();
    const [telegramOk, emailOk] = await Promise.all([
      notifyPlatformAdmin(lines.join("\n"), { kind: "feedback" }).catch(
        (error) => {
          console.error("Public feedback telegram failed:", error);
          return false;
        }
      ),
      adminEmail
        ? sendFeedbackAdminEmail({
            to: adminEmail,
            type: parsed.type,
            message: parsed.message,
            userName: null,
            userEmail: contact.email,
            organizationName: null,
            phone: contact.phone,
            submittedAt: report.createdAt,
          }).catch((error) => {
            console.error("Public feedback email failed:", error);
            return false;
          })
        : Promise.resolve(false),
    ]);

    try {
      await db.feedbackReport.update({
        where: { id: report.id },
        data: {
          adminTgNotifiedAt: telegramOk ? new Date() : null,
          adminEmailedAt: emailOk ? new Date() : null,
        },
      });
    } catch (error) {
      console.error("Public feedback delivery status update failed:", error);
    }
  });

  return NextResponse.json({ ok: true });
}
