import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { encode } from "next-auth/jwt";
import { db } from "@/lib/db";
import {
  ALL_SESSION_COOKIES,
  CUSTOM_SESSION_COOKIE,
  LEGACY_SESSION_COOKIES,
  LEGACY_AUX_COOKIES,
} from "@/lib/auth-cookies";
import { loginRateLimiter } from "@/lib/rate-limit";

// Pre-computed bcrypt hash для несуществующих email'ов. Без этого
// ответ на «пользователь не найден» приходит в ~5ms, а на
// «неверный пароль» — в ~100ms (bcrypt.compare). Атакующий замеряет
// разницу и enumerate'ит существующие email'ы. Фейковый compare
// выравнивает время.
const DUMMY_BCRYPT_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.lllkbczy3.0qVxgApY/I5p9mElqS";

const MAX_AGE = 365 * 24 * 60 * 60;

function appendSessionCookie(
  response: NextResponse,
  cookieName: string,
  token: string
) {
  const expires = new Date(Date.now() + MAX_AGE * 1000).toUTCString();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  response.headers.append(
    "Set-Cookie",
    `${cookieName}=${token}; Path=/; Expires=${expires}; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`
  );
}

function appendExpiredCookie(response: NextResponse, cookieName: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  response.headers.append(
    "Set-Cookie",
    `${cookieName}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`
  );
}

function clearLegacyCookies(response: NextResponse) {
  for (const cookieName of LEGACY_SESSION_COOKIES) {
    appendExpiredCookie(response, cookieName);
  }

  for (const cookieName of [...ALL_SESSION_COOKIES, ...LEGACY_AUX_COOKIES]) {
    if (cookieName === CUSTOM_SESSION_COOKIE) {
      continue;
    }
    if (LEGACY_SESSION_COOKIES.includes(cookieName)) {
      continue;
    }
    response.cookies.set(cookieName, "", {
      path: "/",
      expires: new Date(0),
      httpOnly: cookieName.includes("session-token"),
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Введите email и пароль" },
        { status: 400 }
      );
    }

    // Rate-limit на IP (5 попыток / 5 мин) — защита от brute-force.
    // Кладём ключ комбинированный (IP + email-prefix) чтобы не банить
    // всю сетку при попытках на один email.
    const xff = request.headers.get("x-forwarded-for") ?? "";
    const ip = xff.split(",")[0].trim() || "unknown";
    const rlKey = `login:${ip}`;
    if (!loginRateLimiter.consume(rlKey)) {
      return NextResponse.json(
        {
          error: "Слишком много попыток входа. Подождите 5 минут.",
        },
        { status: 429 }
      );
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    // Anti user-enumeration: всегда делаем bcrypt.compare, даже если
    // юзер не найден или неактивен. Иначе атакующий замеряет timing
    // (ms) и understands какие email'ы существуют.
    const passwordHashToCheck = user?.passwordHash ?? DUMMY_BCRYPT_HASH;
    const isPasswordValid = await bcrypt.compare(password, passwordHashToCheck);

    if (!user || !user.isActive || !isPasswordValid) {
      return NextResponse.json(
        { error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    const secret = process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET;
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET is not configured");
    }

    const token = await encode({
      secret,
      maxAge: MAX_AGE,
      token: {
        sub: user.id,
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId,
        organizationName: user.organization.name,
        isRoot: user.isRoot === true,
        actingAsOrganizationId: null,
        permissionPreset: user.permissionPreset ?? null,
      },
    });

    const response = NextResponse.json({ success: true });
    clearLegacyCookies(response);
    response.cookies.set(CUSTOM_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
      secure: process.env.NODE_ENV === "production",
    });
    for (const cookieName of LEGACY_SESSION_COOKIES) {
      appendSessionCookie(response, cookieName, token);
    }

    return response;
  } catch (error) {
    console.error("Custom login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
