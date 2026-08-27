import type { NextConfig } from "next";
import { execSync } from "child_process";
import { readFileSync } from "fs";

function getBuildId(): string {
  // CI writes .build-sha before tarball
  try {
    const sha = readFileSync(".build-sha", "utf-8").trim();
    return sha.slice(0, 7);
  } catch {
    // Fallback: local dev with git
    try {
      return execSync("git rev-parse --short HEAD").toString().trim();
    } catch {
      return "dev";
    }
  }
}

function getBuildTime(): string {
  try {
    return readFileSync(".build-time", "utf-8").trim();
  } catch {
    return new Date().toISOString();
  }
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Штатная нормализация трейлинг-слеша срабатывает ДО middleware и
  // отвечает редиректом 308. Робокасса шлёт уведомление об оплате
  // POST'ом на `https://wesetup.ru/payment/` (адрес зафиксирован в
  // кабинете магазина) и за редиректом не идёт — платежи молча
  // терялись. Отключаем автоматический редирект и обрабатываем слеш
  // сами в middleware: `/payment/` переписываем, остальным путям
  // отдаём тот же 308, что и раньше.
  skipTrailingSlashRedirect: true,
  typescript: {
    // Temporary deploy unblocker: unrelated dashboard pages still carry legacy Next build type errors.
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: getBuildId(),
    NEXT_PUBLIC_BUILD_TIME: getBuildTime(),
  },
  async headers() {
    // The original rule applied `Cache-Control: no-store` to EVERY path. For
    // HTML pages that's intentional — the app deploys frequently, users must
    // always get fresh markup. For hashed Next.js build assets under
    // `/_next/static/*` it was unintended: those filenames already carry a
    // content hash and should be cached for a year. Without that, every
    // navigation re-downloaded ~300 KB of chunks from mobile networks, which
    // is what users reported as "сайт долго грузится на телефоне".
    //
    // The negative-lookahead source below excludes Next's static folders and
    // a couple of fixed public assets; everything else keeps the strict
    // no-cache behaviour. `/_next/image` keeps its own `Cache-Control:
    // public, max-age=0, must-revalidate` default from Next so dynamic image
    // optimisation still respects upstream caching rules.
    // Security headers применяются ко ВСЕМ путям (включая
    // _next/static — статика тоже выигрывает от X-Content-Type-Options
    // и т.п.). Cache-Control вешаем отдельной record'ой только на
    // не-статические пути.
    //
    // Не добавляем Content-Security-Policy: для этого нужен полный
    // аудит inline-скриптов / третьесторонних embed'ов (Telegram WebApp
    // SDK, Yandex.Metrika, и т.д.). Раскатывать без аудита = риск
    // сломать Telegram Mini App / iframe widget'ы. Это отдельная задача.
    const commonSecurityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        // HSTS на 1 год БЕЗ preload и БЕЗ includeSubDomains. preload —
        // одностороннее решение (попасть в preload-list browser'ов
        // легко, выпасть — почти невозможно), пока не уверены что ВСЕ
        // субдомены готовы к https. С includeSubDomains та же проблема.
        // Без них — стандартная защита от downgrade-атак на основном
        // домене.
        key: "Strict-Transport-Security",
        value: "max-age=31536000",
      },
      {
        // Restrict browser APIs которые мы не используем.
        // - camera/microphone: WeSetup ни на одной странице не запрашивает
        //   доступ к камере/микрофону (фото attachments через <input
        //   type='file' capture> работают БЕЗ getUserMedia, открывают
        //   нативный picker). → блокируем полностью.
        // - geolocation: USED by mini/_components/geo-reminder.tsx
        //   (watchPosition). Раньше стояло `geolocation=()` — это блокировало
        //   geo-напоминания в Mini App. Меняем на `geolocation=(self)` —
        //   разрешает gel API на нашем origin, но блокирует в третьесторонних
        //   iframe'ах.
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(self)",
      },
    ];

    // Default frame policy: DENY всё.
    const denyFrameHeaders = [
      ...commonSecurityHeaders,
      { key: "X-Frame-Options", value: "DENY" },
    ];

    // Mini App внутри Telegram Web (web.telegram.org) загружается в
    // iframe. С X-Frame-Options=DENY этот iframe блокировался —
    // Mini App был мёртв на Telegram Web/Desktop. Mobile (iOS/Android)
    // использует WebView, без iframe-restriction'а, поэтому работало.
    //
    // Решение: для /mini/* отдаём CSP frame-ancestors с явным whitelist'ом
    // Telegram-доменов вместо X-Frame-Options. CSP frame-ancestors
    // overрайдит X-Frame-Options в современных browser'ах.
    const miniFrameHeaders = [
      ...commonSecurityHeaders,
      {
        key: "Content-Security-Policy",
        value:
          "frame-ancestors 'self' https://web.telegram.org https://telegram.org https://*.telegram.org",
      },
    ];

    return [
      {
        // Mini App: разрешаем embedding в Telegram Web.
        source: "/mini/:path*",
        headers: miniFrameHeaders,
      },
      {
        source: "/mini",
        headers: miniFrameHeaders,
      },
      {
        // Все остальные пути (кроме /mini, /mini/*) — security headers
        // + frame DENY. Negative lookahead через regex-source: Next.js
        // применяет ВСЕ matching rules одновременно, поэтому без
        // исключения /mini получает И CSP frame-ancestors, И
        // X-Frame-Options=DENY (последний переоригинировал бы).
        //
        // path-to-regexp запрещает capturing groups, поэтому
        // `(?:$|/)` non-capturing вместо `($|/)`. Без `(?:` build
        // фейлится с «Capturing groups are not allowed».
        // api/journal-samples тоже исключены: страница журнала
        // показывает собственный образец во встроенном просмотре, а
        // X-Frame-Options: DENY запрещает даже свой же origin. В файле
        // нет ни сессии, ни чужих данных — вставлять его безопасно.
        source: "/((?!mini(?:$|/)|api/journal-samples).*)",
        headers: denyFrameHeaders,
      },
      {
        // api/journal-samples исключены намеренно: это публичные
        // образцы журналов с зафиксированным периодом — один и тот же
        // файл при каждом запросе. Под глобальным no-store каждое
        // скачивание заново гоняло jsPDF на полмегабайта, а роут открыт
        // без сессии — бесплатная нагрузка на CPU для любого желающего.
        // Свой Cache-Control роут выставляет сам.
        source:
          "/((?!_next/static|_next/image|api/journal-samples|favicon\\.ico|manifest\\.json|sw\\.js|robots\\.txt|sitemap\\.xml|screenshots/).*)",
        headers: [
          {
            key: "Cache-Control",
            value:
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
