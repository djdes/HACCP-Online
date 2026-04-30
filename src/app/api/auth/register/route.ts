import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEPRECATED — legacy direct-register endpoint без email-верификации
 * и без rate-limit'а. Подменён двухшаговым flow:
 *   1) POST /api/auth/register/request — отправка 6-значного кода
 *      на email (rate-limited)
 *   2) POST /api/auth/register/confirm — проверка кода + создание
 *      Organization + User
 *
 * Старый endpoint оставляли для обратной совместимости, но он
 * принимал arbitrary email БЕЗ proof-of-ownership (бот регистрировал
 * компанию на чужой адрес) и не имел rate-limit'а (флуд DB новыми
 * org-записями). UI на /register уже год использует новый flow.
 *
 * Возвращаем 410 Gone — клиент видит что endpoint удалён и должен
 * мигрировать на /register/request.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Этот endpoint устарел. Используйте /api/auth/register/request " +
        "+ /api/auth/register/confirm (двухшаговая регистрация с email-верификацией).",
      migrate: {
        step1: "/api/auth/register/request",
        step2: "/api/auth/register/confirm",
      },
    },
    { status: 410 }
  );
}
