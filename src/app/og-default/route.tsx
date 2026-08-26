import { ImageResponse } from "next/og";

// nodejs runtime: edge runtime требует wasm-bundle для resvg который
// не залит в deploy.tar (видим как ENOENT на проде). Node.js использует
// нативный @resvg/resvg-js / sharp без wasm. Чуть больше RAM на cold-
// start, но безопасно и работает out of the box.
export const runtime = "nodejs";
export const contentType = "image/png";
export const dynamic = "force-static";
export const revalidate = false;

const SIZE = { width: 1200, height: 630 } as const;

/**
 * Дефолтная OG-картинка для соцсетей. 1200×630 (рекомендованный
 * Facebook/LinkedIn размер, 1.91:1) и работает с
 * twitter:card=summary_large_image. Раньше был квадрат 512×512 — его
 * крашили все соцсети, и Telegram показывал серый плейсхолдер.
 *
 * Кэшируется на edge раз и навсегда (revalidate=false). Когда нужно
 * обновить — меняем cache-buster в URL в meta-defaults.ts.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "70px 80px",
          background:
            "linear-gradient(135deg, #0b1024 0%, #1a2147 50%, #2d2670 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -180,
            left: -120,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: "#5566f6",
            opacity: 0.35,
            filter: "blur(120px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -200,
            right: -180,
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: "#7a5cff",
            opacity: 0.3,
            filter: "blur(140px)",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            zIndex: 10,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#5566f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
              boxShadow: "0 12px 36px -12px rgba(85,102,246,0.65)",
            }}
          >
            <svg
              width="46"
              height="55"
              viewBox="-14 -14 112 128"
              fill="none"
              stroke="#ffffff"
              strokeWidth={24}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M 0 0 L 18 100 L 42 22 L 66 100 L 84 0" />
            </svg>
          </div>
          {/* Wordmark рисуем путями: Satori не подхватывает внешние
              шрифты, а брендовое начертание и не должно от них зависеть. */}
          <svg
            width="232"
            height="72"
            viewBox="-14 -48 696 216"
            fill="none"
            stroke="#0b1024"
            strokeWidth={20}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M 0 0 L 18 100 L 42 22 L 66 100 L 84 0" />
            <path d="M 167 78 C 160 84 151 88 142 88 C 121 88 104 71 104 50 C 104 29 121 12 142 12 C 163 12 180 29 180 50 L 104 50" />
            <path d="M 272 24 C 272 6 208 4 208 30 C 208 50 272 52 272 74 C 272 98 208 96 208 78" />
            <path d="M 363 78 C 356 84 347 88 338 88 C 317 88 300 71 300 50 C 300 29 317 12 338 12 C 359 12 376 29 376 50 L 300 50" />
            <path d="M 426 -34 L 426 74 C 426 94 438 100 452 96 M 404 4 L 454 4" />
            <path d="M 486 0 L 486 60 C 486 84 503 100 524 100 C 545 100 562 84 562 60 L 562 0" />
            <path d="M 592 0 L 592 148" />
            <path d="M 592 50 C 592 29 609 12 630 12 C 651 12 668 29 668 50 C 668 71 651 88 630 88 C 609 88 592 71 592 50" />
          </svg>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            zIndex: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              maxWidth: 980,
            }}
          >
            Электронные журналы СанПиН и ХАССП
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 400,
              opacity: 0.78,
              maxWidth: 980,
              lineHeight: 1.35,
            }}
          >
            35 журналов · автозаполнение · Telegram-бот · PDF для проверок
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            zIndex: 10,
          }}
        >
          <div
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(124, 245, 192, 0.18)",
              color: "#7cf5c0",
              fontSize: 22,
              fontWeight: 500,
              border: "1px solid rgba(124, 245, 192, 0.4)",
              display: "flex",
            }}
          >
            Бесплатно навсегда
          </div>
          <div
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.08)",
              fontSize: 22,
              opacity: 0.9,
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex",
            }}
          >
            wesetup.ru
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    },
  );
}
