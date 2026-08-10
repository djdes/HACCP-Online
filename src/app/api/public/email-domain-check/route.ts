import { NextResponse } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { domainAcceptsMail } from "@/lib/mail-domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Существует ли домен и принимает ли он почту.
 *
 * Списком популярных опечаток все случаи не закрыть: корпоративные
 * адреса набирают с ошибкой ровно так же, а угадать их нельзя. Поэтому
 * последнее слово — за DNS: если у домена нет ни MX, ни A-записи, письмо
 * с паролем гарантированно никуда не уйдёт, и регистрировать такой
 * адрес бессмысленно.
 *
 * Результат кэшируем в памяти процесса: домены у людей повторяются
 * (gmail.com, mail.ru), а DNS-запрос на каждый символ ввода — лишний.
 */

const lookupRateLimiter = createRateLimiter({
  // Ввод идёт с debounce, 60 проверок в минуту с IP — с запасом для
  // живого человека и тесно для перебора.
  tokensPerInterval: 60,
  intervalMs: 60_000,
});

type CacheEntry = { ok: boolean; at: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export async function GET(request: Request) {
  const xff = request.headers.get("x-forwarded-for") ?? "";
  const ip = xff.split(",")[0].trim() || "unknown";
  if (!lookupRateLimiter.consume(`domain:${ip}`)) {
    // Не блокируем форму из-за собственного лимита: считаем домен
    // валидным, финальную проверку всё равно делает регистрация.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const domain = (
    new URL(request.url).searchParams.get("domain") ?? ""
  )
    .trim()
    .toLowerCase();

  if (!domain || domain.length > 253 || !DOMAIN_RE.test(domain)) {
    return NextResponse.json({ ok: false, reason: "malformed" });
  }

  const cached = cache.get(domain);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ ok: cached.ok, cached: true });
  }

  // Хелпер намеренно «мягкий»: при сбое резолвера отвечает «домен в
  // порядке», чтобы наша же инфраструктура не блокировала регистрацию.
  const ok = await domainAcceptsMail(domain);

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(domain, { ok, at: Date.now() });

  return NextResponse.json({ ok });
}
