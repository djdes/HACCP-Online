import { NextResponse } from "next/server";

import { issueMagicLink } from "@/lib/magic-link";
import { registrationCodeRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { email } — письмо со ссылкой для входа. Ответ всегда 200: почты не перебираются. */
export async function POST(request: Request) {
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || "unknown";
  if (!registrationCodeRateLimiter.consume(`magic:${ip}`)) {
    return NextResponse.json({ error: "Слишком часто. Попробуйте через несколько минут" }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 200 || !email.includes("@")) {
    return NextResponse.json({ error: "Введите почту" }, { status: 400 });
  }
  await issueMagicLink(email).catch((error) => console.error("[magic-link] issue failed", error));
  return NextResponse.json({ ok: true });
}
