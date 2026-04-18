import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getActiveOrgId } from "@/lib/auth-helpers";
import { getServerSession } from "@/lib/server-session";
import {
  botInviteExpiresAt,
  buildBotInviteUrl,
  generateBotInviteRaw,
  hashBotInviteToken,
} from "@/lib/bot-invite-tokens";
import {
  isManagerRole,
  toCanonicalUserRole,
  USER_ROLE_VALUES,
} from "@/lib/user-roles";

/**
 * POST /api/users/invite/tg
 *
 * Sibling of POST /api/users/invite — intentionally a separate route because
 * the semantics differ significantly:
 *
 *   - No email is required and none is sent.
 *   - `passwordHash` stays empty forever (the user authenticates via the
 *     Telegram `initData` signature instead of a password).
 *   - A `BotInviteToken` row (not `InviteToken`) carries the single-use
 *     deep-link token.
 *   - The response includes a ready-to-share URL + inline QR PNG so the
 *     manager can hand it off via any channel (SMS, WhatsApp, show screen).
 *
 * A deterministic stub email (`tg-<cuid>@invite.local`) is written because
 * the User table enforces a unique email and changing that constraint for
 * this flow alone would regress existing dashboards.
 */
const schema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  role: z.enum(USER_ROLE_VALUES, { message: "Выберите роль" }),
  phone: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
    }
    if (!isManagerRole(session.user.role) && !session.user.isRoot) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    if (!process.env.TELEGRAM_BOT_USERNAME) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_USERNAME не настроен на сервере" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const data = schema.parse(body);

    const raw = generateBotInviteRaw();
    const tokenHash = hashBotInviteToken(raw);
    const expiresAt = botInviteExpiresAt();
    const organizationId = getActiveOrgId(session);

    const { user } = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          // Stub email: unique + never used for routing (no email ever sent).
          email: `tg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@invite.local`,
          name: data.name,
          passwordHash: "",
          role: toCanonicalUserRole(data.role),
          phone: data.phone || null,
          organizationId,
          isActive: false,
        },
      });
      await tx.botInviteToken.create({
        data: {
          userId: user.id,
          organizationId,
          tokenHash,
          expiresAt,
        },
      });
      return { user };
    });

    const inviteUrl = buildBotInviteUrl(raw);
    const qrPngDataUrl = await QRCode.toDataURL(inviteUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
        },
        inviteUrl,
        qrPngDataUrl,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Некорректные данные", details: error.issues },
        { status: 400 }
      );
    }
    console.error("TG invite error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
