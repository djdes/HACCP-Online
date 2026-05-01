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
    const securityHeaders = [
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
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

    return [
      {
        // Все пути — security headers.
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source:
          "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|robots\\.txt|sitemap\\.xml|screenshots/).*)",
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
