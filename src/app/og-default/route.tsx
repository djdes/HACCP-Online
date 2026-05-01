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
            W
          </div>
          <div style={{ display: "flex", fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em" }}>
            WeSetup
          </div>
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
