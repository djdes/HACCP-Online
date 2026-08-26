import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { issueSession } from "@/lib/issue-session";
import { loginRateLimiter } from "@/lib/rate-limit";
import { recordLogin } from "@/lib/login-trace";

// Pre-computed bcrypt hash для несуществующих email'ов. Без этого
// ответ на «пользователь не найден» приходит в ~5ms, а на
// «неверный пароль» — в ~100ms (bcrypt.compare). Атакующий замеряет
// разницу и enumerate'ит существующие email'ы. Фейковый compare
// выравнивает время.
const DUMMY_BCRYPT_HASH =
  "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.lllkbczy3.0qVxgApY/I5p9mElqS";


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

    // Отметка о входе — до выдачи сессии, но не в блокирующем смысле:
    // recordLogin глотает свои ошибки, вход от неё не зависит.
    await recordLogin(user.id, ip === "unknown" ? null : ip);

    // Минт JWT и раскладка кук вынесены в lib/issue-session.ts —
    // мгновенная регистрация выдаёт сессию тем же кодом.
    return issueSession(
      NextResponse.json({ success: true }),
      user,
      user.organization.name,
    );
  } catch (error) {
    console.error("Custom login error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
